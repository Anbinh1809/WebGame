import { validateAssetManifest } from './registry'
import type { AssetManifestEntry, AssetPackQuality } from './types'

const DESKTOP_PACKS = new Set<AssetPackQuality>(['desktop-2k', 'desktop-4k'])

export function desktopPackRoot(): string {
  const configured = import.meta.env.VITE_AETHERIA_DESKTOP_PACK_ROOT?.trim()
  return (configured || '/assets/polyhaven').replace(/\/$/, '')
}

export function normalizeDesktopPackManifest(
  entries: readonly AssetManifestEntry[],
  pack: Extract<AssetPackQuality, 'desktop-2k' | 'desktop-4k'>,
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
export async function loadDesktopPackManifest(pack: Extract<AssetPackQuality, 'desktop-2k' | 'desktop-4k'>): Promise<AssetManifestEntry[]> {
  if (!DESKTOP_PACKS.has(pack)) throw new Error(`Unsupported desktop pack: ${pack}.`)
  const root = desktopPackRoot()
  const response = await fetch(`${root}/${pack}/manifest.json`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Desktop pack ${pack} is unavailable.`)
  const payload: unknown = await response.json()
  if (!Array.isArray(payload)) throw new Error(`Desktop pack ${pack} manifest must be an array.`)
  return normalizeDesktopPackManifest(payload as AssetManifestEntry[], pack, root)
}
