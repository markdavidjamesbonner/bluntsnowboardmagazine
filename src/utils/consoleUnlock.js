import { ADVENT_LAST_DAY, parseIsoDate } from './calendarPhase.js';

export async function sha256Hex(text) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * The passphrase itself is what's stored, and it's re-hashed on every load, so a stored unlock
 * can't be forged by reading the expected hash out of the bundle.
 * @param {{ stored: { passphrase?: string, date?: string } | null, expectedHash: string, calendarYear: number }} options
 * @returns {Promise<{ year: number, month: number, day: number } | null>} Toronto date to evaluate the calendar at
 */
export async function resolveConsoleUnlock({ stored, expectedHash, calendarYear }) {
  if (!expectedHash || typeof stored?.passphrase !== 'string') {
    return null;
  }
  if ((await sha256Hex(stored.passphrase)) !== expectedHash) {
    return null;
  }
  if (stored.date === undefined || stored.date === null) {
    return { year: calendarYear, month: 12, day: ADVENT_LAST_DAY };
  }
  return parseIsoDate(stored.date);
}
