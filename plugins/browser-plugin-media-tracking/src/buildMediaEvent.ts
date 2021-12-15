import { NETWORK_STATE, READY_STATE } from './constants';
import { MediaElement, MediaPlayer, MediaPlayerEvent, VideoElement } from './contexts';
import { dataUrlHandler, isElementFullScreen, textTrackListToJson, timeRangesToObjectArray } from './helperFunctions';
import { MediaEntities, MediaEventData, TrackingOptions } from './types';

export function buildMediaEvent(e: Event | CustomEvent, conf: TrackingOptions): MediaEventData {
  const context = [
    getHTMLMediaElementEntities(e.target as HTMLAudioElement | HTMLVideoElement),
    getMediaPlayerEntities(e),
  ];
  if (e.target instanceof HTMLVideoElement) context.push(getHTMLVideoElementEntities(e.target));
  let data: MediaPlayerEvent = { type: e.type };
  if (conf.label) data.label = conf.label;

  return {
    schema: 'iglu:com.snowplowanalytics.snowplow/media_player_event/jsonschema/1-0-0',
    data: data,
    context: context,
  };
}

function getMediaPlayerEntities(e: Event | CustomEvent): MediaEntities {
  const el = e.target as HTMLMediaElement;
  let data: MediaPlayer = {
    currentTime: el.currentTime,
    duration: el.duration,
    ended: el.ended,
    loop: el.loop,
    muted: el.muted,
    paused: el.paused,
    playbackRate: el.playbackRate,
    volume: parseInt(String(el.volume * 100)),
  };
  if (e.hasOwnProperty('detail')) {
    data.percentProgress = (e as CustomEvent).detail;
  }
  return {
    schema: 'iglu:com.snowplowanalytics.snowplow/media_player/jsonschema/1-0-0',
    data: data,
  };
}

function getHTMLMediaElementEntities(el: HTMLAudioElement | HTMLVideoElement): MediaEntities {
  return {
    schema: 'iglu:org.whatwg/media_element/jsonschema/1-0-0',
    data: {
      htmlId: el.id,
      mediaType: el.tagName as MediaElement['mediaType'],
      autoPlay: el.autoplay,
      buffered: timeRangesToObjectArray(el.buffered),
      controls: el.controls,
      crossOrigin: el.crossOrigin,
      currentSrc: el.currentSrc,
      defaultMuted: el.defaultMuted || false,
      defaultPlaybackRate: el.defaultPlaybackRate,
      disableRemotePlayback: el.disableRemotePlayback,
      error: el.error,
      networkState: NETWORK_STATE[el.networkState] as MediaElement['networkState'],
      preload: el.preload,
      readyState: READY_STATE[el.readyState] as MediaElement['readyState'],
      seekable: timeRangesToObjectArray(el.seekable),
      seeking: el.seeking,
      src: dataUrlHandler(el.src),
      textTracks: textTrackListToJson(el.textTracks),
      fileExtension: el.currentSrc.split('.').pop() as string,
      fullscreen: isElementFullScreen(el.id),
      pictureInPicture: document.pictureInPictureElement?.id === el.id,
    },
  };
}

function getHTMLVideoElementEntities(el: HTMLVideoElement): MediaEntities {
  let data: VideoElement = {
    autoPictureInPicture: el.autoPictureInPicture,
    disablePictureInPicture: el.disablePictureInPicture,
    poster: el.poster,
    videoHeight: el.videoHeight,
    videoWidth: el.videoWidth,
  };
  return {
    schema: 'iglu:org.whatwg/video_element/jsonschema/1-0-0',
    data: data,
  };
}
