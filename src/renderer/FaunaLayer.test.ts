import { describe, expect, it } from 'vitest'
import { generateWorld } from '../world/generator'
import { FaunaLayer } from './FaunaLayer'

describe('instanced fauna layer', () => {
  it('builds and animates deterministic fauna without a WebGL renderer', () => {
    const layer = new FaunaLayer(0.72)
    const world = generateWorld({ seed: 'fauna-layer', size: 48, climate: 'ôn hòa', water: 0.54, resources: 0.72 })

    expect(() => {
      layer.setWorld(world, 'high')
      layer.update(1.4, false)
      layer.detach()
      layer.dispose()
    }).not.toThrow()
  })
})
