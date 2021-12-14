/*
 * Copyright (c) 2021 Snowplow Analytics Ltd
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * 3. Neither the name of the copyright holder nor the names of its
 *    contributors may be used to endorse or promote products derived from
 *    this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
import { isType, boundaryErrorHandling, trackingOptionsParser } from './helperFunctions';
import { DocumentEvent, MediaEvent, SnowplowEvent, TextTrackEvent } from './mediaEvents';
import { TrackingOptions, MediaTrackingOptions, TrackedElement } from './types';
import { BrowserPlugin, BrowserTracker, dispatchToTrackersInCollection } from '@snowplow/browser-tracker-core';
import { buildSelfDescribingEvent, CommonEventProperties, Logger, SelfDescribingJson } from '@snowplow/tracker-core';
import { MediaPlayerEvent } from './contexts';
import { findMediaElem } from './findMediaElement';
import { buildMediaEvent } from './buildMediaEvent';
import { SEARCH_ERROR } from './constants';

declare global {
  interface HTMLVideoElement {
    autoPictureInPicture: boolean;
    disableRemotePlayback: boolean;
    disablePictureInPicture: boolean;
  }
  interface HTMLAudioElement {
    disableRemotePlayback: boolean;
  }
  interface Document {
    pictureInPictureElement: Element;
  }
}

let LOG: Logger;
const _trackers: Record<string, BrowserTracker> = {};

export function MediaTrackingPlugin(): BrowserPlugin {
  return {
    activateBrowserPlugin: (tracker: BrowserTracker) => {
      _trackers[tracker.id] = tracker;
    },
    logger: (logger) => {
      LOG = logger;
    },
  };
}

const trackedIds: Record<string, TrackedElement> = {};

export function enableMediaTracking(args: { id: string; options?: MediaTrackingOptions }) {
  const conf: TrackingOptions = trackingOptionsParser(args.id, args.options);
  const eventsWithOtherFunctions: Record<string, Function> = {
    [DocumentEvent.FULLSCREENCHANGE]: (e: Event, conf: TrackingOptions) => {
      if (document.fullscreenElement?.id === args.id) {
        mediaPlayerEvent(e, conf);
      }
    },
    [MediaEvent.SEEKED]: (e: Event, conf: TrackingOptions) => {
      if (conf.captureEvents.indexOf(SnowplowEvent.PERCENTPROGRESS) !== 0) {
        while (conf.progress!.boundaryTimeoutIds.length) {
          clearTimeout(conf.progress!.boundaryTimeoutIds.pop() as ReturnType<typeof setTimeout>);
        }
        setPercentageBoundTimeouts(e.target as HTMLAudioElement | HTMLVideoElement, conf);
      }
    },
  };

  const eventHandlers: Record<string, Function> = {};
  conf.captureEvents.forEach((ev) => {
    if (eventsWithOtherFunctions.hasOwnProperty(ev)) {
      eventHandlers[ev] = (e: Event, conf: TrackingOptions) => eventsWithOtherFunctions[ev](e, conf);
    }
    eventHandlers[ev] = (e: Event, conf: TrackingOptions) => mediaPlayerEvent(e, conf);
  });

  trackedIds[args.id] = { waitTime: 250, retryCount: 5, tracking: false };
  setUpListeners(args.id, conf, eventHandlers);
}

function setUpListeners(id: string, conf: TrackingOptions, eventHandlers: Record<string, Function>) {
  // The element may not be loaded in time for this function to run,
  // so we have a few goes at finding the element
  const result = findMediaElem(id);

  if (!trackedIds[id].retryCount) {
    LOG.error(result.err || SEARCH_ERROR.NOT_FOUND);
    return;
  }

  if (!result.el) {
    trackedIds[id].retryCount--;
    trackedIds[id].timeoutId = setTimeout(() => setUpListeners(id, conf, eventHandlers), trackedIds[id].waitTime);
    trackedIds[id].waitTime *= 2;
    return;
  }

  clearTimeout(trackedIds[id].timeoutId as ReturnType<typeof setTimeout>);

  if (!trackedIds[id].tracking) {
    if (conf.captureEvents.indexOf(SnowplowEvent.PERCENTPROGRESS) !== 0) {
      boundaryErrorHandling(conf.progress!.boundaries);
      setPercentageBoundTimeouts(result.el, conf);
    }
    addCaptureEventListeners(result.el, conf, eventHandlers);
    trackedIds[id].tracking = true;
  }
}

function addCaptureEventListeners(
  el: HTMLAudioElement | HTMLVideoElement,
  conf: TrackingOptions,
  eventHandlers: Record<string, Function>
): void {
  conf.captureEvents.forEach((c) => {
    const ev: EventListener = (e: Event) => eventHandlers[c](e, conf);
    if (isType(c, TextTrackEvent)) {
      el.textTracks.addEventListener(c, ev);
    } else if (isType(c, DocumentEvent)) {
      document.addEventListener(c, ev);
      // Chrome and Safari both use the 'webkit' prefix for the 'fullscreenchange' event
      // IE uses 'MS'
      if (c === DocumentEvent.FULLSCREENCHANGE) {
        document.addEventListener('webkit' + c, ev);
        document.addEventListener('MS' + c, ev);
      }
    } else {
      el.addEventListener(c, ev);
    }
  });
}

function mediaPlayerEvent(e: Event, conf: TrackingOptions): void {
  const event = buildMediaEvent(e, conf);
  if (conf.captureEvents.indexOf(SnowplowEvent.PERCENTPROGRESS) !== -1) {
    progressHandler(e, conf);
  }

  // Dragging the volume scrubber will generate a lot of events, this limits the rate at which
  // volume events can be sent at
  if (e.type === MediaEvent.VOLUMECHANGE && conf.volume) {
    clearTimeout(conf.volume.eventTimeoutId as ReturnType<typeof setTimeout>);
    conf.volume.eventTimeoutId! = setTimeout(() => trackMediaEvent(event), conf.volume.trackingInterval);
  } else {
    trackMediaEvent(event);
  }
}

function trackMediaEvent(
  event: SelfDescribingJson<MediaPlayerEvent> & CommonEventProperties,
  trackers: Array<string> = Object.keys(_trackers)
): void {
  dispatchToTrackersInCollection(trackers, _trackers, (t) => {
    t.core.track(buildSelfDescribingEvent({ event }), event.context, event.timestamp);
  });
}

// Progress Tracking

function progressHandler(e: Event, conf: TrackingOptions) {
  if (e.type === MediaEvent.PAUSE) {
    while (conf.progress!.boundaryTimeoutIds.length) {
      clearTimeout(conf.progress!.boundaryTimeoutIds.pop() as ReturnType<typeof setTimeout>);
    }
  }

  if (e.type === MediaEvent.PLAY && (e.target as HTMLAudioElement | HTMLVideoElement).readyState > 0) {
    setPercentageBoundTimeouts(e.target as HTMLAudioElement | HTMLVideoElement, conf);
  }
}

function setPercentageBoundTimeouts(el: HTMLAudioElement | HTMLVideoElement, conf: TrackingOptions) {
  conf.progress!.boundaries.forEach((boundary) => {
    const absoluteBoundaryTimeMs = el.duration * (boundary / 100) * 1000;
    const timeUntilBoundaryEvent = absoluteBoundaryTimeMs - el.currentTime * 1000;
    // If the boundary is less than the current time, we don't need to bother setting it
    if (0 < timeUntilBoundaryEvent) {
      conf.progress!.boundaryTimeoutIds.push(
        setTimeout(
          () => waitAnyRemainingTimeAfterTimeout(el, timeUntilBoundaryEvent, boundary, conf),
          timeUntilBoundaryEvent
        )
      );
    }
  });
}

// The timeout in setPercentageBoundTimeouts fires ~100 - 300ms early
// waitAnyRemainingTimeAfterTimeout ensures the event is fired accurately

function waitAnyRemainingTimeAfterTimeout(
  el: HTMLAudioElement | HTMLVideoElement,
  timeUntilBoundaryEvent: number,
  boundary: number,
  conf: TrackingOptions
) {
  if (el.currentTime * 1000 < timeUntilBoundaryEvent) {
    setTimeout(() => waitAnyRemainingTimeAfterTimeout(el, timeUntilBoundaryEvent, boundary, conf), 10);
  } else {
    // CustomEvent isn't supported in IE
    const evt = document.createEvent('CustomEvent');
    evt.initCustomEvent(SnowplowEvent.PERCENTPROGRESS, false, false, boundary);
    el.dispatchEvent(evt);
  }
}
