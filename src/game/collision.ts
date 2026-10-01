/**
 * Returns whether the movement segment from previous to current crosses
 * or touches the inclusive collision interval [rangeMin, rangeMax].
 */
export function sweptSegmentOverlapsRange(
  previous: number,
  current: number,
  rangeMin: number,
  rangeMax: number,
): boolean {
  const segmentMin = Math.min(previous, current)
  const segmentMax = Math.max(previous, current)
  return segmentMax >= rangeMin && segmentMin <= rangeMax
}
