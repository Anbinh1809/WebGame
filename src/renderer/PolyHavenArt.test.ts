import { describe, expect, it } from 'vitest'
import { ASSET_MANIFEST } from '../assets/manifest'
import { assetForSurface } from '../assets/registry'

describe('Poly Haven Web 1K art pack', () => {
  it('contains the material surfaces needed by the procedural renderer', () => {
    const surfaces = ['terrainGrass', 'terrainForest', 'terrainRock', 'terrainSand', 'terrainSnow', 'foliage', 'trunk', 'house', 'roof', 'farm', 'road', 'environment'] as const
    for (const surface of surfaces) expect(assetForSurface(ASSET_MANIFEST, 'web-1k', surface)).toBeDefined()
  })

  it('keeps runtime files local and preserves color-space metadata', () => {
    for (const entry of ASSET_MANIFEST) {
      for (const file of entry.runtime.files) expect(file.path).toMatch(/^\/assets\/polyhaven\/web-1k\//)
      if (entry.runtime.kind === 'material') {
        expect(entry.runtime.files.find((file) => file.role === 'albedo')?.colorSpace).toBe('srgb')
        expect(entry.runtime.files.filter((file) => file.role !== 'albedo').every((file) => file.colorSpace === 'linear')).toBe(true)
      }
    }
  })
})
