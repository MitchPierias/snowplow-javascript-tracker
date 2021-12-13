# Snowplow Media Tracking

[![License][license-image]](LICENSE)

Browser Plugin to be used with `@snowplow/browser-tracker`.

Adds HTML5 Video and Audio tracking events to your Snowplow tracking.

## Maintainer quick start

Part of the Snowplow JavaScript Tracker monorepo.  
Build with [Node.js](https://nodejs.org/en/) (12 LTS or 14 LTS) and [Rush](https://rushjs.io/).

### Setup repository

```bash
npm install -g @microsoft/rush 
git clone https://github.com/snowplow/snowplow-javascript-tracker.git
rush update
```

### Package Installation

With npm:

```bash
npm install @snowplow/browser-plugin-media-tracking
```

## Usage

Initialize your tracker with the MediaTrackingPlugin:

```js
import { newTracker } from '@snowplow/browser-tracker';
import { MediaTrackingPlugin } from 'snowplow-browser-media-tracker';

newTracker('sp2', '{{collector}}', { plugins: [ MediaTrackingPlugin() ] }); // Also stores reference at module level
```

Then, use the `enableMediaTracking` function described below to produce events from your HTML5 Video/Audio element(s).

```js
enableMediaTracking({ id, options?: { label?, captureEvents?, boundaries?, volumeChangeTrackingInterval? } })
```

| Parameter                      | Type       | Default             | Description                                               | Required |
| ------------------------------ | ---------- | ------------------- | --------------------------------------------------------- | -------- |
| `id`                           | `string`   | -                   | The HTML id attribute of the media element                | Yes      |
| `label`                        | `string`   | -                   | An identifiable custom label sent with the event          | No       |
| `captureEvents`                | `string[]` | `['DefaultEvents']` | The name(s) of the events to capture                      | No       |
| `boundries`                    | `number[]` | `[10, 25, 50, 75]`  | The progress percentages to fire an event at (if enabled) | No       |
| `volumeChangeTrackingInterval` | `number`   | `250`               | The rate at which volume events can be sent               | No       |

## Example Usage

```html
  ...
  <body>
    <video id="my-video" src="my-video.mp4">
  </body>
  ...
```

```js
import { enableMediaTracking } from '@snowplow/browser-plugin-media-tracking'

enableMediaTracking({
  id: 'my-video',
  options: {
    label: "My Custom Video Label",
    captureEvents: ["pause", "volumechange", "percentprogress"],
    boundaries: [10, 25, 50, 75],
  }
})
```

## Available Events

| Name                  | Description                                                                                                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| abort                 | Fired when the resource was not fully loaded, but not as the result of an error.                                                                                                         |
| canplay               | Fired when the user agent can play the media, but estimates that not enough data has been loaded to play the media up to its end without having to stop for further buffering of content |
| canplaythrough        | Fired when the user agent can play the media, and estimates that enough data has been loaded to play the media up to its end without having to stop for further buffering of content.    |
| durationchange        | Fired when the duration attribute has been updated.                                                                                                                                      |
| emptied               | Fired when the media has become empty; for example, when the media has already been loaded (or partially loaded), and the HTMLMediaElement.load() method is called to reload it.         |
| ended                 | Fired when playback stops when end of the media (`<audio>` or `<video>`) is reached or because no further data is available.                                                             |
| error                 | Fired when the resource could not be loaded due to an error.                                                                                                                             |
| loadeddata            | Fired when the first frame of the media has finished loading.                                                                                                                            |
| loadedmetadata        | Fired when the metadata has been loaded                                                                                                                                                  |
| loadstart             | Fired when the browser has started to load a resource.                                                                                                                                   |
| pause                 | Fired when a request to pause play is handled and the activity has entered its paused state, most commonly occurring when the media's HTMLMediaElement.pause() method is called.         |
| play                  | Fired when the paused property is changed from true to false, as a result of the HTMLMediaElement.play() method, or the autoplay attribute                                               |
| playing               | Fired when playback is ready to start after having been paused or delayed due to lack of data                                                                                            |
| progress              | Fired periodically as the browser loads a resource.                                                                                                                                      |
| ratechange            | Fired when the playback rate has changed.                                                                                                                                                |
| seeked                | Fired when a seek operation completes                                                                                                                                                    |
| seeking               | Fired when a seek operation begins                                                                                                                                                       |
| stalled               | Fired when the user agent is trying to fetch media data, but data is unexpectedly not forthcoming.                                                                                       |
| suspend               | Fired when the media data loading has been suspended.                                                                                                                                    |
| timeupdate            | Fired when the time indicated by the currentTime attribute has been updated.                                                                                                             |
| volumechange          | Fired when the volume has changed.                                                                                                                                                       |
| waiting               | Fired when playback has stopped because of a temporary lack of data.                                                                                                                     |
| enterpictureinpicture |                                                                                                                                                                                          |
| leavepictureinpicture |                                                                                                                                                                                          |
| fullscreenchange      | Fired immediately after the browser switches into or out of full-screen. mode.                                                                                                            |
| cuechange | Fired when a text track has changed the currently displaying cues. |

## Copyright and license

Licensed and distributed under the [BSD 3-Clause License](LICENSE) ([An OSI Approved License][osi]).

Copyright (c) 2021 Snowplow Analytics Ltd.

All rights reserved.

[docs]: https://docs.snowplowanalytics.com/docs/collecting-data/collecting-from-own-applications/javascript-tracker/
[osi]: https://opensource.org/licenses/BSD-3-Clause
