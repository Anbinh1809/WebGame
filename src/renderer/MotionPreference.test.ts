import { describe, expect, it } from 'vitest'
import { isReducedMotion } from './MotionPreference'

describe('motion preference resolver', () => {
  it('respects a player override while preserving the system default', () => {
    expect(isReducedMotion('system', true)).toBe(true)
    expect(isReducedMotion('system', false)).toBe(false)
    expect(isReducedMotion('full', true)).toBe(false)
    expect(isReducedMotion('reduced', false)).toBe(true)
  })
})
