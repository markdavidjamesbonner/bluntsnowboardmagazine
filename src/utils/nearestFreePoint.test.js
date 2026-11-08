import assert from 'node:assert/strict';
import { test } from 'node:test';

import { findNearestFreePoint } from './nearestFreePoint.js';

const POINTS = [
  { x: 0, y: 0, z: 0 },
  { x: 1, y: 0, z: 0 },
  { x: 0, y: 0.6, z: 0 },
];

test('picks the closest point', () => {
  assert.equal(findNearestFreePoint({ x: 0.9, y: 0, z: 0 }, POINTS, new Set(), 1), 1);
});

test('skips used points', () => {
  assert.equal(findNearestFreePoint({ x: 0.9, y: 0, z: 0 }, POINTS, new Set([1]), 1), 0);
});

test('height weight trades vertical drift for sideways drift', () => {
  const sideways = { x: 0.5, y: 0, z: 0 };
  const above = { x: 0, y: 0.4, z: 0 };
  const origin = { x: 0, y: 0, z: 0 };
  assert.equal(findNearestFreePoint(origin, [sideways, above], new Set(), 1), 1);
  assert.equal(findNearestFreePoint(origin, [sideways, above], new Set(), 2), 0);
});

test('returns -1 when everything is used', () => {
  assert.equal(findNearestFreePoint({ x: 0, y: 0, z: 0 }, POINTS, new Set([0, 1, 2]), 1), -1);
});
