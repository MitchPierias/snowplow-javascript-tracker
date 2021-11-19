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
  boundryErrorHandling,
  trackingOptionsParser,
} from './helperFunctions';
import { SnowplowMediaEvent } from './snowplowEvents';
import { DocumentEvent, MediaEvent } from './mediaEvents';
import { MediaEventType, TrackingOptions, RecievedTrackingOptions, EventGroup, trackedElement } from './types';
import { BrowserPlugin, BrowserTracker, dispatchToTrackersInCollection } from '@snowplow/browser-tracker-core';
import { buildSelfDescribingEvent, CommonEventProperties, Logger, SelfDescribingJson } from '@snowplow/tracker-core';
import { MediaPlayerEvent } from './contexts';
import { findMediaElem } from './findMediaElement';
import { buildMediaEvent } from './buildMediaEvent';
import { MediaProperty } from './mediaProperties';

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

const trackedIds: Record<string, trackedElement> = {};

export function enableMediaTracking(args: { id: string; options?: RecievedTrackingOptions }) {
  let conf: TrackingOptions = trackingOptionsParser(args.id, args.options);

  const eventsWithOtherFunctions: Record<string, Function> = {
    [DocumentEvent.FULLSCREENCHANGE]: (el: HTMLAudioElement | HTMLVideoElement, conf: TrackingOptions) => {
      if (document.fullscreenElement?.id === args.id) {
        mediaPlayerEvent(el, DocumentEvent.FULLSCREENCHANGE, conf);
      }
    },
    [MediaEvent.SEEKED]: (el: HTMLAudioElement | HTMLVideoElement, conf: TrackingOptions) => {
      if (conf.captureEvents.indexOf(SnowplowMediaEvent.PERCENTPROGRESS) !== 0) {
        while (conf.progress!.boundryTimeoutIds.length) {
          clearTimeout(Number(conf.progress!.boundryTimeoutIds.pop()));
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
    eventHandlers[ev] = (el: HTMLAudioElement | HTMLVideoElement, e: MediaEventType) => mediaPlayerEvent(el, e, conf);
  }

  trackedIds[args.id] = { searchIntervals: [], searchLimit: 5, tracking: false };
  setUpListeners(args.id, conf, eventHandlers);
  trackedIds[args.id].searchIntervals.push(setInterval(() => setUpListeners(args.id, conf, eventHandlers), 5000));
}

function setUpListeners(id: string, conf: TrackingOptions, eventHandlers: Record<string, Function>) {
  // The element may not be loaded in time for this function to run,
  // so we have a few goes at finding the element
  let el = findMediaElem(id);

  if (!trackedIds[id].searchLimit) {
    LOG.error("Couldn't find element before timeout");
    trackedIds[id].searchIntervals.forEach((e: ReturnType<typeof setTimeout>) => clearInterval(e));
    return;
  }

  if (!el) {
    trackedIds[id].searchLimit--;
    return;
  }

  trackedIds[id].searchIntervals.forEach((e: ReturnType<typeof setTimeout>) => clearInterval(e));
  if (!trackedIds[id].tracking) {
    if (conf.captureEvents.indexOf(SnowplowMediaEvent.PERCENTPROGRESS) !== 0) {
      boundryErrorHandling(conf.progress!.boundries);
      setPercentageBoundTimeouts(el, conf);
    }
    addCaptureEventListeners(el, conf.captureEvents, eventHandlers);
    trackedIds[id].tracking = true;
  }
}

function addCaptureEventListeners(
  el: HTMLAudioElement | HTMLVideoElement,
  captureEvents: EventGroup,
  eventHandlers: Record<string, Function>
): void {
  for (let e of captureEvents) {
    let ev: EventListener = () => eventHandlers[e](el, e);
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
  e: MediaEventType,
  conf: TrackingOptions,
  boundry?: number
): void {
  let event = buildMediaEvent(el, e, conf.label, boundry);
  if (conf.captureEvents.indexOf(SnowplowMediaEvent.PERCENTPROGRESS) !== -1) {
    progressHandler(e, el, conf);
  }

  // Dragging the volume scrubber will generate a lot of events, this limits the rate at which
  // volume events can be sent at
  if (e === MediaEvent.VOLUMECHANGE) {
    clearTimeout(Number(conf.volumeChangeTimeout));
    conf.volumeChangeTimeout = setTimeout(() => trackMediaEvent(event), 200);
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

function progressHandler(e: MediaEventType, el: HTMLAudioElement | HTMLVideoElement, conf: TrackingOptions) {
  if (e === MediaEvent.PAUSE) {
    while (conf.progress!.boundryTimeoutIds.length) {
      clearTimeout(Number(conf.progress!.boundryTimeoutIds.pop()));
    }
  }

  if (e === MediaEvent.PLAY && el[MediaProperty.READYSTATE] > 0) {
    setPercentageBoundTimeouts(el, conf);
  }
}

function setPercentageBoundTimeouts(el: HTMLAudioElement | HTMLVideoElement, conf: TrackingOptions) {
  for (let boundry of conf.progress!.boundries) {
    let absoluteBoundryTimeMs = el[MediaProperty.DURATION] * (boundry / 100) * 1000;
    let currentTimeMs = el[MediaProperty.CURRENTTIME] * 1000;
    let timeUntilBoundryEvent = absoluteBoundryTimeMs - currentTimeMs;
    // If the boundry is less than the current time, we don't need to bother setting it
    if (timeUntilBoundryEvent > 0) {
      conf.progress!.boundryTimeoutIds.push(
        setTimeout(
          () => waitAnyRemainingTimeAfterTimeout(el, timeUntilBoundryEvent, boundry, conf),
          timeUntilBoundryEvent
        )
      );
    }
  }
}

// The timeout in setPercentageBoundTimeouts fires ~100 - 300ms early
// waitAnyRemainingTimeAfterTimeout ensures the event is fired accurately

function waitAnyRemainingTimeAfterTimeout(
  el: HTMLAudioElement | HTMLVideoElement,
  boundryTime: number,
  boundry: number,
  conf: TrackingOptions
) {
  if (el[MediaProperty.CURRENTTIME] * 1000 < boundryTime) {
    setTimeout(() => waitAnyRemainingTimeAfterTimeout(el, boundryTime, boundry, conf), 10);
  } else {
    mediaPlayerEvent(el, SnowplowMediaEvent.PERCENTPROGRESS, conf, boundry);
  }
}
