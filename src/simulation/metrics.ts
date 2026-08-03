import type { SimulationState, VillageSimulation } from './types'
import type { Tile, World } from '../world/types'

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

/** Distance is intentionally based on world coordinates, never the row-major tile index. */
export function tileDistance(first: Tile, second: Tile): number {
  return Math.hypot(first.x - second.x, first.z - second.z)
}

export function happinessAtTile(tile: Tile, world: World, simulation: SimulationState): number {
  if (simulation.villages.length === 0) return 0

  const weighted = simulation.villages.reduce(
    (total, village) => {
      const home = world.tiles[village.tileIndex]
      if (!home) return total
      const influence = Math.max(0, 1 - tileDistance(tile, home) / 10)
      return total + (village.happiness / 100) * (0.36 + influence * 0.64)
    },
    0,
  )

  return clamp(weighted / simulation.villages.length, 0, 1)
}

export function nearestVillage(tile: Tile, world: World, villages: VillageSimulation[]): VillageSimulation | undefined {
  let nearest: VillageSimulation | undefined
  let shortest = Number.POSITIVE_INFINITY

  for (const village of villages) {
    const home = world.tiles[village.tileIndex]
    if (!home) continue
    const distance = tileDistance(tile, home)
    if (distance < shortest) {
      shortest = distance
      nearest = village
    }
  }

  return nearest
}
