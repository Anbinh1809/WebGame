import type { AssetLod, AssetManifestEntry, AssetPackQuality } from './types'

interface RockModelDefinition {
  id: string
  pack: Extract<AssetPackQuality, 'web-1k' | 'desktop-2k' | 'desktop-4k'>
  relativePath: string
  sourceChecksum: string
  processedChecksum: string
  sourceBytes: number
  processedBytes: number
  lods: readonly AssetLod[]
  maxInstances: number
  residentMiB: number
  preload: boolean
  intendedUse: string
}

/**
 * Generated from verified Poly Haven source by
 * tools/assets/polyhaven-tree-model.mjs --asset rock_face_01. The generic
 * model pipeline emits only local Aetheria package paths for runtime use.
 */
const ROCK_FACE_01_MODELS: readonly RockModelDefinition[] = [
  {
    id: 'rock-face-01-web-1k',
    pack: 'web-1k',
    relativePath: 'models/rock_face_01/rock_face_01_formation-lod0.glb',
    sourceChecksum: 'sha256:96c332c01d173a2431115f3bac29be101fba341e5500e2a08e384f4edd17299e',
    processedChecksum: 'sha256:2fac2c236c0892a9642ffd248d2c02da68c00b52887ab9013a489961786c7dd1',
    sourceBytes: 3_049_988,
    processedBytes: 2_703_184,
    lods: [
      { id: 'lod0', triangles: 20_174, available: true },
      { id: 'lod1', triangles: 0, available: false },
      { id: 'lod2', triangles: 0, available: false },
    ],
    maxInstances: 12,
    residentMiB: 18,
    preload: false,
    intendedUse: 'Legacy local rock fallback; Boulder is the active Web 1K model.',
  },
  {
    id: 'rock-face-01-desktop-2k',
    pack: 'desktop-2k',
    relativePath: 'models/rock_face_01/rock_face_01_formation-lod0.glb',
    sourceChecksum: 'sha256:5ab7fa969b57de507db72627d41f1b901e11ae406e52024b1c267c7c1caad40a',
    processedChecksum: 'sha256:e8b601809d84d049174b056a760fad5aad1dc27e392740c24e121402de78c3a1',
    sourceBytes: 10_209_699,
    processedBytes: 9_862_900,
    lods: [
      { id: 'lod0', triangles: 20_174, available: true },
      { id: 'lod1', triangles: 0, available: false },
      { id: 'lod2', triangles: 0, available: false },
    ],
    maxInstances: 16,
    residentMiB: 68,
    preload: false,
    intendedUse: 'Instanced foreground rock formations for the Desktop 2K pack.',
  },
  {
    id: 'rock-face-01-desktop-4k',
    pack: 'desktop-4k',
    relativePath: 'models/rock_face_01/rock_face_01_formation-lod0.glb',
    sourceChecksum: 'sha256:8b25fe3bd2599c58ff3074d4614cb6771e5c5dd1653863c54516127dc3651034',
    processedChecksum: 'sha256:b3ffc1ce7d5d6868584e8fbf3bc45e609c5ceb48060aa9b2fc35ef0db3e6188d',
    sourceBytes: 37_027_643,
    processedBytes: 36_680_852,
    lods: [
      { id: 'lod0', triangles: 20_174, available: true },
      { id: 'lod1', triangles: 0, available: false },
      { id: 'lod2', triangles: 0, available: false },
    ],
    maxInstances: 16,
    residentMiB: 260,
    preload: false,
    intendedUse: 'Instanced foreground rock formations for the Desktop 4K Ultra pack.',
  },
]

function rockModelEntry(definition: RockModelDefinition, path: string): AssetManifestEntry {
  return {
    id: definition.id,
    biome: 'rock',
    useCase: definition.intendedUse,
    deterministicVariants: ['rock_face_01'],
    provider: 'polyhaven',
    polyHavenSlug: 'rock_face_01',
    sourceUrl: 'https://polyhaven.com/a/rock_face_01',
    license: 'CC0-1.0',
    attribution: 'Poly Haven — rock_face_01 by Dario Barresi (CC0 1.0)',
    sourceChecksum: definition.sourceChecksum,
    processedChecksum: definition.processedChecksum,
    pack: definition.pack,
    fileSizes: {
      sourceBytes: definition.sourceBytes,
      processedBytes: definition.processedBytes,
      runtimeBytes: definition.processedBytes,
    },
    lods: definition.lods,
    fallback: 'procedural-rock',
    runtimeBudget: {
      maxInstances: definition.maxInstances,
      residentMiB: definition.residentMiB,
      preload: definition.preload,
      intendedUse: definition.intendedUse,
    },
    runtime: {
      kind: 'model',
      surface: 'terrainRock',
      modelType: 'rock',
      modelVariant: 'formation',
      worldScale: 0.12,
      minimumSpacing: 0.7,
      files: [{ role: 'model', path, colorSpace: 'linear' }],
    },
  }
}

export const WEB_ROCK_MODEL_ASSET_MANIFEST: readonly AssetManifestEntry[] = ROCK_FACE_01_MODELS
  .filter((definition) => definition.pack === 'web-1k')
  .map((definition) => rockModelEntry(definition, `/assets/polyhaven/${definition.pack}/${definition.relativePath}`))

/** Added only by the desktop bootstrap path; it cannot load in the Web Demo. */
export function desktopRockModelEntries(root: string): AssetManifestEntry[] {
  const normalizedRoot = root.replace(/\/$/, '')
  return ROCK_FACE_01_MODELS
    .filter((definition) => definition.pack !== 'web-1k')
    .map((definition) => rockModelEntry(definition, `${normalizedRoot}/${definition.pack}/${definition.relativePath}`))
}
