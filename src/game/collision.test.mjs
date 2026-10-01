import assert from 'node:assert/strict'
import { sweptSegmentOverlapsRange } from './collision.ts'

assert.equal(
  sweptSegmentOverlapsRange(3.5, 6, 4, 5),
  true,
  'a traffic vehicle that jumps across the collision window must register as crossing it'
)

assert.equal(
  sweptSegmentOverlapsRange(0, 2, 4, 5),
  false,
  'a vehicle that stays before the collision window must not register a collision'
)

assert.equal(
  sweptSegmentOverlapsRange(6, 8, 4, 5),
  false,
  'a vehicle that stays after the collision window must not register a collision'
)

console.log('collision regression tests passed')
