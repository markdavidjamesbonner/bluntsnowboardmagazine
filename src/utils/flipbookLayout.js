// Spreads are only worth it while they keep pages at least this big relative to a single page.
const MIN_SPREAD_SCALE = 0.75;

/**
 * Largest page that fits the stage, as a two-page spread when there's room or one page at a time
 * (portrait) when a spread would shrink pages too far, e.g. on a phone held upright.
 * @param {{ stageWidth: number, stageHeight: number, aspect: number }} stage aspect = page width / height
 * @returns {{ pageWidth: number, pageHeight: number, isPortrait: boolean }}
 */
export function fitBookPage({ stageWidth, stageHeight, aspect }) {
  const singlePageHeight = Math.min(stageHeight, stageWidth / aspect);
  const spreadPageHeight = Math.min(stageHeight, stageWidth / (2 * aspect));
  const isPortrait = spreadPageHeight < singlePageHeight * MIN_SPREAD_SCALE;
  const pageHeight = Math.floor(isPortrait ? singlePageHeight : spreadPageHeight);
  return { pageWidth: Math.floor(pageHeight * aspect), pageHeight, isPortrait };
}

/**
 * Page indexes visible together: the cover alone, then left/right pairs, then a lone back page.
 * @param {number} pageIndex any page in the spread (0-based)
 * @param {number} pageCount
 * @param {boolean} isPortrait
 * @returns {number[]}
 */
export function spreadPageIndexes(pageIndex, pageCount, isPortrait) {
  if (isPortrait || pageIndex === 0) {
    return [pageIndex];
  }
  const left = pageIndex % 2 === 1 ? pageIndex : pageIndex - 1;
  return left + 1 < pageCount ? [left, left + 1] : [left];
}

/**
 * Pages worth loading around the current one: the visible spread plus a couple of spreads each way.
 * @param {number} pageIndex 0-based
 * @param {number} pageCount
 * @param {number} radius pages on each side
 * @returns {number[]}
 */
export function nearbyPageIndexes(pageIndex, pageCount, radius) {
  const first = Math.max(0, pageIndex - radius);
  const last = Math.min(pageCount - 1, pageIndex + radius + 1);
  return Array.from({ length: last - first + 1 }, (_, offset) => first + offset);
}
