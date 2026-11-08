import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveConsoleUnlock, sha256Hex } from './consoleUnlock.js';

const YEAR = 2026;
const PASSPHRASE = 'grab the nose';

test('sha256Hex matches the standard test vector', async () => {
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('the right passphrase with no date unlocks through Christmas', async () => {
  const expectedHash = await sha256Hex(PASSPHRASE);
  assert.deepEqual(
    await resolveConsoleUnlock({ stored: { passphrase: PASSPHRASE }, expectedHash, calendarYear: YEAR }),
    { year: 2026, month: 12, day: 25 },
  );
});

test('the right passphrase with a date previews that day', async () => {
  const expectedHash = await sha256Hex(PASSPHRASE);
  assert.deepEqual(
    await resolveConsoleUnlock({ stored: { passphrase: PASSPHRASE, date: '2026-12-14' }, expectedHash, calendarYear: YEAR }),
    { year: 2026, month: 12, day: 14 },
  );
});

test('a wrong passphrase, missing config, or nothing stored unlocks nothing', async () => {
  const expectedHash = await sha256Hex(PASSPHRASE);
  assert.equal(await resolveConsoleUnlock({ stored: { passphrase: 'nope' }, expectedHash, calendarYear: YEAR }), null);
  assert.equal(await resolveConsoleUnlock({ stored: { passphrase: PASSPHRASE }, expectedHash: '', calendarYear: YEAR }), null);
  assert.equal(await resolveConsoleUnlock({ stored: null, expectedHash, calendarYear: YEAR }), null);
  assert.equal(await resolveConsoleUnlock({ stored: { date: '2026-12-14' }, expectedHash, calendarYear: YEAR }), null);
});

test('a malformed stored date unlocks nothing rather than guessing', async () => {
  const expectedHash = await sha256Hex(PASSPHRASE);
  assert.equal(
    await resolveConsoleUnlock({ stored: { passphrase: PASSPHRASE, date: '12-14' }, expectedHash, calendarYear: YEAR }),
    null,
  );
});
