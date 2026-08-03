import { describe, expect, it } from 'vitest'
import { applyTerrainTool, revertTileCommand } from './commands'
import { generateWorld, refreshTileBiome } from './generator'
import type { WorldConfig } from './types'

const config: WorldConfig = {
  seed: 'bản-đồ-kiểm-thử',
  size: 28,
  climate: 'ôn hòa',
  water: 0.54,
  resources: 0.62,
}

describe('world generation', () => {
  it('recreates the same terrain and village from the same seed', () => {
    const first = generateWorld(config)
    const second = generateWorld(config)

    expect(second).toEqual(first)
  })

  it('changes terrain when the seed changes', () => {
    const first = generateWorld(config)
    const second = generateWorld({ ...config, seed: 'bản-đồ-khác' })

    expect(second.tiles.map((tile) => tile.height)).not.toEqual(first.tiles.map((tile) => tile.height))
  })

  it('keeps a meaningful landmass for every generated seed', () => {
    const world = generateWorld(config)
    const landTiles = world.tiles.filter((tile) => tile.biome !== 'biển')

    expect(landTiles.length).toBeGreaterThan(world.tiles.length * 0.2)
    expect(world.villages[0]).toBeDefined()
  })

  it('supports reversible terrain commands', () => {
    const world = generateWorld(config)
    const target = world.villages[0]?.tileIndex
    expect(target).toBeDefined()

    const result = applyTerrainTool(world, target ?? 0, 'raise', 'Nâng địa hình')
    expect(result).toBeDefined()
    if (!result) return

    expect(result.world.tiles[target ?? 0]?.height).toBeGreaterThan(world.tiles[target ?? 0]?.height ?? 0)
    expect(revertTileCommand(result.world, result.command)?.tiles).toEqual(world.tiles)
  })

  it('protects settlement ground and removes trees from unsuitable high terrain', () => {
    const world = generateWorld(config)
    const villageTile = world.villages[0]?.tileIndex ?? 0
    expect(applyTerrainTool(world, villageTile, 'water', 'Gọi nước')).toBeUndefined()

    const forest = world.tiles.find((tile) => tile.forest)
    expect(forest).toBeDefined()
    if (!forest) return
    expect(refreshTileBiome({ ...forest, height: 0.9, forest: true }, world.config).forest).toBe(false)
  })
})
