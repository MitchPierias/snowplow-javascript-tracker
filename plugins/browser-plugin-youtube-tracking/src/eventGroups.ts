import { SnowplowEvent } from './snowplowEvents';
import { EventGroup } from './types';
import { YTPlayerEvent, YTState } from './constants';
import { YTEvent } from './youtubeEvents';

export const AllEvents: EventGroup = [...Object.keys(YTEvent), ...Object.keys(SnowplowEvent)];

export const DefaultEvents: EventGroup = [
  YTState.PAUSED,
  YTState.PLAYING,
  SnowplowEvent.SEEK,
  YTPlayerEvent.ONPLAYBACKQUALITYCHANGE,
  YTPlayerEvent.ONPLAYBACKRATECHANGE,
  SnowplowEvent.PERCENTPROGRESS,
];

export const EventGroups: Record<string, EventGroup> = {
  AllEvents: AllEvents,
  DefaultEvents: DefaultEvents,
};
