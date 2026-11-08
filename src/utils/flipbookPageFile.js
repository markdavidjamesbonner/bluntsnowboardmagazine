/**
 * File name of a rendered flipbook image, shared by the render script and the viewer.
 * @param {'page' | 'thumb'} kind
 * @param {number} pageNumber 1-based
 * @returns {string}
 */
export function flipbookPageFile(kind, pageNumber) {
  return `${kind}-${String(pageNumber).padStart(3, '0')}.webp`;
}
