import { describe, expect, it } from 'vitest'
import { generateWorld } from './generator'
import { generateFauna, summarizeFauna } from './fauna'
import type { WorldConfig } from './types'

const config: WorldConfig = {
  seed: 'wildlife-ecosystem',
  size: 48,
  climate: 'ôn hòa',
  water: 0.54,
  resources: 0.72,
}

describe('deterministic fauna', () => {
  it('recreates the same ecosystem for the same seed and never spawns in the sea', () => {
    const world = generateWorld(config)
    const first = generateFauna(world)
    const second = generateFauna(generateWorld(config))

    expect(second).toEqual(first)
    expect(first.length).toBeGreaterThan(0)
    expect(first.every((spawn) => world.tiles[spawn.tileIndex]?.biome !== 'biển')).toBe(true)
  })

  it('keeps animals and danger readable in the seed summary', () => {
    const world = generateWorld(config)
    const population = summarizeFauna(world)

    expect(population.total).toBe(population.animals + population.monsters)
    expect(population.animals).toBeGreaterThan(0)
    expect(population.monsters).toBeGreaterThan(0)
    expect(population.species.every((species) => species.count > 0)).toBe(true)
  })
})
