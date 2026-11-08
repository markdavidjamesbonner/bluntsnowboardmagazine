import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getCalendarPhase, getTorontoDate, parseDateOverride, parseIsoDate } from './calendarPhase.js';

const YEAR = 2026;

test('Toronto midnight, not UTC midnight, flips the day', () => {
  // 04:59 UTC on Dec 1 is still 23:59 Nov 30 in Toronto (EST, UTC-5).
  assert.deepEqual(getTorontoDate(new Date('2026-12-01T04:59:00Z')), { year: 2026, month: 11, day: 30 });
  assert.deepEqual(getTorontoDate(new Date('2026-12-01T05:00:00Z')), { year: 2026, month: 12, day: 1 });
});

test('before December everything is locked', () => {
  assert.deepEqual(getCalendarPhase({ year: 2026, month: 11, day: 30 }, YEAR), { phase: 'before', unlockedThroughDay: 0 });
  assert.deepEqual(getCalendarPhase({ year: 2025, month: 12, day: 15 }, YEAR), { phase: 'before', unlockedThroughDay: 0 });
});

test('December 1–25 unlocks through today', () => {
  assert.deepEqual(getCalendarPhase({ year: 2026, month: 12, day: 1 }, YEAR), { phase: 'during', unlockedThroughDay: 1 });
  assert.deepEqual(getCalendarPhase({ year: 2026, month: 12, day: 25 }, YEAR), { phase: 'during', unlockedThroughDay: 25 });
});

test('from December 26 the full archive is open', () => {
  assert.deepEqual(getCalendarPhase({ year: 2026, month: 12, day: 26 }, YEAR), { phase: 'after', unlockedThroughDay: 25 });
  assert.deepEqual(getCalendarPhase({ year: 2027, month: 1, day: 1 }, YEAR), { phase: 'after', unlockedThroughDay: 25 });
});

test('date override parses strict YYYY-MM-DD only', () => {
  assert.deepEqual(parseDateOverride('?date=2026-12-14'), { year: 2026, month: 12, day: 14 });
  assert.equal(parseDateOverride('?date=12-14'), null);
  assert.equal(parseDateOverride(''), null);
});

test('ISO dates parse strict YYYY-MM-DD only', () => {
  assert.deepEqual(parseIsoDate('2026-12-14'), { year: 2026, month: 12, day: 14 });
  assert.equal(parseIsoDate('2026-12-14T00:00'), null);
  assert.equal(parseIsoDate(undefined), null);
});
