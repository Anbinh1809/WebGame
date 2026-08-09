import { describe, expect, it } from 'vitest'
import { assetPackForQualityProfile, DESKTOP_TEXTURE_PACKS } from './edition'

describe('edition graphics pack mapping', () => {
  it('maps explicit graphics tiers to the requested Poly Haven source resolution', () => {
    expect(assetPackForQualityProfile('low')).toBe('web-1k')
    expect(assetPackForQualityProfile('medium')).toBe('desktop-2k')
    expect(assetPackForQualityProfile('high')).toBe('desktop-4k')
    expect(assetPackForQualityProfile('ultra')).toBe('cinema-8k')
    expect(assetPackForQualityProfile('auto')).toBeUndefined()
    expect(DESKTOP_TEXTURE_PACKS).toContain('cinema-8k')
  })
})
