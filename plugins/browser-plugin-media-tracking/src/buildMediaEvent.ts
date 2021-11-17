import { NETWORK_STATE, READY_STATE } from './constants';
import { MediaElement, MediaPlayer, MediaPlayerEvent, VideoElement } from './contexts';
import { dataUrlHandler, isElementFullScreen, textTrackListToJson, timeRangesToObjectArray } from './helperFunctions';
import { MediaEntities, MediaEventData, MediaEventType } from './types';
import { MediaProperty, VideoProperty } from './mediaProperties';

export function buildMediaEvent(
  el: HTMLVideoElement | HTMLAudioElement,
  e: MediaEventType,
  label?: string,
  boundry?: number
): MediaEventData {
  let mediaContext = [getHTMLMediaElementEntities(el), getMediaPlayerEntities(el, boundry)];
  if (el instanceof HTMLVideoElement) mediaContext.push(getHTMLVideoElementEntities(el));
  let data: MediaPlayerEvent = { type: e };
  if (label) data.label = label;

  return {
    schema: 'iglu:com.snowplowanalytics.snowplow/media_player_event/jsonschema/1-0-0',
    data: data,
    context: mediaContext,
  };
}

function getMediaPlayerEntities(el: HTMLVideoElement | HTMLAudioElement, boundry?: number): MediaEntities {
  let data: MediaPlayer = {
    currentTime: el[MediaProperty.CURRENTTIME],
    duration: el[MediaProperty.DURATION],
    ended: el[MediaProperty.ENDED],
    loop: el[MediaProperty.LOOP],
    muted: el[MediaProperty.MUTED],
    paused: el[MediaProperty.PAUSED],
    playbackRate: el[MediaProperty.PLAYBACKRATE],
    volume: parseInt(String(el[MediaProperty.VOLUME] * 100)),
  };
  if (boundry) data.percentProgress = boundry;
  return {
    schema: 'iglu:com.snowplowanalytics.snowplow/media_player/jsonschema/1-0-0',
    data: data,
  };
}

function getHTMLMediaElementEntities(el: HTMLVideoElement | HTMLAudioElement): MediaEntities {
  return {
    schema: 'iglu:org.whatwg/media_element/jsonschema/1-0-0',
    data: {
      htmlId: el.id,
      mediaType: el.tagName as MediaElement['mediaType'],
      autoPlay: el[MediaProperty.AUTOPLAY],
      buffered: timeRangesToObjectArray(el[MediaProperty.BUFFERED]),
      controls: el[MediaProperty.CONTROLS],
      crossOrigin: el[MediaProperty.CROSSORIGIN],
      currentSource: el[MediaProperty.CURRENTSRC],
      defaultMuted: el[MediaProperty.DEFAULTMUTED],
      defaultPlaybackRate: el[MediaProperty.DEFAULTPLAYBACKRATE],
      disableRemotePlayback: el[MediaProperty.DISABLEREMOTEPLAYBACK],
      error: el[MediaProperty.ERROR],
      networkState: NETWORK_STATE[el[MediaProperty.NETWORKSTATE]] as MediaElement['networkState'],
      preload: el[MediaProperty.PRELOAD],
      readyState: READY_STATE[el[MediaProperty.READYSTATE]] as MediaElement['readyState'],
      seekable: timeRangesToObjectArray(el[MediaProperty.SEEKABLE]),
      seeking: el[MediaProperty.SEEKING],
      src: dataUrlHandler(el[MediaProperty.SRC]),
      textTracks: textTrackListToJson(el[MediaProperty.TEXTTRACKS]),
      fileExtension: el[MediaProperty.CURRENTSRC].split('.').pop() as string,
      fullscreen: isElementFullScreen(el.id),
      pictureInPicture: document.pictureInPictureElement?.id === el.id,
    },
  };
}

function getHTMLVideoElementEntities(el: HTMLVideoElement): MediaEntities {
  let data: VideoElement = {
    autoPictureInPicture: el[VideoProperty.AUTOPICTUREINPICTURE],
    disablePictureInPicture: el[VideoProperty.DISABLEPICTUREINPICTURE],
    poster: el[VideoProperty.POSTER],
    videoHeight: el[VideoProperty.VIDEOHEIGHT],
    videoWidth: el[VideoProperty.VIDEOWIDTH],
  };
  return {
    schema: 'iglu:org.whatwg/video_element/jsonschema/1-0-0',
    data: data,
  };
}
