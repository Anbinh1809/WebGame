import { getWaterLevel, refreshTileBiome } from './generator'
import type { TerrainTool, Tile, TileMutationCommand, World } from './types'

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function getWorldSignature(world: World): string {
  const { seed, size, climate, water, resources } = world.config
  return `${seed}|${size}|${climate}|${water}|${resources}`
}

function replaceTile(world: World, tile: Tile, revision: number): World {
  const tiles = [...world.tiles]
  tiles[tile.index] = tile
  return { ...world, tiles, revision }
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
      if (next.height > waterLevel + 0.1 && next.height < 0.72) {
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

function isSettlementSafe(world: World, tile: Tile): boolean {
  return tile.height > getWaterLevel(world.config) + 0.1
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
  if (world.villages.some((village) => village.tileIndex === before.index) && !isSettlementSafe(world, after)) return undefined

  return {
    world: replaceTile(world, after, world.revision + 1),
    command: {
      kind: 'tile',
      label,
      tileIndex,
      worldSignature: getWorldSignature(world),
      worldRevisionBefore: world.revision,
      worldRevisionAfter: world.revision + 1,
      before,
      after,
    },
  }
}

export function applyTileCommand(world: World, command: TileMutationCommand): World | undefined {
  if (world.revision !== command.worldRevisionBefore || getWorldSignature(world) !== command.worldSignature) return undefined
  return replaceTile(world, command.after, command.worldRevisionAfter)
}

export function revertTileCommand(world: World, command: TileMutationCommand): World | undefined {
  if (world.revision !== command.worldRevisionAfter || getWorldSignature(world) !== command.worldSignature) return undefined
  return replaceTile(world, command.before, command.worldRevisionBefore)
}
