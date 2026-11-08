/**
 * Index of the point closest to `target` that isn't in `usedIndices` (or -1 if none are left).
 * Height mismatch is weighted by `heightWeight`, so a vertical layout (a spiral, a column of
 * ornaments) keeps its spacing rather than sliding sideways onto a slightly closer point.
 * @param {{ x: number, y: number, z: number }} target
 * @param {Array<{ x: number, y: number, z: number }>} points
 * @param {Set<number>} usedIndices
 * @param {number} heightWeight
 * @returns {number}
 */
export function findNearestFreePoint(target, points, usedIndices, heightWeight) {
  let bestIndex = -1;
  let bestScore = Infinity;
  points.forEach((point, index) => {
    if (usedIndices.has(index)) {
      return;
    }
    const dx = point.x - target.x;
    const dy = (point.y - target.y) * heightWeight;
    const dz = point.z - target.z;
    const score = dx * dx + dy * dy + dz * dz;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
}
