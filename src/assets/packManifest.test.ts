import { describe, expect, it } from 'vitest'
import { GAME_PACK_MODELS, GAME_PACK_AUDIO } from './packManifest'

describe('packManifest', () => {
  it('defines 3d pack models correctly', () => {
    expect(GAME_PACK_MODELS['tree-common-1']).toBeDefined()
    expect(GAME_PACK_MODELS['tree-common-1']?.category).toBe('nature')
    expect(GAME_PACK_MODELS['prop-anvil']?.category).toBe('props')
    expect(GAME_PACK_MODELS['char-axe']?.category).toBe('characters')
  })

  it('defines ambient audio paths correctly', () => {
    expect(GAME_PACK_AUDIO.ambientTheme).toContain('.ogg')
    expect(GAME_PACK_AUDIO.ambientExplore).toContain('.ogg')
  })
})
