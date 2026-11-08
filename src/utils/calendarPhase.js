export const UNLOCK_TIME_ZONE = 'America/Toronto';
export const ADVENT_LAST_DAY = 25;

const torontoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: UNLOCK_TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

export function getTorontoDate(now) {
  const parts = Object.fromEntries(
    torontoDateFormatter.formatToParts(now).map((part) => [part.type, part.value]),
  );
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

/**
 * @param {{ year: number, month: number, day: number }} date Toronto calendar date
 * @param {number} calendarYear the December this calendar runs in
 * @returns {{ phase: 'before' | 'during' | 'after', unlockedThroughDay: number }}
 */
export function getCalendarPhase(date, calendarYear) {
  if (date.year < calendarYear || (date.year === calendarYear && date.month < 12)) {
    return { phase: 'before', unlockedThroughDay: 0 };
  }
  if (date.year === calendarYear && date.day <= ADVENT_LAST_DAY) {
    return { phase: 'during', unlockedThroughDay: date.day };
  }
  return { phase: 'after', unlockedThroughDay: ADVENT_LAST_DAY };
}

// Dev-only "?date=YYYY-MM-DD" so every phase can be previewed without touching the clock.
export function parseDateOverride(search) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(new URLSearchParams(search).get('date') ?? '');
  if (!match) {
    return null;
  }
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}
