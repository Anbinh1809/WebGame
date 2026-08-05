import { seedToUint32 } from '../world/prng'
import type { AssetManifestEntry, AssetManifestValidation, AssetPackQuality, AssetMaterialSurface } from './types'

const CHECKSUM_PATTERN = /^sha256:[a-f0-9]{64}$/
const URL_PATTERN = /^https:\/\/polyhaven\.com\//

export function validateAssetManifest(entries: readonly AssetManifestEntry[]): AssetManifestValidation {
  const errors: string[] = []
  const ids = new Set<string>()

  for (const entry of entries) {
    if (!entry.id || ids.has(entry.id)) errors.push(`Asset id phải là duy nhất: ${entry.id || '(trống)'}.`)
    ids.add(entry.id)
    if (entry.provider !== 'polyhaven') errors.push(`${entry.id}: provider phải là polyhaven.`)
    if (!entry.polyHavenSlug) errors.push(`${entry.id}: thiếu Poly Haven slug.`)
    if (!URL_PATTERN.test(entry.sourceUrl)) errors.push(`${entry.id}: source URL phải trỏ đến Poly Haven.`)
    if (entry.license !== 'CC0-1.0') errors.push(`${entry.id}: license phải là CC0-1.0.`)
    if (!entry.attribution.trim()) errors.push(`${entry.id}: thiếu attribution text.`)
    if (!CHECKSUM_PATTERN.test(entry.sourceChecksum)) errors.push(`${entry.id}: source checksum không hợp lệ.`)
    if (!CHECKSUM_PATTERN.test(entry.processedChecksum)) errors.push(`${entry.id}: processed checksum không hợp lệ.`)
    if (entry.deterministicVariants.length === 0) errors.push(`${entry.id}: cần ít nhất một biến thể deterministic.`)
    if (entry.lods.length !== 3 || !entry.lods.every((lod, index) => lod.id === `lod${index}` && lod.triangles >= 0)) {
      errors.push(`${entry.id}: cần LOD0, LOD1 và LOD2 hợp lệ.`)
    }
    if (entry.fileSizes.sourceBytes <= 0 || entry.fileSizes.processedBytes <= 0 || entry.fileSizes.runtimeBytes <= 0) {
      errors.push(`${entry.id}: file sizes phải lớn hơn 0.`)
    }
    if (entry.runtimeBudget.maxInstances < 1 || entry.runtimeBudget.residentMiB <= 0 || !entry.runtimeBudget.intendedUse.trim()) {
      errors.push(`${entry.id}: runtime budget không hợp lệ.`)
    }
    const runtimeFiles = entry.runtime.files
    if (entry.runtime.kind === 'model' && (
      entry.runtime.modelType !== 'tree'
      || !entry.runtime.modelVariant
      || entry.runtime.worldScale <= 0
      || entry.runtime.minimumSpacing <= 0
      || runtimeFiles.length !== 1
      || runtimeFiles[0]?.role !== 'model'
    )) {
      errors.push(`${entry.id}: invalid tree model runtime.`)
    }
    if (runtimeFiles.length === 0 || runtimeFiles.some((file) => !file.path.startsWith('/assets/polyhaven/') || !file.path.trim())) {
      errors.push(`${entry.id}: runtime files phải là asset Poly Haven đóng gói cục bộ.`)
    }
    if (entry.runtime.kind === 'material') {
      const roles = new Set(runtimeFiles.map((file) => file.role))
      if (!roles.has('albedo') || !roles.has('normal') || !roles.has('roughness')) {
        errors.push(`${entry.id}: material cần albedo, normal và roughness map.`)
      }
      if (!entry.runtime.repeat || entry.runtime.repeat.some((value) => value <= 0)) {
        errors.push(`${entry.id}: material cần repeat texture hợp lệ.`)
      }
    } else if (entry.runtime.kind === 'environment' && (entry.runtime.surface !== 'environment' || runtimeFiles.some((file) => file.role !== 'environment'))) {
      errors.push(`${entry.id}: environment asset không hợp lệ.`)
    }
  }

  return { valid: errors.length === 0, errors }
}

/** A stable variant key prevents visual rerolls on React or renderer updates. */
export function deterministicVariant(entry: AssetManifestEntry, worldSeed: string): string {
  const index = seedToUint32(`${worldSeed}:${entry.id}`) % entry.deterministicVariants.length
  return entry.deterministicVariants[index] ?? entry.deterministicVariants[0] ?? entry.id
}

export function assetsForPack(entries: readonly AssetManifestEntry[], pack: AssetPackQuality): AssetManifestEntry[] {
  return entries.filter((entry) => entry.pack === pack)
}

export function assetForSurface(
  entries: readonly AssetManifestEntry[],
  pack: AssetPackQuality,
  surface: AssetMaterialSurface,
): AssetManifestEntry | undefined {
  return assetsForPack(entries, pack).find((entry) => entry.runtime.surface === surface)
}

/** Only preload-marked assets count toward first playable payload. */
export function initialAssetPayloadBytes(entries: readonly AssetManifestEntry[], pack: AssetPackQuality): number {
  return assetsForPack(entries, pack)
    .filter((entry) => entry.runtimeBudget.preload)
    .reduce((total, entry) => total + entry.fileSizes.runtimeBytes, 0)
}
