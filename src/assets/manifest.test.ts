import { describe, expect, it } from 'vitest'
import { ASSET_MANIFEST } from './manifest'
import { deterministicVariant, initialAssetPayloadBytes, validateAssetManifest } from './registry'
import type { AssetManifestEntry } from './types'

const validAsset: AssetManifestEntry = {
  id: 'pilot-rock',
  biome: 'đồi',
  useCase: 'instanced rock pilot',
  deterministicVariants: ['a', 'b', 'c'],
  provider: 'polyhaven',
  polyHavenSlug: 'approved-pilot-rock',
  sourceUrl: 'https://polyhaven.com/a/approved-pilot-rock',
  license: 'CC0-1.0',
  attribution: 'Poly Haven CC0',
  sourceChecksum: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  processedChecksum: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  pack: 'web-1k',
  fileSizes: { sourceBytes: 1_024, processedBytes: 800, runtimeBytes: 640 },
  lods: [
    { id: 'lod0', triangles: 800, available: true },
    { id: 'lod1', triangles: 260, available: true },
    { id: 'lod2', triangles: 80, available: true },
  ],
  fallback: 'procedural',
  runtimeBudget: { maxInstances: 80, residentMiB: 4, preload: true, intendedUse: 'near terrain prop' },
  runtime: {
    kind: 'material',
    surface: 'terrainRock',
    repeat: [2, 2],
    files: [
      { role: 'albedo', path: '/assets/polyhaven/web-1k/pilot-rock/albedo.webp', colorSpace: 'srgb' },
      { role: 'normal', path: '/assets/polyhaven/web-1k/pilot-rock/normal.webp', colorSpace: 'linear' },
      { role: 'roughness', path: '/assets/polyhaven/web-1k/pilot-rock/roughness.webp', colorSpace: 'linear' },
    ],
  },
}

describe('asset manifest registry', () => {
  it('validates the production ledger and strict provenance fields', () => {
    expect(validateAssetManifest(ASSET_MANIFEST)).toEqual({ valid: true, errors: [] })
    expect(initialAssetPayloadBytes(ASSET_MANIFEST, 'web-1k')).toBeLessThanOrEqual(25 * 1024 * 1024)
    expect(initialAssetPayloadBytes(ASSET_MANIFEST, 'web-1k')).toBeGreaterThan(0)
    expect(initialAssetPayloadBytes(ASSET_MANIFEST, 'web-1k')).toBe(19_091_922)
    expect(validateAssetManifest([validAsset]).valid).toBe(true)
    expect(validateAssetManifest([{ ...validAsset, license: 'unknown' } as unknown as AssetManifestEntry]).valid).toBe(false)
  })

  it('selects variants deterministically and budgets only preload assets', () => {
    expect(deterministicVariant(validAsset, 'seed-a')).toBe(deterministicVariant(validAsset, 'seed-a'))
    expect(initialAssetPayloadBytes([validAsset], 'web-1k')).toBe(640)
    expect(initialAssetPayloadBytes([validAsset], 'desktop-2k')).toBe(0)
  })
})
