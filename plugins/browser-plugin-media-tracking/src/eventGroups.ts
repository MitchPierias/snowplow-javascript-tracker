import { SnowplowMediaEvent } from './snowplowEvents';
import { EventGroup } from './types';
import { DocumentEvent, MediaEvent } from './mediaEvents';

// IE doesn't support Object().values, so enumKeys and enumValues are needed for TS
// to be happy about getting enum values

function enumKeys<T extends Object>(enumObj: T): string[] {
  return Object.keys(enumObj).filter((k) => {
    let n = Number(k);
    return !(typeof n === 'number' && isFinite(Number(k)) && Math.floor(n) === n);
  });
}

function enumValues<T>(enumObj: T): T[keyof T][] {
  return enumKeys(enumObj).map((k) => enumObj[k as keyof T]);
}

const MediaEvents: EventGroup = enumValues(MediaEvent);
const SnowplowEvents: EventGroup = enumValues(SnowplowMediaEvent);

export const AllEvents: EventGroup = MediaEvents.concat(SnowplowEvents);

export const DefaultEvents: EventGroup = [
  MediaEvent.PAUSE,
  MediaEvent.PLAY,
  MediaEvent.SEEKED,
  MediaEvent.RATECHANGE,
  MediaEvent.VOLUMECHANGE,
  MediaEvent.ENDED,
  DocumentEvent.FULLSCREENCHANGE,
  SnowplowMediaEvent.PERCENTPROGRESS,
];

export const EventGroups: { [eventGroup: string]: EventGroup } = {
  AllEvents: AllEvents,
  DefaultEvents: DefaultEvents,
};
