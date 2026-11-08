import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BURNER_DAYS, getMastheadCopy } from './masthead.js';

test('burner days are Dec 1, 3, and 4', () => {
  assert.deepEqual(BURNER_DAYS, [1, 3, 4]);
});

test('before December promises an opening with no aside', () => {
  const copy = getMastheadCopy('before', 0);
  assert.match(copy.status, /^Opens maybe December 1st/);
  assert.equal(copy.aside, '');
});

test('Dec 1 says it opens today, then admits it does not', () => {
  const copy = getMastheadCopy('during', 1);
  assert.equal(copy.status, 'Opens Today!');
  assert.match(copy.aside, /^\(Not today, maybe tomorrow\./);
});

test('the other burner days get their own asides', () => {
  assert.match(getMastheadCopy('during', 3).aside, /2 of 3 of those burners/);
  assert.match(getMastheadCopy('during', 4).aside, /burn one more day/);
});

test('issue days point at the new ornament', () => {
  const copy = getMastheadCopy('during', 14);
  assert.equal(copy.status, 'Opened December 1st');
  assert.match(copy.aside, /new issue somewhere on there today/);
});

test('after Christmas there is nothing left to tease', () => {
  const copy = getMastheadCopy('after', 25);
  assert.equal(copy.status, 'Opened December 1st');
  assert.equal(copy.aside, '');
});
