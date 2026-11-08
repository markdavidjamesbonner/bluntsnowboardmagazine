import { ref } from 'vue';

import { CALENDAR_YEAR } from '../content_manifest/manifest.js';
import { parseIsoDate } from '../utils/calendarPhase.js';
import { resolveConsoleUnlock } from '../utils/consoleUnlock.js';

const STORAGE_KEY = 'blunt-console-unlock';
const EXPECTED_HASH = import.meta.env.VITE_UNLOCK_PASSPHRASE_HASH ?? '';

// Toronto date the calendar is evaluated at while unlocked from the console; null when locked.
export const consoleUnlockDate = ref(null);

function readStoredUnlock() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
  } catch (error) {
    console.error('blunt: could not read the stored unlock', error);
    return null;
  }
}

function writeStoredUnlock(stored) {
  try {
    if (stored) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    console.error('blunt: could not persist the unlock; it will last until reload', error);
  }
}

async function unlock(passphrase, date) {
  if (!EXPECTED_HASH) {
    throw new Error('blunt: console unlock is not configured (VITE_UNLOCK_PASSPHRASE_HASH is unset)');
  }
  if (typeof passphrase !== 'string') {
    throw new TypeError("blunt: usage is blunt.unlock('passphrase') or blunt.unlock('passphrase', 'YYYY-MM-DD')");
  }
  if (date !== undefined && !parseIsoDate(date)) {
    throw new TypeError(`blunt: expected a YYYY-MM-DD date, got ${JSON.stringify(date)}`);
  }

  const stored = date === undefined ? { passphrase } : { passphrase, date };
  const unlockDate = await resolveConsoleUnlock({ stored, expectedHash: EXPECTED_HASH, calendarYear: CALENDAR_YEAR });
  if (!unlockDate) {
    console.warn('blunt: wrong passphrase');
    return;
  }

  writeStoredUnlock(stored);
  consoleUnlockDate.value = unlockDate;
  console.info(date === undefined ? 'blunt: everything unlocked' : `blunt: previewing ${date}`);
}

function lock() {
  writeStoredUnlock(null);
  consoleUnlockDate.value = null;
  console.info('blunt: back to the real date');
}

export async function setupConsoleUnlock() {
  window.blunt = { unlock, lock };
  try {
    consoleUnlockDate.value = await resolveConsoleUnlock({
      stored: readStoredUnlock(),
      expectedHash: EXPECTED_HASH,
      calendarYear: CALENDAR_YEAR,
    });
  } catch (error) {
    // e.g. crypto.subtle is missing outside a secure context; the calendar still works, just locked.
    console.error('blunt: could not restore the console unlock', error);
  }
}
