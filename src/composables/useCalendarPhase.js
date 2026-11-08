import { onBeforeUnmount, onMounted, ref } from 'vue';

import { getCalendarPhase, getTorontoDate, parseDateOverride } from '../utils/calendarPhase.js';

// Re-evaluated every 30s and when the tab regains focus, so an open page unlocks at
// Toronto midnight without a reload.
const RECHECK_INTERVAL_MS = 30_000;

export function useCalendarPhase(calendarYear) {
  const dateOverride = import.meta.env.DEV ? parseDateOverride(window.location.search) : null;

  const evaluate = () => getCalendarPhase(dateOverride ?? getTorontoDate(new Date()), calendarYear);

  const initial = evaluate();
  const phase = ref(initial.phase);
  const unlockedThroughDay = ref(initial.unlockedThroughDay);

  const refresh = () => {
    const next = evaluate();
    phase.value = next.phase;
    unlockedThroughDay.value = next.unlockedThroughDay;
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      refresh();
    }
  };

  let intervalId;
  onMounted(() => {
    intervalId = window.setInterval(refresh, RECHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', handleVisibilityChange);
  });
  onBeforeUnmount(() => {
    window.clearInterval(intervalId);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  });

  return { phase, unlockedThroughDay };
}
