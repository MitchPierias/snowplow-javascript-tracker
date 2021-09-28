export enum QueryStringParameter {
  AUTOPLAY = 'autoplay',
  CONTROLS = 'controls',
  DIABLEKB = 'diablekb',
  ENABLEJSAPI = 'enablejsapi',
  END = 'end',
  FULLSCREENBUTTON = 'fs',
  IVLOADPOLICY = 'iv_load_policy',
  LANGUAGE = 'hl',
  LIST = 'list',
  LISTTYPE = 'listType',
  LOOP = 'loop',
  MODESTBRANDING = 'modestbranding',
  ORIGIN = 'origin',
  PLAYLIST = 'playlist',
  PLAYSINLINE = 'playsinline',
  RELATED = 'rel',
  START = 'start',
  WIDGETREFERRER = 'widget_referrer',
}

// The payload a YouTube player event emits has no identifier of what event it is
// Some payloads can emit the same data
// i.e. onError and onPlaybackRateChange can both emit '{data: 2}'
export enum YTPlayerEvent {
  ONSTATECHANGE = 'onStateChange',
  ONPLAYBACKQUALITYCHANGE = 'onPlaybackQualityChange',
  ONERROR = 'onError',
  ONAPICHANGE = 'onApiChange',
  ONPLAYBACKRATECHANGE = 'onPlaybackRateChange',
  ONREADY = 'onReady',
}

export const YTStateEvent: Record<string, string> = {
  '-1': 'unstarted',
  '0': 'ended',
  '1': 'play',
  '2': 'pause',
  '3': 'buffering',
  '5': 'cued',
};

export const CaptureEventToYouTubeEvent: Record<string, YTPlayerEvent> = {
  ready: YTPlayerEvent.ONREADY,
  playbackratechange: YTPlayerEvent.ONPLAYBACKRATECHANGE,
  playbackqualitychange: YTPlayerEvent.ONPLAYBACKQUALITYCHANGE,
  error: YTPlayerEvent.ONERROR,
  apichange: YTPlayerEvent.ONAPICHANGE,
};
Object.keys(YTStateEvent).forEach((k) => (CaptureEventToYouTubeEvent[YTStateEvent[k]] = YTPlayerEvent.ONSTATECHANGE));
Object.keys(YTStateEvent).forEach((k) => (YTStateEvent[YTStateEvent[k]] = k));

export enum YTState {
  UNSTARTED = 'unstarted',
  ENDED = 'ended',
  PLAYING = 'play',
  PAUSED = 'pause',
  BUFFERING = 'buffering',
  CUED = 'cued',
}

export const YTError: Record<number, string> = {
  2: 'INVALID_URL',
  5: 'HTML5_ERROR',
  100: 'VIDEO_NOT_FOUND',
  101: 'MISSING_EMBED_PERMISSION',
  150: 'MISSING_EMBED_PERMISSION',
};
