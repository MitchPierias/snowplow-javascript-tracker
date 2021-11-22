import { MediaElement, MediaPlayer, MediaPlayerEvent, VideoElement } from './contexts';
import { SnowplowMediaEvent } from './snowplowEvents';
import { MediaEvent, TextTrackEvent, DocumentEvent, VideoEvent } from './mediaEvents';

export type EventGroup = (DocumentEvent | MediaEvent | SnowplowMediaEvent | TextTrackEvent | VideoEvent | string)[];

export type MediaEventType = DocumentEvent | MediaEvent | SnowplowMediaEvent | TextTrackEvent | VideoEvent;

export interface MediaTrackingOptions {
  boundries?: number[];
  captureEvents?: EventGroup;
  label?: string;
  boundryTimeoutIds?: ReturnType<typeof setTimeout>[];
}

export interface TrackingOptions {
  mediaId: string;
  captureEvents: EventGroup;
  label?: string;
  progress?: {
    boundries: number[];
    boundryTimeoutIds: ReturnType<typeof setTimeout>[];
  };
  volumeChangeTimeout?: ReturnType<typeof setTimeout>;
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

export interface TextTrackObject {
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
  [key: string]: any;
}

export interface SearchError {
  NOT_FOUND: string;
  MULTIPLE_ELEMENTS: string;
  PLYR_CURRENTSRC: string;
}
