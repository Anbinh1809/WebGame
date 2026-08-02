import { describe, expect, it } from 'vitest'
import { advanceSimulation, createSimulation, triggerStorm } from './engine'
import { generateWorld } from '../world/generator'
import type { WorldConfig } from '../world/types'

const config: WorldConfig = {
  seed: 'mô-phỏng-cố-định',
  size: 28,
  climate: 'ôn hòa',
  water: 0.54,
  resources: 0.62,
}

describe('simulation engine', () => {
  it('advances deterministically for an identical world and tick count', () => {
    const world = generateWorld(config)
    const first = advanceSimulation(createSimulation(world), world, 48)
    const second = advanceSimulation(createSimulation(world), world, 48)

    expect(second).toEqual(first)
  })

  it('records and resolves a storm disaster', () => {
    const world = generateWorld(config)
    const initial = createSimulation(world)
    const storm = triggerStorm(initial)
    const resolved = advanceSimulation(storm, world, 18)

    expect(storm.activeStorm).toBeDefined()
    expect(resolved.activeStorm).toBeUndefined()
    expect(resolved.events.some((event) => event.title === 'Mây tan')).toBe(true)
  })
})
