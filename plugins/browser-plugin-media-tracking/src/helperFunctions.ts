import { AllEvents, DefaultEvents, EventGroups } from './eventGroups';
import { MediaEvent, SnowplowEvent } from './mediaEvents';
import { EventGroup, MediaTrackingOptions, TextTrack, TrackingOptions } from './types';

export function timeRangesToObjectArray(t: TimeRanges): { start: number; end: number }[] {
  const out = [];
  for (let i = 0; i < t.length; i++) {
    out.push({ start: t.start(i), end: t.end(i) });
  }
  return out;
}

export function textTrackListToJson(textTrackList: TextTrackList): TextTrack[] {
  return Object.keys(textTrackList).map((_, i) => {
    return {
      label: textTrackList[i].label,
      language: textTrackList[i].language,
      kind: textTrackList[i].kind,
      mode: textTrackList[i].mode,
    };
  });
}

export function isType(e: string, _type: Object): boolean {
  return Object.keys(_type).indexOf(e) !== -1;
}

export function isElementFullScreen(id: string): boolean {
  if (document.fullscreenElement) {
    return document.fullscreenElement.id === id;
  }
  return false;
}

export function boundaryErrorHandling(boundaries: number[]): number[] {
  // Remove any elements that are out of bounds
  if (boundaries.some((b) => b < 1 || 100 < b)) {
    boundaries = boundaries.filter((b) => 0 < b && b < 100);
  }
  // Remove any duplicate elements
  if (boundaries.some((b, _, self) => self.filter((f) => f == b).length > 1)) {
    boundaries = boundaries.filter((item, pos, self) => self.indexOf(item) == pos);
  }
  return boundaries;
}

export function trackingOptionsParser(id: string, trackingOptions?: MediaTrackingOptions): TrackingOptions {
  const defaults: TrackingOptions = {
    id: id,
    captureEvents: DefaultEvents,
    progress: {
      boundaries: [10, 25, 50, 75],
      boundaryTimeoutIds: [],
    },
    volume: {
      trackingInterval: 250,
    },
  };

  if (!trackingOptions) return defaults;

  if (trackingOptions?.captureEvents) {
    let parsedEvents: string[] | EventGroup = [];
    trackingOptions.captureEvents.forEach((ev) => {
      // If an event is an EventGroup, get the events from that group
      if (EventGroups.hasOwnProperty(ev)) {
        parsedEvents = parsedEvents.concat(EventGroups[ev]);
      } else if (!Object.keys(AllEvents).filter((k) => k === ev)) {
        console.warn(`'${ev}' is not a valid event.`);
      } else {
        parsedEvents.push(ev);
      }
    });

    trackingOptions.captureEvents = parsedEvents;
    if (trackingOptions.captureEvents.indexOf(SnowplowEvent.PERCENTPROGRESS) !== -1) {
      defaults.progress = {
        boundaries: trackingOptions?.boundaries || defaults.progress!.boundaries,
        boundaryTimeoutIds: [],
      };
    }

    if (trackingOptions.captureEvents.indexOf(MediaEvent.VOLUMECHANGE) !== -1) {
      defaults.volume = {
        trackingInterval: trackingOptions?.volumeChangeTrackingInterval || defaults.volume!.trackingInterval,
      };
    }
  }
  return { ...defaults, ...trackingOptions };
}

export function dataUrlHandler(url: string): string {
  if (url.indexOf('data:') !== -1) {
    return 'DATA_URL';
  }
  return url;
}
