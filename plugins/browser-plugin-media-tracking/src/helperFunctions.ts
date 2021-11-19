import { DefaultEvents, EventGroups } from './eventGroups';
import { DocumentEvent, MediaEvent, TextTrackEvent } from './mediaEvents';
import { SnowplowMediaEvent } from './snowplowEvents';
import { EventGroup, MediaTrackingOptions, TextTrackObject, TrackingOptions } from './types';

export function timeRangesToObjectArray(t: TimeRanges): { start: number; end: number }[] {
  const out = [];
  for (let i = 0; i < t.length; i++) {
    out.push({ start: t.start(i), end: t.end(i) });
  }
  return out;
}

export function textTrackListToJson(textTrackList: TextTrackList): TextTrackObject[] {
  const out: TextTrackObject[] = [];
  for (let o of Object.keys(textTrackList)) {
    const i = parseInt(o);
    out.push({
      label: textTrackList[i].label,
      language: textTrackList[i].language,
      kind: textTrackList[i].kind,
      mode: textTrackList[i].mode,
    });
  }
  return out;
}

export function isTypeTextTrackEvent(e: string): boolean {
  return Object.keys(TextTrackEvent).indexOf(e) !== -1;
}

export function isTypeDocumentEvent(e: string): boolean {
  return Object.keys(DocumentEvent).indexOf(e) !== -1;
}

function elementsInArrayOutOfBounds(arr: number[]): boolean {
  return arr.filter((a) => a < 1 || 100 < a).length !== 0;
}

function duplicatesInArray(arr: number[]): boolean {
  return arr.filter((b) => arr.filter((f) => f == b).length > 1).length !== 0;
}

export function isElementFullScreen(mediaId: string): boolean {
  if (document.fullscreenElement) {
    return document.fullscreenElement.id === mediaId;
  }
  return false;
}

export function boundryErrorHandling(boundries: number[]): number[] {
  if (duplicatesInArray(boundries)) {
    boundries = boundries.filter((item, pos, self) => self.indexOf(item) == pos);
  }

  if (elementsInArrayOutOfBounds(boundries)) {
    boundries = boundries.filter((b) => 0 < b && b < 100);
  }
  return boundries;
}

export function trackingOptionsParser(mediaId: string, trackingOptions?: MediaTrackingOptions): TrackingOptions {
  const defaults: TrackingOptions = {
    mediaId: mediaId,
    captureEvents: DefaultEvents,
    progress: {
      boundries: [10, 25, 50, 75],
      boundryTimeoutIds: [],
    },
  };

  if (!trackingOptions) return defaults;

  if (trackingOptions?.captureEvents) {
    let parsedEvents: string[] | EventGroup = [];
    for (let ev of trackingOptions.captureEvents) {
      // If an event is an EventGroup, get the events from that group
      if (EventGroups.hasOwnProperty(ev)) {
        parsedEvents = parsedEvents.concat(EventGroups[ev]);
        // Log an error if the event isn't valid
        //} else if (!Object.keys(MediaEvent).filter((k) => k === ev)) {
      } else if (!Object.keys(MediaEvent).filter((k) => k === ev)) {
        console.error(`'${ev}' is not a valid captureEvent.`);
      } else {
        parsedEvents.push(ev);
      }
    }
    trackingOptions.captureEvents = parsedEvents;
    if (trackingOptions.captureEvents.indexOf(SnowplowMediaEvent.PERCENTPROGRESS) !== -1) {
      defaults.progress = {
        boundries: trackingOptions?.boundries || [10, 25, 50, 75],
        boundryTimeoutIds: [],
      };
    }
  }

  return { ...defaults, ...trackingOptions };
}

export function dataUrlHandler(url: string): string {
  if (url.indexOf('data:') !== -1) {
    return 'DATA_URI';
  }
  return url;
}
