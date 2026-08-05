import { seedToUint32 } from '../world/prng'
import type { World } from '../world/types'
import type { VillageSimulation, WorldObjective, WorldObjectiveId } from './types'

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function targetFor(seed: number, id: WorldObjectiveId): number {
  if (id === 'rooted-grove') return 5 + (seed % 6)
  if (id === 'full-granary') return 56 + (seed % 5) * 8
  return 46 + (seed % 4) * 4
}

/**
 * Objective identities and choices are fixed in code. Only their modest target
 * values vary by world seed, so the UI presents goals without changing
 * gameplay commands.
 */
export function createWorldObjectives(world: World): WorldObjective[] {
  const seed = seedToUint32(world.config.seed)
  return [
    {
      id: 'rooted-grove',
      metric: 'forest-tiles',
      title: 'Rễ sâu của Aetheria',
      detail: 'Nuôi dưỡng một khu rừng đủ lớn để giữ ẩm cho thung lũng.',
      target: targetFor(seed, 'rooted-grove'),
      progress: 0,
      completed: false,
    },
    {
      id: 'full-granary',
      metric: 'stored-food',
      title: 'Kho lương bình minh',
      detail: 'Tích trữ lương thực để cộng đồng vượt qua những mùa khắc nghiệt.',
      target: targetFor(seed, 'full-granary'),
      progress: 0,
      completed: false,
    },
    {
      id: 'stormward',
      metric: 'resilience',
      title: 'Lời thề chống giông',
      detail: 'Xây dựng sức chống chịu để làng có thể hồi phục sau thiên tai.',
      target: targetFor(seed, 'stormward'),
      progress: 0,
      completed: false,
    },
  ]
}

export function objectiveProgress(objective: WorldObjective, world: World, villages: VillageSimulation[]): number {
  if (objective.metric === 'forest-tiles') return world.tiles.filter((tile) => tile.forest).length
  if (objective.metric === 'stored-food') return Math.floor(villages.reduce((total, village) => total + village.food, 0))
  if (villages.length === 0) return 0
  return Math.floor(villages.reduce((total, village) => total + village.resilience, 0) / villages.length)
}

export function refreshWorldObjectives(
  objectives: WorldObjective[],
  world: World,
  villages: VillageSimulation[],
): { objectives: WorldObjective[]; newlyCompleted: WorldObjective[] } {
  const newlyCompleted: WorldObjective[] = []
  const next = objectives.map((objective) => {
    const progress = clamp(objectiveProgress(objective, world, villages), 0, 100_000)
    const completed = progress >= objective.target
    const updated = { ...objective, progress, completed }
    if (completed && !objective.completed) newlyCompleted.push(updated)
    return updated
  })
  return { objectives: next, newlyCompleted }
}
