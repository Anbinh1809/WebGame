import type { AssetPackQuality } from '../assets/types'
import type { GameEdition } from '../renderer/AssetPackManager'

export const GAME_EDITION: GameEdition = import.meta.env.VITE_AETHERIA_EDITION === 'desktop' ? 'desktop' : 'web-demo'
export const IS_DESKTOP_EDITION = GAME_EDITION === 'desktop'

export const DESKTOP_TEXTURE_PACKS: readonly AssetPackQuality[] = ['web-1k', 'desktop-2k', 'desktop-4k']
