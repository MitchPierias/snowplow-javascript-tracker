import { AllEvents, DefaultEvents, EventGroups } from './eventGroups';
import { SnowplowEvent } from './snowplowEvents';
import { EventGroup, MediaTrackingOptions, TrackingOptions } from './types';
import { CaptureEventToYouTubeEvent, YTPlayerEvent } from './constants';

export function isElementFullScreen(mediaId: string): boolean {
  if (document.fullscreenElement) {
    return document.fullscreenElement.id === mediaId;
  }
  return false;
}

export function trackingOptionsParser(mediaId: string, conf?: MediaTrackingOptions): TrackingOptions {
  const defaults: TrackingOptions = {
    mediaId: mediaId,
    captureEvents: DefaultEvents,
    youtubeEvents: [
      YTPlayerEvent.ONSTATECHANGE,
      YTPlayerEvent.ONPLAYBACKQUALITYCHANGE,
      YTPlayerEvent.ONERROR,
      YTPlayerEvent.ONPLAYBACKRATECHANGE,
    ],
    updateRate: 500,
    progress: {
      boundaries: [10, 25, 50, 75],
      boundaryTimeoutIds: [],
    },
  };

  if (!conf) return defaults;

  if (conf.updateRate) defaults.updateRate = conf.updateRate;

  if (conf.captureEvents) {
    let parsedEvents: EventGroup = [];
    for (let ev of conf.captureEvents) {
      // If an event is an EventGroup, get the events from that group
      if (EventGroups.hasOwnProperty(ev)) {
        parsedEvents = parsedEvents.concat(EventGroups[ev]);
      } else if (!Object.keys(AllEvents).filter((k) => k === ev)) {
        console.warn(`'${ev}' is not a valid event.`);
      } else {
        parsedEvents.push(ev);
      }
    }

    conf.captureEvents = parsedEvents;

    for (let ev of conf.captureEvents) {
      const youtubeEvent = CaptureEventToYouTubeEvent[ev];
      if (CaptureEventToYouTubeEvent.hasOwnProperty(ev) && defaults.youtubeEvents.indexOf(youtubeEvent) === -1) {
        defaults.youtubeEvents.push(youtubeEvent);
      }
    }

    if (conf.captureEvents.indexOf(SnowplowEvent.PERCENTPROGRESS) !== -1) {
      defaults.progress = {
        boundaries: conf?.boundaries || defaults.progress!.boundaries,
        boundaryTimeoutIds: [],
      };
    }
  }

  return { ...defaults, ...conf };
}

// URLSearchParams is not supported in IE
// https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams

export class UrlParameters {
  baseUrl: string;
  params: Record<string, string>;

  constructor(url: string) {
    this.baseUrl = url.split('?')[0];
    this.params = this._parseUrlParams(url);
    if (!this.params.hasOwnProperty('enablejsapi')) {
      this.addParam('enablejsapi', '1');
    }
  }

  _parseUrlParams(url: string) {
    // get urls params from a url without URLSearchParams
    const params: Record<string, string> = {};
    const urlParams = url.split('?')[1];
    if (!urlParams) return params;
    urlParams.split('&').forEach((p) => {
      const param = p.split('=');
      params[param[0]] = param[1];
    });
    return params;
  }

  addParam(param: string, value: string): void {
    this.params[param] = value;
  }

  getParam(param: string): string | null {
    return this.params.hasOwnProperty(param) ? this.params[param] : null;
  }

  getUrl(): string {
    let keys = Object.keys(this.params);
    if (!keys.length) return this.baseUrl;
    let returnUrl = this.baseUrl;
    Object.keys(this.params).forEach((p: string, i: number) => {
      let sep = i === 0 ? '?' : '&';
      let addon = `${sep + p}=${this.params[p]}`;
      returnUrl += addon;
    });
    return returnUrl;
  }
}
