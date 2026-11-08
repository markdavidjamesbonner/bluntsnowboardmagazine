const HASH_PREFIX = '#/';

/**
 * Issue id named by a flipbook link like `#/issue-12`, or null for any other hash.
 * @param {string} hash `window.location.hash`
 * @returns {string | null}
 */
export function parseFlipbookHash(hash) {
  if (!hash.startsWith(HASH_PREFIX)) {
    return null;
  }
  const issueId = decodeURIComponent(hash.slice(HASH_PREFIX.length)).trim();
  return issueId || null;
}

/**
 * @param {string} issueId
 * @returns {string}
 */
export function flipbookHash(issueId) {
  return `${HASH_PREFIX}${encodeURIComponent(issueId)}`;
}
