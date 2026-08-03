import { describe, expect, it } from 'vitest'
import { createSimulation } from './engine'
import { happinessAtTile, tileDistance } from './metrics'
import { generateWorld } from '../world/generator'
import type { WorldConfig } from '../world/types'

const config: WorldConfig = { seed: 'heatmap-coordinates', size: 28, climate: 'ôn hòa', water: 0.54, resources: 0.62 }

describe('happiness heatmap coordinates', () => {
  it('gives equal influence to tiles at equal x/z distance even across different rows', () => {
    const world = generateWorld(config)
    const home = world.tiles.find((tile) => tile.x > 0 && tile.x < world.config.size - 1 && tile.z > 0 && tile.z < world.config.size - 1)
    expect(home).toBeDefined()
    if (!home) return
    const east = world.tiles[home.index + 1]
    const south = world.tiles[home.index + world.config.size]
    expect(east).toBeDefined()
    expect(south).toBeDefined()
    if (!east || !south) return
    const simulation = { ...createSimulation(world), villages: [{ ...createSimulation(world).villages[0]!, tileIndex: home.index, happiness: 73 }] }

    expect(tileDistance(east, home)).toBe(tileDistance(south, home))
    expect(happinessAtTile(east, world, simulation)).toBe(happinessAtTile(south, world, simulation))
  })
})
