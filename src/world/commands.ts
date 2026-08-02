import { getWaterLevel, refreshTileBiome } from './generator'
import type { TerrainTool, Tile, TileMutationCommand, World } from './types'

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function replaceTile(world: World, tile: Tile): World {
  const tiles = [...world.tiles]
  tiles[tile.index] = tile
  return { ...world, tiles, revision: world.revision + 1 }
}

function updateTerrainTile(world: World, tile: Tile, tool: TerrainTool): Tile {
  const waterLevel = getWaterLevel(world.config)
  const next = { ...tile }

  switch (tool) {
    case 'raise':
      next.height = clamp(next.height + 0.18, -0.62, 1.62)
      break
    case 'lower':
      next.height = clamp(next.height - 0.18, -0.75, 1.62)
      break
    case 'water':
      next.height = waterLevel - 0.08
      next.moisture = 1
      next.forest = false
      next.resources = 0
      break
    case 'forest':
      if (next.height > waterLevel + 0.08 && next.height < 0.78) {
        next.forest = true
        next.moisture = clamp(next.moisture + 0.12, 0, 1)
      }
      break
    case 'fertile':
      if (next.height > waterLevel + 0.08) {
        next.soil = 'màu mỡ'
        next.moisture = clamp(next.moisture + 0.16, 0, 1)
        next.resources = clamp(next.resources + 0.18, 0, 1)
      }
      break
    case 'barren':
      if (next.height > waterLevel + 0.08) {
        next.soil = 'cằn cỗi'
        next.moisture = clamp(next.moisture - 0.24, 0, 1)
        next.resources = clamp(next.resources - 0.2, 0, 1)
        next.forest = false
      }
      break
  }

  return refreshTileBiome(next, world.config)
}

export function applyTerrainTool(
  world: World,
  tileIndex: number,
  tool: TerrainTool,
  label: string,
): { world: World; command: TileMutationCommand } | undefined {
  const before = world.tiles[tileIndex]
  if (!before) return undefined

  const after = updateTerrainTile(world, before, tool)
  if (JSON.stringify(before) === JSON.stringify(after)) return undefined

  return {
    world: replaceTile(world, after),
    command: {
      kind: 'tile',
      label,
      tileIndex,
      before,
      after,
    },
  }
}

export function applyTileCommand(world: World, command: TileMutationCommand): World {
  return replaceTile(world, command.after)
}

export function revertTileCommand(world: World, command: TileMutationCommand): World {
  return replaceTile(world, command.before)
}
