import { describe, expect, it } from 'vitest'
import { generateWorld } from '../world/generator'
import { DEFAULT_WORLD_CONFIG } from '../world/types'
import { EvolutionFxLayer } from './EvolutionFxLayer'

describe('EvolutionFxLayer', () => {
  it('initializes particle field and triggers mutation pulses', () => {
    const layer = new EvolutionFxLayer()
    const world = generateWorld(DEFAULT_WORLD_CONFIG)

    layer.initParticles(world, 'high')
    expect(layer.group.children.length).toBeGreaterThan(0)

    // Trigger mutation pulse
    layer.triggerMutationPulse(5, 1, 5, 0xa855f7)
    layer.triggerConvergenceResonance(10, 2, 10)

    // Animate forward
    layer.update(0.1)
    expect(layer.group.children.length).toBeGreaterThan(1)

    // Dispose
    layer.dispose()
    expect(layer.group.children.length).toBe(0)
  })
})
