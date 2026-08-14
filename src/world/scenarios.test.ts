import { describe, expect, it } from 'vitest'
import { STARTER_SCENARIOS, getScenarioById } from './scenarios'
import { generateWorld } from './generator'

describe('scenarios', () => {
  it('contains valid starter scenarios with unique IDs and seeds', () => {
    expect(STARTER_SCENARIOS.length).toBeGreaterThanOrEqual(5)
    const ids = new Set(STARTER_SCENARIOS.map((s) => s.id))
    const seeds = new Set(STARTER_SCENARIOS.map((s) => s.config.seed))
    expect(ids.size).toBe(STARTER_SCENARIOS.length)
    expect(seeds.size).toBe(STARTER_SCENARIOS.length)
  })

  it('can generate a playable world from each starter scenario', () => {
    for (const scenario of STARTER_SCENARIOS) {
      const world = generateWorld(scenario.config)
      expect(world.tiles.length).toBe(scenario.config.size * scenario.config.size)
      expect(world.villages.length).toBeGreaterThan(0)
    }
  })

  it('retrieves scenario by id correctly', () => {
    const sunrise = getScenarioById('sunrise-vale')
    expect(sunrise).toBeDefined()
    expect(sunrise?.name).toBe('Thung Lũng Bình Minh')
    expect(getScenarioById('non-existent')).toBeUndefined()
  })
})
