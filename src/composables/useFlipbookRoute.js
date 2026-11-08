import { onBeforeUnmount, onMounted, ref } from 'vue';

import { flipbookHash, parseFlipbookHash } from '../utils/flipbookRoute.js';

// The open flipbook lives in the URL hash (#/issue-12) so it can be shared and Back closes it.
export function useFlipbookRoute() {
  const routeIssueId = ref(parseFlipbookHash(window.location.hash));
  // Only step back through history for flipbooks opened here; a shared link that landed on the
  // flipbook directly has nothing of ours behind it, so closing just clears the hash.
  let hasOpenedInPage = false;

  const sync = () => {
    routeIssueId.value = parseFlipbookHash(window.location.hash);
    if (!routeIssueId.value) {
      hasOpenedInPage = false;
    }
  };

  function openIssue(issueId) {
    hasOpenedInPage = true;
    window.location.hash = flipbookHash(issueId);
  }

  function closeIssue() {
    if (hasOpenedInPage) {
      window.history.back();
      return;
    }
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    sync();
  }

  onMounted(() => window.addEventListener('hashchange', sync));
  onBeforeUnmount(() => window.removeEventListener('hashchange', sync));

  return { routeIssueId, openIssue, closeIssue };
}
