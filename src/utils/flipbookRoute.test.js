import assert from 'node:assert/strict';
import { test } from 'node:test';

import { flipbookHash, parseFlipbookHash } from './flipbookRoute.js';

test('reads the issue id from a flipbook hash', () => {
  assert.equal(parseFlipbookHash('#/issue-12'), 'issue-12');
  assert.equal(parseFlipbookHash('#/issue-03-1'), 'issue-03-1');
});

test('ignores empty and unrelated hashes', () => {
  assert.equal(parseFlipbookHash(''), null);
  assert.equal(parseFlipbookHash('#'), null);
  assert.equal(parseFlipbookHash('#/'), null);
  assert.equal(parseFlipbookHash('#issue-12'), null);
});

test('round-trips through flipbookHash', () => {
  assert.equal(parseFlipbookHash(flipbookHash('issue-03-4')), 'issue-03-4');
});
