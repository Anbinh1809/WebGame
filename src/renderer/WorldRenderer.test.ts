import { describe, expect, it } from 'vitest'
import { hasWebGlSupport, isPngDataUrl, MAX_PHOTO_PIXELS, photoDimensionsFor } from './WorldRenderer'

describe('WebGL and photo fallback guards', () => {
  it('identifies an unavailable WebGL canvas so the viewport can show its retry fallback', () => {
    expect(hasWebGlSupport({ getContext: () => null })).toBe(false)
  })

  it('recognizes a valid PNG data URL returned by photo mode', () => {
    expect(isPngDataUrl('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ')).toBe(true)
    expect(isPngDataUrl('data:image/jpeg;base64,/9j/4AAQ')).toBe(false)
  })

  it('keeps high-resolution photo buffers inside the declared memory guard', () => {
    const dimensions = photoDimensionsFor(4096, 4096)
    expect(dimensions.width * dimensions.height).toBeLessThanOrEqual(MAX_PHOTO_PIXELS)
    expect(photoDimensionsFor(100, 100)).toEqual({ width: 150, height: 150 })
  })
})
