import { MediaElement, MediaPlayer, MediaPlayerEvent, VideoElement } from './contexts';
import { SnowplowMediaEvent } from './snowplowEvents';
import { MediaEvent, TextTrackEvent, DocumentEvent, VideoEvent } from './mediaEvents';

export type EventGroup = (DocumentEvent | MediaEvent | SnowplowMediaEvent | TextTrackEvent | VideoEvent | string)[];

export type MediaEventType = DocumentEvent | MediaEvent | SnowplowMediaEvent | TextTrackEvent | VideoEvent;

export type HTMLVideoFormat = 'mp4' | 'ogg' | 'webm';

// All Video formats can be used as Audio as well
export type HTMLAudioFormat = 'aac' | 'aacp' | 'caf' | 'flac' | 'mp3' | 'wav' | HTMLVideoFormat;

export interface RecievedTrackingOptions {
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

export interface trackedElement {
  searchIntervals: ReturnType<typeof setTimeout>[];
  searchLimit: number;
  tracking: boolean;
  [index: string]: ReturnType<typeof setTimeout>[] | number | boolean;
}
