import type { AssetLod, AssetManifestEntry, AssetModelRuntimeDefinition, AssetPackQuality } from './types'

interface ModelPackDefinition {
  sourceChecksum: string
  processedChecksum: string
  sourceBytes: number
  processedBytes: number
  triangles: number
  maxInstances: number
  residentMiB: number
  intendedUse: string
}

interface SettlementModelDefinition {
  id: string
  slug: string
  biome: string
  useCase: string
  fallback: string
  modelVariant: Extract<AssetModelRuntimeDefinition['modelVariant'], 'lantern' | 'stockpile'>
  worldScale: number
  minimumSpacing: number
  packs: Readonly<Record<AssetPackQuality, ModelPackDefinition>>
}

/**
 * These models cover the settlement decorations Poly Haven can provide at all
 * four source resolutions. Complete houses and character rigs are deliberately
 * not fabricated here: Poly Haven does not distribute those kinds of assets.
 */
const SETTLEMENT_MODELS: readonly SettlementModelDefinition[] = [
  {
    id: 'wooden-lantern-01',
    slug: 'wooden_lantern_01',
    biome: 'settlement',
    useCase: 'Authored wooden lanterns replacing primitive glowing spheres at metal-age settlements.',
    fallback: 'procedural-lantern',
    modelVariant: 'lantern',
    worldScale: 0.24,
    minimumSpacing: 0.3,
    packs: {
      'web-1k': { sourceChecksum: 'sha256:2380275a5c90bf3442c426f3363e826e6b1ceff12a7e65f83b03cc8fac70a099', processedChecksum: 'sha256:fa94ac3792aef8d99c0be06a3f4e39a892bb5624bf846f1a539c280b3f4290a8', sourceBytes: 3_768_780, processedBytes: 3_539_480, triangles: 3_430, maxInstances: 16, residentMiB: 40, intendedUse: 'Sixteen deferred Web 1K village lantern instances.' },
      'desktop-2k': { sourceChecksum: 'sha256:6f92eae1fa0286ab2efa7a9ac39966fc7ae8ca71e27fdb01260c07bf9055656f', processedChecksum: 'sha256:841ca93263415cc75b0c0830c8a45529b169f0a507d209e10049f0bb6bbf8497', sourceBytes: 13_994_569, processedBytes: 13_771_232, triangles: 4_155, maxInstances: 24, residentMiB: 160, intendedUse: 'Twenty-four deferred Desktop 2K village lantern instances.' },
      'desktop-4k': { sourceChecksum: 'sha256:24391403b8cdf8b77c301211679b0aa95e421c95ec28c0a52c94477e0c074f7b', processedChecksum: 'sha256:a9ed58fa2b1063c6506487eeec8539879e10f72bec4a5b323c7ffa61f59c50a1', sourceBytes: 54_705_067, processedBytes: 54_489_304, triangles: 5_165, maxInstances: 32, residentMiB: 640, intendedUse: 'Thirty-two deferred Desktop 4K village lantern instances.' },
      'cinema-8k': { sourceChecksum: 'sha256:df92c8daebe01cf695763231a3120e70ae7591a442fe3dd3f08f55f272d66b93', processedChecksum: 'sha256:238b62d65998abf3f67b1a3a8bddea2d8689f60d94606618949528fc629c9893', sourceBytes: 212_323_461, processedBytes: 212_112_192, triangles: 5_789, maxInstances: 40, residentMiB: 2_560, intendedUse: 'Forty capability-checked Cinema 8K village lantern instances.' },
    },
  },
  {
    id: 'wooden-barrels-01',
    slug: 'wooden_barrels_01',
    biome: 'settlement',
    useCase: 'Authored barrel stockpiles placed beside active settlement workshops.',
    fallback: 'procedural-stockpile',
    modelVariant: 'stockpile',
    worldScale: 0.15,
    minimumSpacing: 0.78,
    packs: {
      'web-1k': { sourceChecksum: 'sha256:ff785e2150198c4cdb3cc74e532b02ce9574d6a7fc3606f5801fcbf68e3136af', processedChecksum: 'sha256:b742b92328311bbcddb566023825e02cb9de08875675b4ee488e845b38bea75d', sourceBytes: 7_490_847, processedBytes: 6_508_060, triangles: 23_946, maxInstances: 16, residentMiB: 56, intendedUse: 'Sixteen deferred Web 1K workshop stockpile instances.' },
      'desktop-2k': { sourceChecksum: 'sha256:6df3e8e0c056ba12b0f560ab464119e8e9c04f0b6da8dfe4faa55fb6ab3eeffe', processedChecksum: 'sha256:822aa8f85803a7f6eeee61c50c8a322ac916067e1d7743d1931940756f4d4ac0', sourceBytes: 23_800_071, processedBytes: 22_827_212, triangles: 25_046, maxInstances: 24, residentMiB: 224, intendedUse: 'Twenty-four deferred Desktop 2K workshop stockpile instances.' },
      'desktop-4k': { sourceChecksum: 'sha256:bc314db162fb8399ed1f74b27afa61dc9425330f69d4601479ffc518fa87dc6b', processedChecksum: 'sha256:bc3252c0abd8bae121dd7c604d25fa48ffe2a7a5442dcb501b99a452e891b6e2', sourceBytes: 84_648_324, processedBytes: 83_687_472, triangles: 26_504, maxInstances: 32, residentMiB: 896, intendedUse: 'Thirty-two deferred Desktop 4K workshop stockpile instances.' },
      'cinema-8k': { sourceChecksum: 'sha256:d07bdb6f461be17f3cac4968e7e1fa334344307e902255e0e6b4de9d9c5ef1c9', processedChecksum: 'sha256:8142d861e087cbe8e7f592e8c53c3a52ec2a4b7160972a71cefe320e8ff60de5', sourceBytes: 311_413_500, processedBytes: 310_456_676, triangles: 26_972, maxInstances: 40, residentMiB: 3_584, intendedUse: 'Forty capability-checked Cinema 8K workshop stockpile instances.' },
    },
  },
]

function modelLods(triangles: number): readonly AssetLod[] {
  return [
    { id: 'lod0', triangles: 0, available: false },
    { id: 'lod1', triangles, available: true },
    { id: 'lod2', triangles: 0, available: false },
  ]
}

function modelEntry(definition: SettlementModelDefinition, pack: AssetPackQuality, path: string): AssetManifestEntry {
  const details = definition.packs[pack]
  const variant = `${definition.modelVariant}-lod1`
  return {
    id: `${definition.id}-${pack}`,
    biome: definition.biome,
    useCase: definition.useCase,
    deterministicVariants: [variant],
    provider: 'polyhaven',
    polyHavenSlug: definition.slug,
    sourceUrl: `https://polyhaven.com/a/${definition.slug}`,
    license: 'CC0-1.0',
    attribution: `Poly Haven — ${definition.slug} (CC0 1.0)`,
    sourceChecksum: details.sourceChecksum,
    processedChecksum: details.processedChecksum,
    pack,
    fileSizes: { sourceBytes: details.sourceBytes, processedBytes: details.processedBytes, runtimeBytes: details.processedBytes },
    lods: modelLods(details.triangles),
    fallback: definition.fallback,
    runtimeBudget: {
      maxInstances: details.maxInstances,
      residentMiB: details.residentMiB,
      preload: false,
      intendedUse: details.intendedUse,
    },
    runtime: {
      kind: 'model',
      surface: 'house',
      modelType: 'settlementProp',
      modelVariant: definition.modelVariant,
      worldScale: definition.worldScale,
      minimumSpacing: definition.minimumSpacing,
      files: [{ role: 'model', path, colorSpace: 'linear' }],
    },
  }
}

export const WEB_SETTLEMENT_MODEL_ASSET_MANIFEST: readonly AssetManifestEntry[] = SETTLEMENT_MODELS
  .map((definition) => modelEntry(
    definition,
    'web-1k',
    `/assets/polyhaven/web-1k/models/${definition.slug}/${definition.slug}_${definition.modelVariant}-lod1.glb`,
  ))

/** Added only by the desktop bootstrap path; Web Demo never discovers desktop packs. */
export function desktopSettlementModelEntries(root: string): AssetManifestEntry[] {
  const normalizedRoot = root.replace(/\/$/, '')
  const desktopPacks: readonly Exclude<AssetPackQuality, 'web-1k'>[] = ['desktop-2k', 'desktop-4k', 'cinema-8k']
  return desktopPacks.flatMap((pack) => SETTLEMENT_MODELS.map((definition) => {
    const variant = `${definition.modelVariant}-lod1`
    return modelEntry(definition, pack, `${normalizedRoot}/${pack}/models/${definition.slug}/${definition.slug}_${variant}.glb`)
  }))
}
