import { validateAssetManifest } from './registry'
import type { AssetManifestEntry, AssetPackQuality } from './types'

export type DesktopAssetPackQuality = Exclude<AssetPackQuality, 'web-1k'>
export type DesktopPackAvailability = Record<DesktopAssetPackQuality, boolean>

const DESKTOP_PACK_LIST: readonly DesktopAssetPackQuality[] = ['desktop-2k', 'desktop-4k', 'cinema-8k']
const DESKTOP_PACKS = new Set<DesktopAssetPackQuality>(DESKTOP_PACK_LIST)

function emptyDesktopPackAvailability(): DesktopPackAvailability {
  return { 'desktop-2k': false, 'desktop-4k': false, 'cinema-8k': false }
}

export function desktopPackRoot(): string {
  const configured = import.meta.env.VITE_AETHERIA_DESKTOP_PACK_ROOT?.trim()
  return (configured || '/assets/polyhaven').replace(/\/$/, '')
}

export function normalizeDesktopPackManifest(
  entries: readonly AssetManifestEntry[],
  pack: DesktopAssetPackQuality,
  root = '/assets/polyhaven',
): AssetManifestEntry[] {
  const baseUrl = `${root.replace(/\/$/, '')}/${pack}`
  const normalized = entries.map((entry) => ({
    ...entry,
    pack,
    runtime: {
      ...entry.runtime,
      files: entry.runtime.files.map((file) => {
        if (/^(?:https?:)?\/\//.test(file.path)) throw new Error(`${entry.id}: desktop runtime path must stay local.`)
        return { ...file, path: `${baseUrl}/${file.path.replace(/^\.?\//, '')}` }
      }),
    },
  }))
  const validation = validateAssetManifest(normalized)
  if (!validation.valid) throw new Error(`Desktop pack ${pack} is invalid: ${validation.errors.join(' ')}`)
  return normalized
}

/** Desktop-only path. The Web Demo never fetches these external pack manifests. */
export async function loadDesktopPackManifest(pack: DesktopAssetPackQuality): Promise<AssetManifestEntry[]> {
  if (!DESKTOP_PACKS.has(pack)) throw new Error(`Unsupported desktop pack: ${pack}.`)
  const root = desktopPackRoot()
  const response = await fetch(`${root}/${pack}/manifest.json`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Desktop pack ${pack} is unavailable.`)
  const payload: unknown = await response.json()
  if (!Array.isArray(payload)) throw new Error(`Desktop pack ${pack} manifest must be an array.`)
  return normalizeDesktopPackManifest(payload as AssetManifestEntry[], pack, root)
}

/**
 * A desktop selector opens only packs whose local manifest can be read and
 * validated. It deliberately does not probe Cinema 8K before entitlement.
 */
export async function probeDesktopPackAvailability(
  packs: readonly DesktopAssetPackQuality[] = DESKTOP_PACK_LIST,
): Promise<DesktopPackAvailability> {
  const checks = await Promise.all(packs.map(async (pack) => {
    try {
      await loadDesktopPackManifest(pack)
      return [pack, true] as const
    } catch {
      return [pack, false] as const
    }
  }))
  const availability = emptyDesktopPackAvailability()
  for (const [pack, available] of checks) availability[pack] = available
  return availability
}
