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

import { AllEvents, DefaultEvents } from '../src/eventGroups';
import { findMediaElem } from '../src/findMediaElement';
import { boundryErrorHandling, dataUrlHandler, trackingOptionsParser } from '../src/helperFunctions';
import { MediaTrackingOptions, TrackingOptions } from '../src/types';

describe('config parser', () => {
  const id = 'html5';

  const default_output: TrackingOptions = {
    mediaId: 'html5',
    captureEvents: DefaultEvents,
    progress: {
      boundries: [10, 25, 50, 75],
      boundryTimeoutIds: [],
    },
  };

  it('assigns defaults', () => {
    let test = trackingOptionsParser(id);
    expect(test).toEqual(default_output);
  });

  it('parses boundries', () => {
    let trackingOptions: MediaTrackingOptions = {
      captureEvents: DefaultEvents,
      boundries: [1, 4, 7, 9, 99],
    };
    let expected_output = [1, 4, 7, 9, 99];
    expect(trackingOptionsParser(id, trackingOptions).progress?.boundries).toEqual(expected_output);
  });

  it('parses mediaLabel', () => {
    let trackingOptions: MediaTrackingOptions = {
      label: 'test-label',
    };
    let expected_output = 'test-label';
    expect(trackingOptionsParser(id, trackingOptions).label).toEqual(expected_output);
  });

  it('parses capture events', () => {
    let trackingOptions: MediaTrackingOptions = {
      captureEvents: ['play', 'pause'],
    };
    let expected_output = ['play', 'pause'];
    expect(trackingOptionsParser(id, trackingOptions).captureEvents).toEqual(expected_output);
  });

  it('parses capture event groups', () => {
    let trackingOptions: MediaTrackingOptions = {
      captureEvents: ['AllEvents'],
    };
    let expected_output = AllEvents;
    expect(trackingOptionsParser(id, trackingOptions).captureEvents).toEqual(expected_output);
  });

  it('parses capture events and groups in same array', () => {
    let trackingOptions: MediaTrackingOptions = {
      captureEvents: ['DefaultEvents', 'resize'],
    };
    let expected_output = DefaultEvents.concat(['resize']);
    expect(trackingOptionsParser(id, trackingOptions).captureEvents).toEqual(expected_output);
  });
});

describe('boundry error handling', () => {
  it("doesn't modify an acceptable boundry array", () => {
    let boundries = [1, 50, 99];
    let result = boundryErrorHandling(boundries);
    expect(result).toEqual(boundries);
  });

  it('removes values outside 1-99', () => {
    let boundries = [0, 50, 100];
    let result = boundryErrorHandling(boundries);
    expect(result).toEqual([50]);
  });

  it('removes duplicates', () => {
    let boundries = [10, 10, 50, 90, 90];
    let result = boundryErrorHandling(boundries);
    expect(result).toEqual([10, 50, 90]);
  });

  it('removes values outside 1-99 and removes duplicates', () => {
    let boundries = [0, 0, 1, 1, 50, 100, 100];
    let result = boundryErrorHandling(boundries);
    expect(result).toEqual([1, 50]);
  });
});

describe('element searcher', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('finds a video with id', () => {
    document.body.innerHTML = '<div><video id="videoElem" src="test.mp4"</video></div>';
    let output = findMediaElem('videoElem');
    expect(output?.tagName).toBe('VIDEO');
    expect(output?.id).toBe('videoElem');
  });

  it('finds a child video element in parent with id', () => {
    document.body.innerHTML = '<div id="parentElem"><video></video></div>';
    let output = findMediaElem('parentElem');
    expect(output?.tagName).toBe('VIDEO');
  });

  it('logs an error and returns null if multiple child audio elements exist in a parent', () => {
    document.body.innerHTML = '<div id="parentElem"><audio></audio><audio></audio></div>';
    let output = findMediaElem('parentElem');
    expect(output).toBe(null);
    expect(consoleSpy.mock.calls[0][0]).toEqual('There is more than one child audio element in the provided node.');
  });

  it('logs an error and returns null if multiple child video elements exist in a parent', () => {
    document.body.innerHTML = '<div id="parentElem"><video></video><video></video></div>';
    let output = findMediaElem('parentElem');
    expect(output).toBe(null);
    expect(consoleSpy.mock.calls[0][0]).toEqual('There is more than one child video element in the provided node.');
  });
});

describe('dataUrlHandler', () => {
  it('returns a non-data uri', () => {
    let test_url = 'http://example.com/example.mp4';
    let output = dataUrlHandler(test_url);
    expect(output).toBe(test_url);
  });

  it('returns "DATA_URI" in event of data uri', () => {
    let test_url = 'data:image/png;base64,iVBORw0KGgoAA5ErkJggg==';
    let output = dataUrlHandler(test_url);
    expect(output).toBe('DATA_URI');
  });
});
