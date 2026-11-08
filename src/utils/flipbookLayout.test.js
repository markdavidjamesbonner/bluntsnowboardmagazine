import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fitBookPage, nearbyPageIndexes, spreadPageIndexes } from './flipbookLayout.js';

const ASPECT = 0.8;

test('a wide desktop stage shows spreads limited by height', () => {
  assert.deepEqual(fitBookPage({ stageWidth: 1440, stageHeight: 760, aspect: ASPECT }), {
    pageWidth: 608,
    pageHeight: 760,
    isPortrait: false,
  });
});

test('an upright phone shows one page at a time, limited by width', () => {
  assert.deepEqual(fitBookPage({ stageWidth: 390, stageHeight: 700, aspect: ASPECT }), {
    pageWidth: 389,
    pageHeight: 487,
    isPortrait: true,
  });
});

test('spreads: cover alone, then pairs, then a lone back page', () => {
  assert.deepEqual(spreadPageIndexes(0, 52, false), [0]);
  assert.deepEqual(spreadPageIndexes(1, 52, false), [1, 2]);
  assert.deepEqual(spreadPageIndexes(2, 52, false), [1, 2]);
  assert.deepEqual(spreadPageIndexes(51, 52, false), [51]);
  assert.deepEqual(spreadPageIndexes(49, 51, false), [49, 50]);
});

test('portrait shows a single page', () => {
  assert.deepEqual(spreadPageIndexes(7, 52, true), [7]);
});

test('nearby pages stay inside the book', () => {
  assert.deepEqual(nearbyPageIndexes(0, 52, 2), [0, 1, 2, 3]);
  assert.deepEqual(nearbyPageIndexes(10, 52, 2), [8, 9, 10, 11, 12, 13]);
  assert.deepEqual(nearbyPageIndexes(51, 52, 2), [49, 50, 51]);
});
