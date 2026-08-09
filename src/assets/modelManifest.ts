import type { AssetLod, AssetManifestEntry, AssetPackQuality } from './types'

type TreeModelVariant = 'forest' | 'hero'

interface TreeModelDefinition {
  id: string
  pack: Extract<AssetPackQuality, 'web-1k' | 'desktop-2k' | 'desktop-4k'>
  modelVariant: TreeModelVariant
  variant: string
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
  worldScale?: number
  minimumSpacing?: number
}

/**
 * Generated from verified Poly Haven source by
 * tools/assets/polyhaven-tree-model.mjs. Runtime paths always point to an
 * Aetheria package; Poly Haven is never contacted while a player is in-game.
 */
const TREE_SMALL_02_MODELS: readonly TreeModelDefinition[] = [
  {
    id: 'tree-small-02-web-1k',
    pack: 'web-1k',
    modelVariant: 'forest',
    variant: 'forest-lod2',
    relativePath: 'models/tree_small_02/tree_small_02_forest-lod2.glb',
    sourceChecksum: 'sha256:3062a709614c05b80fdc1e56583998bc3cb1027b0d52f956c8ecfb882ff8ca6d',
    processedChecksum: 'sha256:88b99351955cc7fff8bde0cb9453eed11c5a86d59eeeb98c24beac29f14cc263',
    sourceBytes: 100_974_143,
    processedBytes: 7_047_448,
    lods: [
      { id: 'lod0', triangles: 1_939_380, available: false },
      { id: 'lod1', triangles: 0, available: false },
      { id: 'lod2', triangles: 83_345, available: true },
    ],
    maxInstances: 512,
    residentMiB: 54,
    preload: false,
    intendedUse: 'Instanced foreground forest trees for the Web 1K demo.',
  },
  {
    id: 'tree-small-02-desktop-2k',
    pack: 'desktop-2k',
    modelVariant: 'forest',
    variant: 'forest-lod2',
    relativePath: 'models/tree_small_02/tree_small_02_forest-lod2.glb',
    sourceChecksum: 'sha256:a1a7c8a145c811392457c111bff8192146f655a75b5de163ec659cd32af17726',
    processedChecksum: 'sha256:f8db5842735565adbbb1f324464fdb535b8c30edbeb15bf7d8f662c2dd5884e3',
    sourceBytes: 115_328_490,
    processedBytes: 21_401_800,
    lods: [
      { id: 'lod0', triangles: 1_939_380, available: false },
      { id: 'lod1', triangles: 0, available: false },
      { id: 'lod2', triangles: 83_345, available: true },
    ],
    maxInstances: 512,
    residentMiB: 203,
    preload: false,
    intendedUse: 'Instanced forest trees for the Desktop 2K pack.',
  },
  {
    id: 'tree-small-02-desktop-4k',
    pack: 'desktop-4k',
    modelVariant: 'forest',
    variant: 'forest-lod2',
    relativePath: 'models/tree_small_02/tree_small_02_forest-lod2.glb',
    sourceChecksum: 'sha256:3e7f2fe0be398bfc944fe49186b33a10669573c4f99fbfc97e0d963678215e84',
    processedChecksum: 'sha256:af26962262a5628feafdfa2251a9cc2737757d10a10f6bbbf38ef23d0b23d904',
    sourceBytes: 160_906_572,
    processedBytes: 66_979_904,
    lods: [
      { id: 'lod0', triangles: 1_939_380, available: false },
      { id: 'lod1', triangles: 0, available: false },
      { id: 'lod2', triangles: 83_345, available: true },
    ],
    maxInstances: 512,
    residentMiB: 800,
    preload: false,
    intendedUse: 'Instanced forest trees for the Desktop 4K Ultra pack.',
  },
  {
    id: 'tree-small-02-desktop-4k-hero',
    pack: 'desktop-4k',
    modelVariant: 'hero',
    variant: 'hero-lod0',
    relativePath: 'models/tree_small_02/tree_small_02_hero-lod0.glb',
    sourceChecksum: 'sha256:3e7f2fe0be398bfc944fe49186b33a10669573c4f99fbfc97e0d963678215e84',
    processedChecksum: 'sha256:594c576708eda939e223567138d1f9e1a4a4bc563b5e5a1480fe68dd2a8b23f8',
    sourceBytes: 160_906_572,
    processedBytes: 69_231_396,
    lods: [
      { id: 'lod0', triangles: 264_378, available: true },
      { id: 'lod1', triangles: 0, available: false },
      { id: 'lod2', triangles: 0, available: false },
    ],
    maxInstances: 3,
    residentMiB: 807,
    preload: false,
    intendedUse: 'Maximum three near-camera trees for Desktop 4K photo mode.',
  },
]

/** Primary forest silhouette: wide enough to read from Aetheria's overhead camera. */
const JACARANDA_MODELS: readonly TreeModelDefinition[] = [
  {
    id: 'jacaranda-tree-web-1k',
    pack: 'web-1k',
    modelVariant: 'forest',
    variant: 'forest-lod1',
    relativePath: 'models/jacaranda_tree/jacaranda_tree_forest-lod1.glb',
    sourceChecksum: 'sha256:ba4aa8ab4c3e3741ce3699604d6ec1607cd6b126ae2d32abbcc0d98e8edb3be4',
    processedChecksum: 'sha256:20ca43714226b18f98622d99cabf0c4e45d7a75884f7bfad83baf09bcfac3cfd',
    sourceBytes: 214_609_299,
    processedBytes: 11_392_664,
    lods: [
      { id: 'lod0', triangles: 3_863_832, available: false },
      { id: 'lod1', triangles: 242_652, available: true },
      { id: 'lod2', triangles: 0, available: false },
    ],
    maxInstances: 4,
    residentMiB: 68,
    preload: false,
    worldScale: 0.07,
    minimumSpacing: 2.05,
    intendedUse: 'Legacy local forest-tree fallback; Island Tree is the active Web 1K model.',
  },
  {
    id: 'jacaranda-tree-desktop-2k',
    pack: 'desktop-2k',
    modelVariant: 'forest',
    variant: 'forest-lod1',
    relativePath: 'models/jacaranda_tree/jacaranda_tree_forest-lod1.glb',
    sourceChecksum: 'sha256:5c98732eae5a139f3883eca22766c7a523f37c2629cea1d74fd16e43cbf8a472',
    processedChecksum: 'sha256:d7923d02255112d82cbc5e9f1ea31c9e448ec611dc78a11668620357d02f121a',
    sourceBytes: 229_608_704,
    processedBytes: 26_392_100,
    lods: [
      { id: 'lod0', triangles: 3_863_832, available: false },
      { id: 'lod1', triangles: 242_652, available: true },
      { id: 'lod2', triangles: 0, available: false },
    ],
    maxInstances: 4,
    residentMiB: 224,
    preload: false,
    worldScale: 0.07,
    minimumSpacing: 2.05,
    intendedUse: 'Up to four deterministic wide-canopy foreground trees for the Desktop 2K pack.',
  },
  {
    id: 'jacaranda-tree-desktop-4k',
    pack: 'desktop-4k',
    modelVariant: 'forest',
    variant: 'forest-lod1',
    relativePath: 'models/jacaranda_tree/jacaranda_tree_forest-lod1.glb',
    sourceChecksum: 'sha256:15c954b5d5cd3a0b11d73bfa6ae391a2841b4cbfbc2045dada1c1db16d1d0c62',
    processedChecksum: 'sha256:6babfcee7a6ecfa1510d7bc8e68c4605befd45c1e080e3ee2b6ded971241fabf',
    sourceBytes: 277_591_024,
    processedBytes: 74_374_416,
    lods: [
      { id: 'lod0', triangles: 3_863_832, available: false },
      { id: 'lod1', triangles: 242_652, available: true },
      { id: 'lod2', triangles: 0, available: false },
    ],
    maxInstances: 4,
    residentMiB: 836,
    preload: false,
    worldScale: 0.07,
    minimumSpacing: 2.05,
    intendedUse: 'Up to four deterministic wide-canopy foreground trees for the Desktop 4K Ultra pack.',
  },
]

function jacarandaModelEntry(definition: TreeModelDefinition, path: string): AssetManifestEntry {
  return {
    id: definition.id,
    biome: 'forest',
    useCase: definition.intendedUse,
    deterministicVariants: [definition.variant],
    provider: 'polyhaven',
    polyHavenSlug: 'jacaranda_tree',
    sourceUrl: 'https://polyhaven.com/a/jacaranda_tree',
    license: 'CC0-1.0',
    attribution: 'Poly Haven — jacaranda_tree (CC0 1.0)',
    sourceChecksum: definition.sourceChecksum,
    processedChecksum: definition.processedChecksum,
    pack: definition.pack,
    fileSizes: {
      sourceBytes: definition.sourceBytes,
      processedBytes: definition.processedBytes,
      runtimeBytes: definition.processedBytes,
    },
    lods: definition.lods,
    fallback: 'procedural-tree',
    runtimeBudget: {
      maxInstances: definition.maxInstances,
      residentMiB: definition.residentMiB,
      preload: definition.preload,
      intendedUse: definition.intendedUse,
    },
    runtime: {
      kind: 'model',
      surface: 'foliage',
      modelType: 'tree',
      modelVariant: definition.modelVariant,
      worldScale: definition.worldScale ?? 0.07,
      minimumSpacing: definition.minimumSpacing ?? 2.05,
      files: [{ role: 'model', path, colorSpace: 'linear' }],
    },
  }
}

function treeModelEntry(definition: TreeModelDefinition, path: string): AssetManifestEntry {
  return {
    id: definition.id,
    biome: 'forest',
    useCase: definition.intendedUse,
    deterministicVariants: [definition.variant],
    provider: 'polyhaven',
    polyHavenSlug: 'tree_small_02',
    sourceUrl: 'https://polyhaven.com/a/tree_small_02',
    license: 'CC0-1.0',
    attribution: 'Poly Haven — tree_small_02 by Rico Cilliers (CC0 1.0)',
    sourceChecksum: definition.sourceChecksum,
    processedChecksum: definition.processedChecksum,
    pack: definition.pack,
    fileSizes: {
      sourceBytes: definition.sourceBytes,
      processedBytes: definition.processedBytes,
      runtimeBytes: definition.processedBytes,
    },
    lods: definition.lods,
    fallback: 'procedural-tree',
    runtimeBudget: {
      maxInstances: definition.maxInstances,
      residentMiB: definition.residentMiB,
      preload: definition.preload,
      intendedUse: definition.intendedUse,
    },
    runtime: {
      kind: 'model',
      surface: 'foliage',
      modelType: 'tree',
      modelVariant: definition.modelVariant,
      worldScale: definition.worldScale ?? 0.25,
      minimumSpacing: definition.minimumSpacing ?? 1.25,
      files: [{ role: 'model', path, colorSpace: 'linear' }],
    },
  }
}

export const WEB_MODEL_ASSET_MANIFEST: readonly AssetManifestEntry[] = JACARANDA_MODELS
  .filter((definition) => definition.pack === 'web-1k')
  .map((definition) => jacarandaModelEntry(definition, `/assets/polyhaven/${definition.pack}/${definition.relativePath}`))

/** Added only by the desktop bootstrap path; it cannot load in the Web Demo. */
export function desktopTreeModelEntries(root: string): AssetManifestEntry[] {
  const normalizedRoot = root.replace(/\/$/, '')
  return [
    ...JACARANDA_MODELS
      .filter((definition) => definition.pack !== 'web-1k')
      .map((definition) => jacarandaModelEntry(definition, `${normalizedRoot}/${definition.pack}/${definition.relativePath}`)),
    // Tree Small 02 remains available as a sparse close-up/photo-mode asset;
    // Jacaranda is listed first so the normal forest path chooses the canopy
    // that reads correctly from the isometric camera.
    ...TREE_SMALL_02_MODELS
      .filter((definition) => definition.pack !== 'web-1k')
      .map((definition) => treeModelEntry(definition, `${normalizedRoot}/${definition.pack}/${definition.relativePath}`)),
  ]
}
