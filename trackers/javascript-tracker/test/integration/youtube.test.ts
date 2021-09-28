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

import { DockerWrapper, start, stop, fetchResults, clearCache } from '../micro';

interface MediaPlayerSchema {
  currentTime?: number;
  ended?: boolean;
  paused?: boolean;
  playbackRate?: number;
  volume?: number;
}

const makeExpectedEvent = (eventType: string, mediaPlayerSchemaExpected?: MediaPlayerSchema, playerId = 'youtube') => {
  return {
    context: [
      {
        schema: 'iglu:org.youtube/youtube/jsonschema/1-0-0',
        data: {
          avaliablePlaybackRates: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
          availableQualityLevels: ['small', 'medium', 'large', 'hd720', 'hd1080', 'highres', 'auto'],
          playbackQuality: jasmine.stringMatching(/small|medium|large|hd720|hd1080|highres|auto/),
          cued: false,
          playerId: playerId,
          autoPlay: false,
          buffering: false,
          controls: false,
          error: jasmine.stringMatching(/INVALID_PARAMETER|HTML5_PLAYER_ERROR|NOT_FOUND|EMBED_DISALLOWED/),
          loaded: jasmine.any(Number),
          origin: null,
          playlist: null,
          playlistIndex: null,
          unstarted: false,
          url: 'https://www.youtube.com/watch?v=YSOntr9COeM',
          fov: null,
          roll: null,
          pitch: null,
          yaw: null,
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
    ],
    unstruct_event: {
      schema: 'iglu:com.snowplowanalytics.snowplow/unstruct_event/jsonschema/1-0-0',
      data: {
        schema: 'iglu:com.snowplowanalytics.snowplow/media_player_event/jsonschema/1-0-0',
        data: { type: eventType, label: 'test-label' },
      },
    },
  };
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

describe('YouTube Tracker', () => {
  let player: WebdriverIO.Element;

  const getFirstEventOfEventType = (eventType: string): any => {
    let results = log.filter((l: any) => l.event.unstruct_event.data.data.type === eventType);
    return results[results.length - 1];
  };

  if (browser.capabilities.browserName === 'internet explorer' && browser.capabilities.version === '9') {
    fit('Skip IE 9', () => true);
    return;
  }

  if (
    (browser.capabilities.browserName === 'internet explorer' && browser.capabilities.browserVersion === '10') ||
    browser.capabilities.browserVersion === '11'
  ) {
    fit('Skip IE 10 and 11', () => true);
    return;
  }

  if (browser.capabilities.browserName === 'chrome' && process.platform === 'darwin') {
    fit('Skip Chrome on MacOS', () => true);
    return;
  }

  if (browser.capabilities.browserName === 'safari' && browser.capabilities.version === '8.0') {
    fit('Skip Safari 8', () => true);
    return;
  }

  if (browser.capabilities.browserName === 'MicrosoftEdge' && browser.capabilities.browserVersion === '13.10586') {
    fit('Skip Edge 13', () => true);
    return;
  }

  if (browser.capabilities.browserName === 'firefox' && browser.capabilities.version === '53.0') {
    fit('Skip Firefox 53', () => true);
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
    browser.url('/youtube/tracking.html');
    browser.waitUntil(() => $('#youtube').isExisting(), {
      timeout: 5000,
      timeoutMsg: 'expected youtube after 5s',
    });

    player = $('#youtube');
    browser.pause(2000);
    player.click(); // emits 'playbackqualitychange' and 'play';

    browser.waitUntil(
      () => {
        return browser.call(() =>
          fetchResults(docker.url).then((result) => {
            return result.length;
          })
        );
      },
      {
        interval: 5000,
        timeout: 60000,
        timeoutMsg: 'No results after 60s',
      }
    );

    const events = [
      () => player.keys(['Shift', '.', 'Shift']), // Increase playback rate
      () => player.keys(['ArrowRight']), // Seek
      () => player.keys(['ArrowDown']), // Volume down
      () => player.keys(['k']), // Pause
    ];

    events.forEach((e: any) => {
      e();
      browser.pause(2000);
    });

    browser.waitUntil(
      () => {
        return browser.call(() =>
          fetchResults(docker.url).then((result) => {
            log = result;
            return log.some((l: any) => l.event.unstruct_event.data.data.type === 'pause');
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
    const expected = makeExpectedEvent('pause');
    const received = getFirstEventOfEventType('pause');
    compare(expected, received);
  });

  it('tracks seek', () => {
    const expected = makeExpectedEvent('seek');
    const received = getFirstEventOfEventType('seek');
    compare(expected, received);
  });

  it('tracks playback quality change', () => {
    const expected = makeExpectedEvent('playbackqualitychange');
    const received = getFirstEventOfEventType('playbackqualitychange');
    compare(expected, received);
  });

  it('tracks volume change', () => {
    const expected = makeExpectedEvent('volumechange');
    const received = getFirstEventOfEventType('volumechange');
    compare(expected, received);
  });

  it('tracks playback rate change', () => {
    const expected = makeExpectedEvent('playbackratechange');
    const received = getFirstEventOfEventType('playbackratechange');
    compare(expected, received);
  });
});

describe('YouTube Tracker (2 videos, 1 tracker)', () => {
  const getFirstEventOfEventTypeWithId = (eventType: string, id: string) => {
    const results = log.filter(
      (l: any) => l.event.unstruct_event.data.data.type === eventType && l.event.contexts.data[0].data.playerId === id
    );
    return results[results.length - 1];
  };

  beforeAll(() => {
    browser.call(() => {
      return start().then((container) => {
        docker = container;
      });
    });

    browser.url('/index.html');
    browser.setCookies({ name: 'container', value: docker.url });
    browser.url('/youtube/tracking-2-videos.html');
    browser.waitUntil(() => $('#youtube').isExisting(), {
      timeout: 5000,
      timeoutMsg: 'expected youtube after 5s',
    });

    const player1 = $('#youtube');
    const player2 = $('#youtube-2');
    browser.pause(2000);

    const actions = [
      () => player1.click(), // emits 'playbackqualitychange' and 'play';
      () => player1.keys(['k']), // Pause
      () => player2.click(), // emits 'playbackqualitychange' and 'play';
      () => player2.keys(['k']), // Pause
    ];

    actions.forEach((a: Function) => {
      a();
      browser.pause(1000);
    });

    browser.waitUntil(
      () => {
        return browser.call(() =>
          fetchResults(docker.url).then((result) => {
            log = result;
            return Array.from(new Set(log.map((l: any) => l.event.contexts.data[0].data.playerId))).length === 2;
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

  it('Tracks 2 YouTube players with a single tracker', () => {
    const expectedOne = makeExpectedEvent('playbackqualitychange', { paused: true });
    const recievedOne = getFirstEventOfEventTypeWithId('playbackqualitychange', 'youtube');
    compare(expectedOne, recievedOne);

    const expectedTwo = makeExpectedEvent('playbackqualitychange', { paused: true }, 'youtube-2');
    const recievedTwo = getFirstEventOfEventTypeWithId('playbackqualitychange', 'youtube-2');
    compare(expectedTwo, recievedTwo);
  });
});

describe('YouTube Tracker (1 video, 2 trackers)', () => {
  beforeAll(() => {
    browser.call(() => {
      return start().then((container) => {
        docker = container;
      });
    });

    browser.url('/index.html');
    browser.setCookies({ name: 'container', value: docker.url });
    browser.url('/youtube/tracking-2-trackers.html');
    browser.waitUntil(() => $('#youtube').isExisting(), {
      timeout: 5000,
      timeoutMsg: 'expected youtube after 5s',
    });

    const player1 = $('#youtube');

    browser.pause(2000);
    player1.click(); // emits 'playbackqualitychange' and 'play';
    browser.pause(500);
    player1.keys(['k']); // Pause

    browser.waitUntil(
      () => {
        return browser.call(() =>
          fetchResults(docker.url).then((result) => {
            log = result;
            return (
              log.filter((l: any) => l.event.unstruct_event.data.data.type === 'playbackqualitychange').length === 2
            );
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
    const results = log.filter((l: any) => l.event.unstruct_event.data.data.type === eventType);
    return results.slice(results.length - limit);
  };

  it('Tracks 2 YouTube players with a single tracker', () => {
    const expected = makeExpectedEvent('playbackqualitychange', { paused: true });
    const result = getEventsOfEventType('playbackqualitychange', 2);
    compare(expected, result[0]);
    compare(expected, result[1]);
    const tracker_names = result.map((r: any) => r.event.name_tracker);
    expect(tracker_names).toContain('sp1');
    expect(tracker_names).toContain('sp2');
  });
});
