/*
 * Copyright (c) 2021 Snowplow Analytics Ltd, 2010 Anthon Pang
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * 3. Neither the name of the copyright holder nor the names of its
 *    contributors may be used to endorse or promote products derived from
 *    this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import _ from 'lodash';
import { DockerWrapper, start, stop, fetchResults, clearCache } from '../micro';

interface MediaPlayerSchema {
  currentTime?: number;
  ended?: boolean;
  paused?: boolean;
  playbackRate?: number;
  volume?: number;
}

const makeExpectedEvent = (eventType: string, mediaPlayerSchemaExpected?: MediaPlayerSchema, htmlId = 'html5') => {
  let out = {
    context: [
      {
        schema: 'iglu:org.whatwg/media_element/jsonschema/1-0-0',
        data: {
          htmlId: htmlId,
          mediaType: 'VIDEO',
          autoPlay: false,
          buffered: [{ start: 0, end: jasmine.any(Number) }],
          controls: true,
          crossOrigin: null,
          currentSource: 'http://snowplow-js-tracker.local:8080/test-video.mp4',
          defaultMuted: true,
          defaultPlaybackRate: 1,
          disableRemotePlayback: false,
          error: null,
          networkState: jasmine.stringMatching('/NETWORK_(EMPTY|IDLE|LOADING|NO_SOURCE)/'),
          preload: jasmine.stringMatching('/auto|metadata|none|/'),
          readyState: jasmine.stringMatching('/HAVE_(NOTHING|METADATA|CURRENT_DATA|FUTURE_DATA|ENOUGH_DATA)/'),
          seekable: [{ start: 0, end: jasmine.any(Number) }],
          seeking: false,
          src: 'http://snowplow-js-tracker.local:8080/test-video.mp4',
          textTracks: [],
          fileExtension: 'mp4',
          fullscreen: false,
          pictureInPicture: false,
        },
      },
      {
        schema: 'iglu:com.snowplowanalytics.snowplow/media_player/jsonschema/1-0-0',
        data: {
          currentTime: jasmine.any(Number),
          duration: 20,
          ended: false,
          loop: false,
          muted: true,
          paused: false,
          playbackRate: 1,
          volume: 100,
          ...mediaPlayerSchemaExpected,
        },
      },
      {
        schema: 'iglu:org.whatwg/video_element/jsonschema/1-0-0',
        data: {
          autoPictureInPicture: false,
          disablePictureInPicture: false,
          poster: '',
          videoHeight: 144,
          videoWidth: 176,
        },
      },
    ],
    unstruct_event: {
      schema: 'iglu:com.snowplowanalytics.snowplow/unstruct_event/jsonschema/1-0-0',
      data: {
        schema: 'iglu:com.snowplowanalytics.snowplow/media_player_event/jsonschema/1-0-0',
        data: { type: eventType, label: 'test-label' },
      },
    },
  };
  return out;
};

const compare = (expected: any, received: any) => {
  for (let i in expected.context.length) {
    expect(expected.context[i].schema).toEqual(received.event.contexts.data[i].schema);
    expect(expected.context[i].data).toEqual(jasmine.objectContaining(received.event.contexts.data[i].data));
  }
  expect(expected.unstruct_event).toEqual(received.event.unstruct_event);
};

let docker: DockerWrapper;
let log: Array<unknown> = [];

describe('Media Tracker', () => {
  const getFirstEventOfEventType = (eventType: string) => {
    let results = log.filter((l: any) => l.event.unstruct_event.data.data.type === eventType);
    return results[results.length - 1];
  };

  if (browser.capabilities.browserName === 'internet explorer') {
    it.only('Skip IE9', () => true);
    return;
  }

  if (browser.capabilities.browserName === 'safari' && browser.capabilities.version === '8.0') {
    it.only('Skip Safari 8', () => true);
    return;
  }

  beforeAll(() => {
    browser.call(() => {
      return start().then((container) => {
        docker = container;
      });
    });

    browser.url('/index.html');
    browser.setCookies({ name: 'container', value: docker.url });
    browser.url('media/tracking.html');

    browser.waitUntil(() => $('#html5').isExisting(), {
      timeout: 10000,
      timeoutMsg: 'expected html5 after 5s',
    });

    let actions = [
      () => (document.getElementById('html5') as HTMLVideoElement).play(),
      () => (document.getElementById('html5') as HTMLVideoElement).pause(),
      () => ((document.getElementById('html5') as HTMLVideoElement).volume = 0.5),
      () => ((document.getElementById('html5') as HTMLVideoElement).playbackRate = 0.9),
      () => ((document.getElementById('html5') as HTMLVideoElement).currentTime = 18),
      () => (document.getElementById('html5') as HTMLVideoElement).play(),
    ];

    actions.forEach((a) => {
      browser.execute(a);
      browser.pause(500);
    });

    // 'ended' should be the final event, if not, try again
    browser.waitUntil(
      () => {
        return browser.call(() =>
          fetchResults(docker.url).then((result) => {
            log = result;
            return log.some((l: any) => l.event.unstruct_event.data.data.type === 'ended');
          })
        );
      },
      {
        interval: 2000,
        timeout: 60000,
        timeoutMsg: 'All events not found before timeout',
      }
    );
  });

  afterAll(() => {
    browser.waitUntil(() => {
      return browser.call(() => clearCache(docker.url));
    });
  });

  it('tracks play', () => {
    const expected = makeExpectedEvent('play');
    const received = getFirstEventOfEventType('play');
    compare(expected, received);
  });

  it('tracks pause', () => {
    const expected = makeExpectedEvent('pause', { paused: true });
    const received = getFirstEventOfEventType('pause');
    compare(expected, received);
  });

  it('tracks volume change', () => {
    const expected = makeExpectedEvent('volumechange', { volume: 50, paused: true });
    const received = getFirstEventOfEventType('volumechange');
    compare(expected, received);
  });

  it('tracks playback rate change', () => {
    const expected = makeExpectedEvent('ratechange', { volume: 50, playbackRate: 0.9, paused: true });
    const received = getFirstEventOfEventType('ratechange');
    compare(expected, received);
  });

  it('tracks seeked', () => {
    const expected = makeExpectedEvent('seeked', { volume: 50, playbackRate: 0.9, paused: true });
    const received = getFirstEventOfEventType('seeked');
    compare(expected, received);
  });

  it('tracks percentprogress', () => {
    const expected = makeExpectedEvent('percentprogress', { volume: 50, playbackRate: 0.9 });
    const received = getFirstEventOfEventType('percentprogress');
    compare(expected, received);
  });

  it('tracks ended', () => {
    const expected = makeExpectedEvent('ended', {
      volume: 50,
      playbackRate: 0.9,
      paused: true,
      ended: true,
    });
    const received = getFirstEventOfEventType('ended');
    compare(expected, received);
  });
});

describe('Media Tracker (2 videos, 1 tracker)', () => {
  if (browser.capabilities.browserName === 'internet explorer') {
    it.only('Skip IE9', () => true);
    return;
  }

  if (browser.capabilities.browserName === 'safari' && browser.capabilities.version === '8.0') {
    it.only('Skip Safari 8', () => true);
    return;
  }

  beforeAll(() => {
    browser.url('/media/tracking-2-players.html');

    browser.waitUntil(() => $('#html5').isExisting(), {
      timeout: 10000,
      timeoutMsg: 'expected html5 after 5s',
    });

    let actions = [
      () => (document.getElementById('html5') as HTMLVideoElement).play(),
      () => (document.getElementById('html5-2') as HTMLVideoElement).play(),
      () => (document.getElementById('html5') as HTMLVideoElement).pause(),
      () => (document.getElementById('html5-2') as HTMLVideoElement).pause(),
    ];

    actions.forEach((a) => {
      browser.execute(a);
      browser.pause(200);
    });

    // wait until we have 2 'pause' events
    browser.waitUntil(
      () => {
        return browser.call(() =>
          fetchResults(docker.url).then((result) => {
            log = result;
            return log.filter((l: any) => l.event.unstruct_event.data.data.type === 'pause').length === 2;
          })
        );
      },
      {
        interval: 2000,
        timeout: 60000,
        timeoutMsg: 'All events not found before timeout',
      }
    );
  });

  afterAll(() => {
    browser.waitUntil(() => {
      return browser.call(() => clearCache(docker.url));
    });
  });

  const getFirstEventOfEventTypeWithId = (eventType: string, id: string) => {
    let results = log.filter(
      (l: any) => l.event.unstruct_event.data.data.type === eventType && l.event.contexts.data[0].data.htmlId === id
    );
    return results[results.length - 1];
  };

  it('tracks two players with a single tracker', () => {
    const expectedOne = makeExpectedEvent('pause', { paused: true });
    const recievedOne = getFirstEventOfEventTypeWithId('pause', 'html5');
    compare(expectedOne, recievedOne);

    const expectedTwo = makeExpectedEvent('pause', { paused: true }, 'html5-2');
    const recievedTwo = getFirstEventOfEventTypeWithId('pause', 'html5-2');
    compare(expectedTwo, recievedTwo);
  });
});

describe('Media Tracker (1 video, 2 trackers)', () => {
  if (browser.capabilities.browserName === 'internet explorer') {
    it.only('Skip IE9', () => true);
    return;
  }

  if (browser.capabilities.browserName === 'safari' && browser.capabilities.version === '8.0') {
    it.only('Skip Safari 8', () => true);
    return;
  }

  beforeAll(() => {
    browser.url('media/tracking-2-trackers.html');

    browser.waitUntil(() => $('#html5').isExisting(), {
      timeout: 10000,
      timeoutMsg: 'expected html5 after 5s',
    });

    browser.execute(() => (document.getElementById('html5') as HTMLVideoElement).play());
    browser.pause(200);
    browser.execute(() => (document.getElementById('html5') as HTMLVideoElement).pause());

    // wait until we have 2 'pause' events
    browser.waitUntil(
      () => {
        return browser.call(() =>
          fetchResults(docker.url).then((result) => {
            log = result;
            return log.filter((l: any) => l.event.unstruct_event.data.data.type === 'pause').length === 2;
          })
        );
      },
      {
        interval: 2000,
        timeout: 60000,
        timeoutMsg: 'All events not found before timeout',
      }
    );
  });

  afterAll(() => {
    browser.call(() => {
      return stop(docker.container);
    });
  });

  const getEventsOfEventType = (eventType: string, limit: number = 1): Array<any> => {
    let results = log.filter((l: any) => l.event.unstruct_event.data.data.type === eventType);
    return results.slice(results.length - limit);
  };

  it('tracks one player with two trackers', () => {
    const expected = makeExpectedEvent('pause', { paused: true });
    const result = getEventsOfEventType('pause', 2);

    compare(expected, result[0]);
    compare(expected, result[1]);
    let tracker_names = result.map((r: any) => r.event.name_tracker);
    expect(tracker_names).toContain('sp1');
    expect(tracker_names).toContain('sp2');
  });
});
