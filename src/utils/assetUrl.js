import { flipbookPageFile } from './flipbookPageFile.js';

// Public-dir paths are written base-relative so the build works at a domain root or a subpath.
export function assetUrl(relativePath) {
  return `${import.meta.env.BASE_URL}${relativePath}`;
}

// Rendered flipbook pages (~600MB) never ship with the static build. Dev/preview serve them from
// the local flipbook_pages/ folder at /flipbook/; production points VITE_FLIPBOOK_BASE_URL at
// wherever they end up hosted.
export function flipbookImageUrl(issueId, kind, pageNumber) {
  const base = import.meta.env.VITE_FLIPBOOK_BASE_URL || assetUrl('flipbook/');
  return `${base}${issueId}/${flipbookPageFile(kind, pageNumber)}`;
}
