import { describe, expect, it } from 'vitest'
import { effectiveQualityFor, qualitySettings } from './quality'

describe('render quality profiles', () => {
  it('uses bounded DPR profiles and lowers auto quality under sustained low FPS', () => {
    expect(qualitySettings('low').maxDpr).toBe(1)
    expect(qualitySettings('medium').maxDpr).toBe(1.5)
    expect(qualitySettings('high').maxDpr).toBe(2)
    expect(qualitySettings('low').rainDropCount).toBeLessThan(qualitySettings('high').rainDropCount)
    expect(effectiveQualityFor('auto', 32, 'high')).toBe('low')
    expect(effectiveQualityFor('auto', 60, 'low')).toBe('medium')
  })
})
