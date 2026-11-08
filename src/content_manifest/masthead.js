const TAGLINE =
  'The complete Blunt Snowboard magazine. One day at a time, on our way to the ultimate celebration of our Lord and Savior Jesus Christ, happy holidays!';

const STATUS_BEFORE = 'Opens December 1st, hopefully – check back, set an RSS feed, ask Siri to nudge you, whatever.';
const STATUS_OPENING_DAY = 'Opens Today!';
const STATUS_OPENED = 'Opened December 1st';

// 22 issues over 25 days: these days unlock nothing, and the aside owns up to it.
const BURNER_DAY_ASIDES = {
  1: '(Not today, maybe tomorrow. As you’re aware – there’s only 22 issues and December has 25 days so we’ve gotta distract you for 3 days. Here’s one of those days.)',
  11: '(Nothing new today. There’s only 22 issues and December has 25 days so we’ve gotta burn a few days. This is 2 of 3 burners.)',
  22: '(There’s only 22 issues and December has 25 days so we’ve gotta burn one more day so the math checks out.)',
};
const ISSUE_DAY_ASIDE = '(There’s a new issue somewhere on there today. Happy Holidays!)';

export const BURNER_DAYS = Object.keys(BURNER_DAY_ASIDES).map(Number);

/**
 * @param {'before' | 'during' | 'after'} phase
 * @param {number} day Toronto day of December (only read during the calendar)
 * @returns {{ tagline: string, status: string, aside: string }}
 */
export function getMastheadCopy(phase, day) {
  if (phase === 'before') {
    return { tagline: TAGLINE, status: STATUS_BEFORE, aside: '' };
  }
  if (phase === 'after') {
    return { tagline: TAGLINE, status: STATUS_OPENED, aside: '' };
  }
  return {
    tagline: TAGLINE,
    status: day === 1 ? STATUS_OPENING_DAY : STATUS_OPENED,
    aside: BURNER_DAY_ASIDES[day] ?? ISSUE_DAY_ASIDE,
  };
}
