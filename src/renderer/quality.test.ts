import { describe, expect, it } from 'vitest'
import {
  canApplyAutoQualityChange,
  capQualityForMobile,
  createGraphicsQualityOverrides,
  effectiveQualityFor,
  qualityForProfileChange,
  qualitySettings,
  renderFrameIntervalMs,
  resolveGraphicsQuality,
  waterSegmentsFor,
} from './quality'

describe('render quality profiles', () => {
  it('uses bounded DPR profiles and lowers auto quality under sustained low FPS', () => {
    expect(qualitySettings('low').maxDpr).toBe(0.8)
    expect(qualitySettings('medium').maxDpr).toBe(1.25)
    expect(qualitySettings('high').maxDpr).toBe(2)
    expect(qualitySettings('ultra').shadowMapSize).toBe(4096)
    expect(qualitySettings('low').rainDropCount).toBeLessThan(qualitySettings('high').rainDropCount)
    expect(qualitySettings('high').rainDropCount).toBeLessThan(qualitySettings('ultra').rainDropCount)
    expect(qualitySettings('low').groundDetailDensity).toBe(0)
    expect(qualitySettings('low').vegetationDensity).toBeLessThan(qualitySettings('medium').vegetationDensity)
    expect(effectiveQualityFor('auto', 32, 'high')).toBe('low')
    expect(effectiveQualityFor('auto', 60, 'low')).toBe('medium')
  })

  it('caps compact viewports and uses a cooldown before auto changes quality again', () => {
    expect(capQualityForMobile('high', true)).toBe('medium')
    expect(capQualityForMobile('ultra', true)).toBe('medium')
    expect(capQualityForMobile('high', false)).toBe('high')
    expect(canApplyAutoQualityChange(2_999, 0)).toBe(false)
    expect(canApplyAutoQualityChange(3_000, 0)).toBe(true)
  })

  it('starts Auto at a safe low profile before measured frames can promote it', () => {
    expect(qualityForProfileChange('auto', 'auto', 'low')).toBe('low')
    expect(qualityForProfileChange('auto', 'high', 'high')).toBe('low')
    expect(qualityForProfileChange('high', 'auto', 'low')).toBe('high')
  })

  it('gives expensive render work its own cadence and supports uncapped FPS', () => {
    expect(renderFrameIntervalMs('uncapped')).toBe(0)
    expect(renderFrameIntervalMs('vsync')).toBe(0)
    expect(renderFrameIntervalMs('144')).toBeCloseTo(1000 / 144)
    expect(renderFrameIntervalMs('60')).toBeCloseTo(1000 / 60)
    expect(renderFrameIntervalMs('30')).toBeCloseTo(1000 / 30)
    expect(qualitySettings('medium').motionUpdateIntervalMs).toBeGreaterThan(qualitySettings('high').motionUpdateIntervalMs)
    expect(qualitySettings('medium').shadowUpdateIntervalMs).toBeGreaterThan(qualitySettings('high').shadowUpdateIntervalMs)
    expect(qualitySettings('high').shadowUpdateIntervalMs).toBeGreaterThan(qualitySettings('ultra').shadowUpdateIntervalMs)
  })

  it('reduces water mesh detail deterministically for low quality', () => {
    expect(waterSegmentsFor('low', 36)).toBe(9)
    expect(waterSegmentsFor('medium', 36)).toBe(20)
    expect(waterSegmentsFor('high', 36)).toBe(36)
    expect(waterSegmentsFor('ultra', 36)).toBe(47)
    expect(waterSegmentsFor('low', Number.NaN)).toBe(6)
  })

  it('lets individual graphics sections inherit or override the global quality', () => {
    const overrides = createGraphicsQualityOverrides({ shadows: 'ultra', water: 'low' })
    expect(resolveGraphicsQuality(overrides.scene, 'high')).toBe('high')
    expect(resolveGraphicsQuality(overrides.shadows, 'low')).toBe('ultra')
    expect(resolveGraphicsQuality(overrides.water, 'ultra')).toBe('low')
  })
})
