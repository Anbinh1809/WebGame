import type { AssetPackQuality } from '../assets/types'
import type { GameEdition } from '../renderer/AssetPackManager'
import type { QualityProfile } from '../renderer/quality'

export const GAME_EDITION: GameEdition = import.meta.env.VITE_AETHERIA_EDITION === 'desktop' ? 'desktop' : 'web-demo'
export const IS_DESKTOP_EDITION = GAME_EDITION === 'desktop'

export const DESKTOP_TEXTURE_PACKS: readonly AssetPackQuality[] = ['web-1k', 'desktop-2k', 'desktop-4k', 'cinema-8k']

export const ASSET_PACK_LABELS: Record<AssetPackQuality, string> = {
  'web-1k': '1K',
  'desktop-2k': '2K',
  'desktop-4k': '4K',
  'cinema-8k': '8K',
}

/** Explicit global choices map to the requested Poly Haven source resolution. */
export function assetPackForQualityProfile(profile: QualityProfile): AssetPackQuality | undefined {
  if (profile === 'low') return 'web-1k'
  if (profile === 'medium') return 'desktop-2k'
  if (profile === 'high') return 'desktop-4k'
  if (profile === 'ultra') return 'cinema-8k'
  return undefined
}
