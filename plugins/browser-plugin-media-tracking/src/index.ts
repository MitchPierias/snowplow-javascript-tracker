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
import {
  isTypeTextTrackEvent,
  isTypeDocumentEvent,
  boundaryErrorHandling,
  trackingOptionsParser,
} from './helperFunctions';
import { SnowplowMediaEvent } from './snowplowEvents';
import { DocumentEvent, MediaEvent } from './mediaEvents';
import { Event, TrackingOptions, MediaTrackingOptions, EventGroup, TrackedElement } from './types';
import { BrowserPlugin, BrowserTracker, dispatchToTrackersInCollection } from '@snowplow/browser-tracker-core';
import { buildSelfDescribingEvent, CommonEventProperties, Logger, SelfDescribingJson } from '@snowplow/tracker-core';
import { MediaPlayerEvent } from './contexts';
import { findMediaElem } from './findMediaElement';
import { buildMediaEvent } from './buildMediaEvent';
import { MediaProperty } from './mediaProperties';
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
    [DocumentEvent.FULLSCREENCHANGE]: (el: HTMLAudioElement | HTMLVideoElement, conf: TrackingOptions) => {
      if (document.fullscreenElement?.id === args.id) {
        mediaPlayerEvent(el, DocumentEvent.FULLSCREENCHANGE, conf);
      }
    },
    [MediaEvent.SEEKED]: (el: HTMLAudioElement | HTMLVideoElement, conf: TrackingOptions) => {
      if (conf.captureEvents.indexOf(SnowplowMediaEvent.PERCENTPROGRESS) !== 0) {
        while (conf.progress!.boundaryTimeoutIds.length) {
          clearTimeout(Number(conf.progress!.boundaryTimeoutIds.pop()));
        }
        setPercentageBoundTimeouts(el, conf);
      }
    },
  };

  const eventHandlers: Record<string, Function> = {};
  for (let ev of conf.captureEvents) {
    if (eventsWithOtherFunctions.hasOwnProperty(ev)) {
      eventHandlers[ev] = (el: HTMLAudioElement | HTMLVideoElement) => eventsWithOtherFunctions[ev](el);
    }
    eventHandlers[ev] = (el: HTMLAudioElement | HTMLVideoElement, e: Event) => mediaPlayerEvent(el, e, conf);
  }

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
    if (conf.captureEvents.indexOf(SnowplowMediaEvent.PERCENTPROGRESS) !== 0) {
      boundaryErrorHandling(conf.progress!.boundaries);
      setPercentageBoundTimeouts(result.el, conf);
    }
    addCaptureEventListeners(result.el, conf.captureEvents, eventHandlers);
    trackedIds[id].tracking = true;
  }
}

function addCaptureEventListeners(
  el: HTMLAudioElement | HTMLVideoElement,
  captureEvents: EventGroup,
  eventHandlers: Record<string, Function>
): void {
  for (let e of captureEvents) {
    const ev: EventListener = () => eventHandlers[e](el, e);
    if (isTypeTextTrackEvent(e)) {
      el.textTracks.addEventListener(e, ev);
    } else if (isTypeDocumentEvent(e)) {
      document.addEventListener(e, ev);
      // Chrome and Safari both use the 'webkit' prefix for the 'fullscreenchange' event
      // IE uses 'MS'
      if (e === DocumentEvent.FULLSCREENCHANGE) {
        document.addEventListener('webkit' + e, ev);
        document.addEventListener('MS' + e, ev);
      }
    } else {
      el.addEventListener(e, ev);
    }
  }
}

function mediaPlayerEvent(
  el: HTMLAudioElement | HTMLVideoElement,
  e: Event,
  conf: TrackingOptions,
  boundary?: number
): void {
  const event = buildMediaEvent(el, e, conf.label, boundary);
  if (conf.captureEvents.indexOf(SnowplowMediaEvent.PERCENTPROGRESS) !== -1) {
    progressHandler(e, el, conf);
  }

  // Dragging the volume scrubber will generate a lot of events, this limits the rate at which
  // volume events can be sent at
  if (e === MediaEvent.VOLUMECHANGE && conf.volume) {
    clearTimeout(Number(conf.volume.eventTimeoutId));
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

function progressHandler(e: Event, el: HTMLAudioElement | HTMLVideoElement, conf: TrackingOptions) {
  if (e === MediaEvent.PAUSE) {
    while (conf.progress!.boundaryTimeoutIds.length) {
      clearTimeout(Number(conf.progress!.boundaryTimeoutIds.pop()));
    }
  }

  if (e === MediaEvent.PLAY && el[MediaProperty.READYSTATE] > 0) {
    setPercentageBoundTimeouts(el, conf);
  }
}

function setPercentageBoundTimeouts(el: HTMLAudioElement | HTMLVideoElement, conf: TrackingOptions) {
  for (let boundary of conf.progress!.boundaries) {
    const absoluteBoundaryTimeMs = el[MediaProperty.DURATION] * (boundary / 100) * 1000;
    const currentTimeMs = el[MediaProperty.CURRENTTIME] * 1000;
    const timeUntilBoundaryEvent = absoluteBoundaryTimeMs - currentTimeMs;
    // If the boundary is less than the current time, we don't need to bother setting it
    if (0 < timeUntilBoundaryEvent) {
      conf.progress!.boundaryTimeoutIds.push(
        setTimeout(
          () => waitAnyRemainingTimeAfterTimeout(el, timeUntilBoundaryEvent, boundary, conf),
          timeUntilBoundaryEvent
        )
      );
    }
  }
}

// The timeout in setPercentageBoundTimeouts fires ~100 - 300ms early
// waitAnyRemainingTimeAfterTimeout ensures the event is fired accurately

function waitAnyRemainingTimeAfterTimeout(
  el: HTMLAudioElement | HTMLVideoElement,
  boundaryTime: number,
  boundary: number,
  conf: TrackingOptions
) {
  if (el[MediaProperty.CURRENTTIME] * 1000 < boundaryTime) {
    setTimeout(() => waitAnyRemainingTimeAfterTimeout(el, boundaryTime, boundary, conf), 10);
  } else {
    mediaPlayerEvent(el, SnowplowMediaEvent.PERCENTPROGRESS, conf, boundary);
  }
}
