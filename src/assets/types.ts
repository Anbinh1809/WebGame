export const ASSET_PACK_QUALITIES = ['web-1k', 'desktop-2k', 'desktop-4k', 'cinema-8k'] as const

/** Source resolution of game art, never the player's display resolution. */
export type AssetPackQuality = (typeof ASSET_PACK_QUALITIES)[number]

export type AssetFallback = 'procedural' | string

export type AssetMaterialSurface =
  | 'terrainGrass'
  | 'terrainForest'
  | 'terrainRock'
  | 'terrainSand'
  | 'terrainSnow'
  | 'foliage'
  | 'trunk'
  | 'house'
  | 'roof'
  | 'farm'
  | 'road'
  | 'environment'

export type AssetRuntimeFileRole = 'albedo' | 'normal' | 'roughness' | 'environment' | 'model'

export interface AssetRuntimeFile {
  role: AssetRuntimeFileRole
  path: string
  colorSpace: 'srgb' | 'linear'
}

export interface AssetMaterialRuntimeDefinition {
  kind: 'material' | 'environment'
  surface: AssetMaterialSurface
  files: readonly AssetRuntimeFile[]
  repeat?: readonly [number, number]
}

/** A mesh asset is curated separately from tileable PBR materials. */
export interface AssetModelRuntimeDefinition {
  kind: 'model'
  surface: 'foliage'
  modelType: 'tree'
  modelVariant: 'forest' | 'hero'
  /** World-unit scale chosen during offline asset curation, never inferred from texture resolution. */
  worldScale: number
  /** Keeps deterministic instances from overlapping when an asset has a broad canopy. */
  minimumSpacing: number
  files: readonly AssetRuntimeFile[]
}

export type AssetRuntimeDefinition = AssetMaterialRuntimeDefinition | AssetModelRuntimeDefinition

export interface AssetFileSizes {
  sourceBytes: number
  processedBytes: number
  runtimeBytes: number
}

export interface AssetLod {
  id: 'lod0' | 'lod1' | 'lod2'
  triangles: number
  available: boolean
}

export interface AssetRuntimeBudget {
  maxInstances: number
  residentMiB: number
  preload: boolean
  intendedUse: string
}

/**
 * Every external production asset is curated before it is admitted here. The
 * manifest stores provenance and runtime limits instead of relying on remote
 * URLs at play time.
 */
export interface AssetManifestEntry {
  id: string
  biome: string
  useCase: string
  deterministicVariants: readonly string[]
  provider: 'polyhaven'
  polyHavenSlug: string
  sourceUrl: string
  license: 'CC0-1.0'
  attribution: string
  sourceChecksum: string
  processedChecksum: string
  pack: AssetPackQuality
  fileSizes: AssetFileSizes
  lods: readonly AssetLod[]
  fallback: AssetFallback
  runtimeBudget: AssetRuntimeBudget
  runtime: AssetRuntimeDefinition
}

export interface AssetManifestValidation {
  valid: boolean
  errors: string[]
}
