export function findMediaElem(mediaId: string): HTMLAudioElement | HTMLVideoElement | null {
  let el: HTMLVideoElement | HTMLAudioElement | HTMLElement | null = document.getElementById(mediaId);

  if (el instanceof HTMLVideoElement) {
    // Plyr loads in an initial blank video with currentSrc as https://cdn.plyr.io/static/blank.mp4
    // so we need to check until currentSrc updates
    if (el.src === 'https://cdn.plyr.io/static/blank.mp4' || !el.src) {
      return null;
    }
    return el as HTMLVideoElement;
  }

  if (el && el.tagName !== 'AUDIO' && el.tagName !== 'VIDEO') {
    el = findMediaElementChild(el);
  }

  if (el) {
    if (el.tagName === 'AUDIO') return el as HTMLAudioElement;
    if (el.tagName === 'VIDEO') return el as HTMLVideoElement;
  }

  return null;
}

function findMediaElementChild(el: Element): HTMLAudioElement | HTMLVideoElement | null {
  let tags: string[] = ['AUDIO', 'VIDEO'];

  for (let tag of tags) {
    let elem = el.getElementsByTagName(tag);
    if (elem.length === 1) {
      if (tag === 'AUDIO') return elem[0] as HTMLAudioElement;
      if (tag === 'VIDEO') return elem[0] as HTMLVideoElement;
    } else if (elem.length > 1) {
      console.error(`There is more than one child ${tag.toLowerCase()} element in the provided node.`);
    }
  }
  return null;
}
