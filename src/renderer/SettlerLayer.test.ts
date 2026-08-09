import { describe, expect, it } from 'vitest'
import { generateWorld } from '../world/generator'
import { SettlerLayer } from './SettlerLayer'

describe('instanced settler locomotion layer', () => {
  it('creates terrain-aware biped poses without a WebGL renderer', () => {
    const layer = new SettlerLayer(0.72, 4)
    const world = generateWorld({ seed: 'settler-layer', size: 32, climate: 'ôn hòa', water: 0.54, resources: 0.72 })

    expect(() => {
      layer.setSettlers(world, [{
        id: 'settler-1',
        anchorTileX: 16,
        anchorTileZ: 16,
        phase: 0.4,
        radius: 0.24,
        scale: 1,
        clothingColor: 0x8eb5d1,
        skinColor: 0xf2c49c,
        tool: 'stone-handaxe',
      }])
      layer.update(1.4, false)
      layer.detach()
      layer.dispose()
    }).not.toThrow()
  })
})
