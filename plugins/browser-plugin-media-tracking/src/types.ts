import { MediaElement, MediaPlayer, MediaPlayerEvent, VideoElement } from './contexts';
import { SnowplowMediaEvent } from './snowplowEvents';
import { MediaEvent, TextTrackEvent, DocumentEvent, VideoEvent } from './mediaEvents';

export type Event = DocumentEvent | MediaEvent | SnowplowMediaEvent | TextTrackEvent | VideoEvent;

export type EventGroup = (Event | string)[];

export interface MediaTrackingOptions {
  boundaries?: number[];
  captureEvents?: EventGroup;
  label?: string;
  volumeChangeTrackingInterval?: number;
}

export interface TrackingOptions {
  mediaId: string;
  captureEvents: EventGroup;
  label?: string;
  progress?: {
    boundaries: number[];
    boundaryTimeoutIds: ReturnType<typeof setTimeout>[];
  };
  volume?: {
    eventTimeoutId?: ReturnType<typeof setTimeout>;
    trackingInterval: number;
  };
}

export interface MediaEventData {
  schema: string;
  data: MediaPlayerEvent;
  context: MediaEntities[];
}

export interface MediaEntities {
  schema: string;
  data: MediaElement | VideoElement | MediaPlayer;
}

export interface TextTrack {
  label: string;
  language: string;
  kind: string;
  mode: string;
}

export interface TrackedElement {
  timeoutId?: ReturnType<typeof setTimeout>;
  waitTime: number;
  retryCount: number;
  tracking: boolean;
}

export interface SearchResult {
  el?: HTMLAudioElement | HTMLVideoElement;
  err?: string;
}

export interface SearchError {
  NOT_FOUND: string;
  MULTIPLE_ELEMENTS: string;
  PLYR_CURRENTSRC: string;
}
