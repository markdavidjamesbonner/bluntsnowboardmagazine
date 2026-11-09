import { assetUrl } from '../utils/assetUrl.js';
import { ADVENT_LAST_DAY } from '../utils/calendarPhase.js';
import FLIPBOOK_PAGES from './flipbook_pages.json';
import { ISSUES } from './issues.js';
import { BURNER_DAYS } from './masthead.js';

export const CALENDAR_YEAR = 2026;

// Issues fill the non-burner days of Dec 1–25 in volume order, so the final volume lands on Christmas.
const ISSUE_DAYS = Array.from({ length: ADVENT_LAST_DAY }, (_, index) => index + 1).filter(
  (day) => !BURNER_DAYS.includes(day),
);

if (ISSUE_DAYS.length !== ISSUES.length) {
  throw new Error(`Advent calendar has ${ISSUE_DAYS.length} issue days for ${ISSUES.length} issues`);
}

function flipbookFor(issue) {
  const flipbook = FLIPBOOK_PAGES[issue.id];
  if (!flipbook) {
    throw new Error(`No rendered flipbook pages for ${issue.id}; run \`npm run flipbook\``);
  }
  return flipbook;
}

export const ENTRIES = ISSUES.map((issue, index) => ({
  day: ISSUE_DAYS[index],
  id: issue.id,
  title: `Blunt ${issue.title}`,
  number: issue.title.replace(/^Volume /, ''),
  ornamentTexture: assetUrl(`content/issues/${issue.id}/ornament.jpg`),
  flipbook: flipbookFor(issue),
}));
