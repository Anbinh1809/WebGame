import { describe, expect, it } from 'vitest'
import { createSimulation } from '../simulation/engine'
import { generateWorld } from '../world/generator'
import { AmbientLifeLayer, ambientParticleCount } from './AmbientLifeLayer'

describe('ambient life layer', () => {
  it('keeps ambient motion in one bounded particle layer for every quality tier', () => {
    expect(ambientParticleCount('low')).toBeGreaterThan(0)
    expect(ambientParticleCount('ultra')).toBeGreaterThan(ambientParticleCount('medium'))

    const world = generateWorld({ seed: 'ambient-life', size: 32, climate: 'ôn hòa', water: 0.54, resources: 0.72 })
    const layer = new AmbientLifeLayer(0.72)
    expect(() => {
      layer.setSimulation(createSimulation(world))
      layer.setWorld(world, 'low')
      layer.update(1.2, false, false)
      layer.setQuality('ultra')
      layer.update(2.4, false, true)
      layer.dispose()
    }).not.toThrow()
  })
})
