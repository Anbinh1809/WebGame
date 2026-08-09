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

interface EnvironmentModelDefinition {
  id: string
  slug: string
  biome: string
  useCase: string
  fallback: string
  surface: AssetModelRuntimeDefinition['surface']
  modelType: AssetModelRuntimeDefinition['modelType']
  modelVariant: AssetModelRuntimeDefinition['modelVariant']
  worldScale: number
  minimumSpacing: number
  packs: Readonly<Record<AssetPackQuality, ModelPackDefinition>>
}

const ENVIRONMENT_MODELS: readonly EnvironmentModelDefinition[] = [
  {
    id: 'island-tree-01',
    slug: 'island_tree_01',
    biome: 'forest',
    useCase: 'Primary instanced forest canopy for the simulation world.',
    fallback: 'procedural-tree',
    surface: 'foliage',
    modelType: 'tree',
    modelVariant: 'forest',
    worldScale: 0.18,
    minimumSpacing: 1.5,
    packs: {
      'web-1k': { sourceChecksum: 'sha256:78e905a40670bfabb2760601d4d9a6c17193a50d68e6271c66893eb7bd75906d', processedChecksum: 'sha256:e7dead09014873f773ab24e81007952875dfd8ad60521158b1b699ec5d541832', sourceBytes: 66_337_268, processedBytes: 6_616_452, triangles: 41_280, maxInstances: 6, residentMiB: 86, intendedUse: 'Six sparse Web 1K island-tree instances.' },
      'desktop-2k': { sourceChecksum: 'sha256:6024cf385e9e0add29030925f8b891de264b813948f1cb9fb95633e256f50dc7', processedChecksum: 'sha256:fea2ad4961146c2942003b746bb922208d4323bdaf1a879bb6375358371b1dfe', sourceBytes: 79_783_969, processedBytes: 20_544_776, triangles: 65_309, maxInstances: 10, residentMiB: 266, intendedUse: 'Ten sparse Desktop 2K island-tree instances.' },
      'desktop-4k': { sourceChecksum: 'sha256:3b37e932540931fa714df65e009b709e8ce1a40989e4635e65787bdbda1f7407', processedChecksum: 'sha256:28a94241421fb10070097cbaa2434bc3244330824c397d79a756c23ce6f506e6', sourceBytes: 124_477_658, processedBytes: 65_408_756, triangles: 75_436, maxInstances: 14, residentMiB: 910, intendedUse: 'Fourteen sparse Desktop 4K island-tree instances.' },
      'cinema-8k': { sourceChecksum: 'sha256:bc55ee07fa3b53b284814df651fe3763a18a7c6e1b0b68a79f8d6624ab195b21', processedChecksum: 'sha256:ad446712a466f7c47b200ab4c66f7f5eca8215473a29b4f0f8217503d068e354', sourceBytes: 267_470_009, processedBytes: 208_747_044, triangles: 99_755, maxInstances: 18, residentMiB: 3_620, intendedUse: 'Eighteen capability-checked Cinema 8K island-tree instances.' },
    },
  },
  {
    id: 'fern-02',
    slug: 'fern_02',
    biome: 'forest-floor',
    useCase: 'Instanced natural ground-cover replacing the flat procedural grass clump.',
    fallback: 'procedural-ground-cover',
    surface: 'foliage',
    modelType: 'groundCover',
    modelVariant: 'ground',
    worldScale: 0.26,
    minimumSpacing: 0.42,
    packs: {
      'web-1k': { sourceChecksum: 'sha256:33974295ee19670af4877705fc7d91f33f42d6302f0d44a625e072271223031f', processedChecksum: 'sha256:d161f3caf805008617b7a480a0ea79fcd7c6327da457c7761926676184ba2c0d', sourceBytes: 1_146_361, processedBytes: 1_017_984, triangles: 5_210, maxInstances: 20, residentMiB: 18, intendedUse: 'Twenty Web 1K forest-floor fern instances.' },
      'desktop-2k': { sourceChecksum: 'sha256:50540d37531f93fd693d5340d5b3095c9d6d2834fa05c74bea797d54f290cb6a', processedChecksum: 'sha256:eda225eeb97ee4f2708b2b0780705f4606a66edc52a98a3db87d1baae52c657e', sourceBytes: 3_393_249, processedBytes: 3_266_560, triangles: 5_466, maxInstances: 36, residentMiB: 48, intendedUse: 'Thirty-six Desktop 2K forest-floor fern instances.' },
      'desktop-4k': { sourceChecksum: 'sha256:7d5d458d4be38edceff922586234fa906377db5257e66d7cdde34b37e79788f7', processedChecksum: 'sha256:1d6b98beb0fdc027175b7841d8a9c7da61727e759e99956457f4ad7b8bbc28f5', sourceBytes: 10_836_560, processedBytes: 10_711_704, triangles: 5_721, maxInstances: 52, residentMiB: 146, intendedUse: 'Fifty-two Desktop 4K forest-floor fern instances.' },
      'cinema-8k': { sourceChecksum: 'sha256:0a3d7d65c0754b17af75415ef2f23cbfab933cfb0072c4a3ae9ba5ddf52f8522', processedChecksum: 'sha256:b7e19adabae332bca76545334fb855487fd1b7b1ff74292cd577d42271380175', sourceBytes: 32_747_108, processedBytes: 32_624_004, triangles: 5_970, maxInstances: 72, residentMiB: 548, intendedUse: 'Seventy-two capability-checked Cinema 8K fern instances.' },
    },
  },
  {
    id: 'coast-rocks-05',
    slug: 'coast_rocks_05',
    biome: 'coast',
    useCase: 'Instanced shoreline rock detail replacing the procedural sand/pebble cluster.',
    fallback: 'procedural-coast-detail',
    surface: 'terrainSand',
    modelType: 'coastRock',
    modelVariant: 'coast',
    worldScale: 0.24,
    minimumSpacing: 0.95,
    packs: {
      'web-1k': { sourceChecksum: 'sha256:4b5e97d42b4d9e1999ee5961922adc6b5d81f4aad34219915def7975bb2a8eb7', processedChecksum: 'sha256:c36272ea0fea3a6aa9572b28564ef6a9b5481be37ad6193d92c62f51cabec1d3', sourceBytes: 25_281_108, processedBytes: 3_852_388, triangles: 108_033, maxInstances: 12, residentMiB: 28, intendedUse: 'Twelve Web 1K shoreline rock instances.' },
      'desktop-2k': { sourceChecksum: 'sha256:731e3c8651c6afd097b91e9d0100ef23e874f34f1f2bc0a741f3c07b0f38eb29', processedChecksum: 'sha256:01e6808b6f893fe626888cb92b1f5bd8f54ba040784cf3f64533a3931ea3037e', sourceBytes: 33_576_450, processedBytes: 12_323_356, triangles: 138_899, maxInstances: 18, residentMiB: 86, intendedUse: 'Eighteen Desktop 2K shoreline rock instances.' },
      'desktop-4k': { sourceChecksum: 'sha256:4c1b5d21e1e110f1bd60927d76e754df694edf93e47a40326a935f552bcd18ea', processedChecksum: 'sha256:544c0eb9cbb4c624321579ff02b0d68f1e8166904ad635d3beebc707608e35f9', sourceBytes: 62_221_099, processedBytes: 41_140_732, triangles: 169_766, maxInstances: 24, residentMiB: 282, intendedUse: 'Twenty-four Desktop 4K shoreline rock instances.' },
      'cinema-8k': { sourceChecksum: 'sha256:9bc42a0c05b9816ab056ec95d4b0843c07e05428b0e9e913bb5988aa6795f73b', processedChecksum: 'sha256:eedb0477f3ee0932a1d4e5ab6430b9ad01a305dc9250df3f09c84134a2c9692b', sourceBytes: 160_241_610, processedBytes: 139_419_188, triangles: 216_080, maxInstances: 32, residentMiB: 1_130, intendedUse: 'Thirty-two capability-checked Cinema 8K shoreline rock instances.' },
    },
  },
  {
    id: 'boulder-01',
    slug: 'boulder_01',
    biome: 'rock',
    useCase: 'Primary instanced hillside boulder replacing the compact procedural rock.',
    fallback: 'procedural-rock',
    surface: 'terrainRock',
    modelType: 'rock',
    modelVariant: 'formation',
    worldScale: 0.34,
    minimumSpacing: 0.7,
    packs: {
      'web-1k': { sourceChecksum: 'sha256:51487934db898b4c24072780a451e34eca5c02e3ada24a62bbc600bbc4019e92', processedChecksum: 'sha256:27040425d2b95d6504fb5009f0da6b1689a1d9333b6c9efb2d0d70a5141170bd', sourceBytes: 5_771_986, processedBytes: 3_492_516, triangles: 55_320, maxInstances: 10, residentMiB: 20, intendedUse: 'Ten Web 1K hillside boulder instances.' },
      'desktop-2k': { sourceChecksum: 'sha256:52d118b56748a18509e4ec0075d07b254d72a0401793f22363c0bb3a682e7361', processedChecksum: 'sha256:904cd5af3cd8b9447ec14dddd74f7cd8a3e5151ce2050da7d3c9c926ecb9e717', sourceBytes: 13_536_339, processedBytes: 11_263_648, triangles: 56_038, maxInstances: 16, residentMiB: 62, intendedUse: 'Sixteen Desktop 2K hillside boulder instances.' },
      'desktop-4k': { sourceChecksum: 'sha256:1d0f157fdb8878dad735efea2c7a85870cef12f9844615677e2b6a532fafbc49', processedChecksum: 'sha256:e3659833c03f121ebe330e30c073d9f11ff0674bf2f3c116b7794daef796aa08', sourceBytes: 43_247_536, processedBytes: 40_989_244, triangles: 57_464, maxInstances: 20, residentMiB: 198, intendedUse: 'Twenty Desktop 4K hillside boulder instances.' },
      'cinema-8k': { sourceChecksum: 'sha256:bb9ab25f9f547d27cd6847409133718e16e5eb612138396c750c9e3d8e0d80e7', processedChecksum: 'sha256:7d6bec0ebed8b9a5de91ac8e38868b9210782aab262aa8650af838e05f3b0b27', sourceBytes: 157_334_257, processedBytes: 155_093_620, triangles: 59_414, maxInstances: 28, residentMiB: 786, intendedUse: 'Twenty-eight capability-checked Cinema 8K hillside boulder instances.' },
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

function modelEntry(definition: EnvironmentModelDefinition, pack: AssetPackQuality, path: string): AssetManifestEntry {
  const details = definition.packs[pack]
  const variant = definition.modelVariant === 'forest' ? 'forest-lod1'
    : definition.modelVariant === 'ground' ? 'ground-lod1'
      : definition.modelVariant === 'coast' ? 'coast-lod1'
        : 'formation-lod1'
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
      surface: definition.surface,
      modelType: definition.modelType,
      modelVariant: definition.modelVariant,
      worldScale: definition.worldScale,
      minimumSpacing: definition.minimumSpacing,
      files: [{ role: 'model', path, colorSpace: 'linear' }],
    },
  }
}

export const WEB_ENVIRONMENT_MODEL_ASSET_MANIFEST: readonly AssetManifestEntry[] = ENVIRONMENT_MODELS
  .map((definition) => modelEntry(
    definition,
    'web-1k',
    `/assets/polyhaven/web-1k/models/${definition.slug}/${definition.slug}_${definition.modelVariant === 'forest' ? 'forest-lod1' : definition.modelVariant === 'ground' ? 'ground-lod1' : definition.modelVariant === 'coast' ? 'coast-lod1' : 'formation-lod1'}.glb`,
  ))

/** Added only by the desktop bootstrap path; the Web Demo cannot fetch desktop packs. */
export function desktopEnvironmentModelEntries(root: string): AssetManifestEntry[] {
  const normalizedRoot = root.replace(/\/$/, '')
  const desktopPacks: readonly Exclude<AssetPackQuality, 'web-1k'>[] = ['desktop-2k', 'desktop-4k', 'cinema-8k']
  return desktopPacks.flatMap((pack) => ENVIRONMENT_MODELS.map((definition) => {
    const variant = definition.modelVariant === 'forest' ? 'forest-lod1'
      : definition.modelVariant === 'ground' ? 'ground-lod1'
        : definition.modelVariant === 'coast' ? 'coast-lod1'
          : 'formation-lod1'
    return modelEntry(definition, pack, `${normalizedRoot}/${pack}/models/${definition.slug}/${definition.slug}_${variant}.glb`)
  }))
}
