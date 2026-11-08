import { PageFlip } from 'page-flip';

import { flipbookImageUrl } from '../utils/assetUrl.js';
import { fitBookPage, nearbyPageIndexes } from '../utils/flipbookLayout.js';

const PRELOAD_RADIUS = 4;
const RESIZE_SETTLE_MS = 150;

/**
 * Mounts a page-flip book into `stage`, sized to fit it. Only pages near the open spread load, so
 * opening a 100-page issue doesn't pull ~35MB up front. page-flip can't re-fit a fixed-size book,
 * so when the stage changes size the book is rebuilt at the same page.
 * @param {HTMLElement} stage
 * @param {{
 *   issueId: string,
 *   pageCount: number,
 *   aspect: number,
 *   onFlip: (pageIndex: number) => void,
 *   onLayout: (isPortrait: boolean) => void,
 * }} options
 */
export function createBook(stage, { issueId, pageCount, aspect, onFlip, onLayout }) {
  const loadedPages = new Set();
  let pageFlip = null;
  let pageElements = [];
  let currentIndex = 0;
  let layoutKey = '';
  let resizeTimer;

  function loadAround(pageIndex) {
    for (const index of nearbyPageIndexes(pageIndex, pageCount, PRELOAD_RADIUS)) {
      loadedPages.add(index);
      const image = pageElements[index].firstElementChild;
      if (!image.getAttribute('src')) {
        image.src = flipbookImageUrl(issueId, 'page', index + 1);
      }
    }
  }

  function createPageElement(index) {
    const page = document.createElement('div');
    page.className = 'flipbook-page';
    const image = document.createElement('img');
    image.alt = `Page ${index + 1}`;
    image.draggable = false;
    image.decoding = 'async';
    if (loadedPages.has(index)) {
      image.src = flipbookImageUrl(issueId, 'page', index + 1);
    }
    page.append(image);
    return page;
  }

  function build() {
    const layout = fitBookPage({ stageWidth: stage.clientWidth, stageHeight: stage.clientHeight, aspect });
    layoutKey = `${layout.pageWidth}x${layout.pageHeight}:${layout.isPortrait}`;

    // page-flip goes portrait when its root is narrower than two pages, so the root's width is
    // what selects spreads vs single pages.
    const root = document.createElement('div');
    root.className = 'flipbook-book';
    root.style.width = `${layout.pageWidth * (layout.isPortrait ? 1 : 2)}px`;
    root.style.height = `${layout.pageHeight}px`;
    pageElements = Array.from({ length: pageCount }, (_, index) => createPageElement(index));
    stage.append(root);

    pageFlip = new PageFlip(root, {
      width: layout.pageWidth,
      height: layout.pageHeight,
      size: 'fixed',
      autoSize: false,
      usePortrait: true,
      showCover: true,
      startPage: currentIndex,
      flippingTime: 700,
      maxShadowOpacity: 0.45,
      mobileScrollSupport: false,
    });
    pageFlip.on('flip', (event) => {
      currentIndex = event.data;
      loadAround(currentIndex);
      onFlip(currentIndex);
    });
    pageFlip.loadFromHTML(pageElements);
    loadAround(currentIndex);
    onLayout(layout.isPortrait);
  }

  function rebuildIfResized() {
    const layout = fitBookPage({ stageWidth: stage.clientWidth, stageHeight: stage.clientHeight, aspect });
    if (`${layout.pageWidth}x${layout.pageHeight}:${layout.isPortrait}` === layoutKey) {
      return;
    }
    pageFlip.destroy();
    build();
  }

  const resizeObserver = new ResizeObserver(() => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(rebuildIfResized, RESIZE_SETTLE_MS);
  });

  build();
  resizeObserver.observe(stage);

  return {
    flipNext() {
      pageFlip.flipNext();
    },
    flipPrev() {
      pageFlip.flipPrev();
    },
    flipTo(pageIndex) {
      pageFlip.flip(pageIndex);
    },
    destroy() {
      window.clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      pageFlip.destroy();
    },
  };
}
