import type { FaunaSpawn } from '../world/fauna'
import type { SettlerPlacement } from './SettlerLayer'

export type SettlerActivity = 'forage' | 'farm' | 'craft' | 'guard' | 'shelter' | 'rest'

export interface FaunaMotionPose {
  tileX: number
  tileZ: number
  heading: number
  movement: number
  activity: 'rest' | 'graze' | 'wander' | 'flee'
}

export interface SettlerMotionPose {
  tileX: number
  tileZ: number
  heading: number
  movement: number
  activity: SettlerActivity
  workPulse: number
}

/** Shared deterministic local patrol used by the instanced and rigged wildlife. */
export function faunaMotionPose(
  spawn: FaunaSpawn,
  elapsed: number,
  reducedMotion: boolean,
  fleeing = false,
): FaunaMotionPose {
  if (reducedMotion) {
    return { tileX: spawn.x, tileZ: spawn.z, heading: spawn.rotation, movement: 0, activity: 'rest' }
  }
  const travelRate = spawn.pace * (fleeing ? 2.2 : 1.25)
  const travel = elapsed * travelRate + spawn.phase
  const forwardX = Math.sin(spawn.rotation)
  const forwardZ = Math.cos(spawn.rotation)
  const sideX = -forwardZ
  const sideZ = forwardX
  const alongDistance = fleeing ? 1.08 : 0.74
  const acrossDistance = fleeing ? 0.42 : 0.28
  const along = Math.sin(travel) * alongDistance
  const across = Math.sin(travel * 0.61 + spawn.phase) * acrossDistance
  const alongVelocity = Math.cos(travel) * alongDistance * travelRate
  const acrossVelocity = Math.cos(travel * 0.61 + spawn.phase) * acrossDistance * 0.61 * travelRate
  const velocityX = forwardX * alongVelocity + sideX * acrossVelocity
  const velocityZ = forwardZ * alongVelocity + sideZ * acrossVelocity
  const movement = Math.hypot(velocityX, velocityZ)
  return {
    tileX: spawn.x + forwardX * along + sideX * across,
    tileZ: spawn.z + forwardZ * along + sideZ * across,
    heading: Math.atan2(velocityX, velocityZ),
    movement,
    activity: fleeing ? 'flee' : movement > 0.18 ? 'wander' : Math.sin(elapsed * 0.31 + spawn.phase) > 0.1 ? 'graze' : 'rest',
  }
}

/** Shared settlement route keeps foreground rigs aligned with the batched crowd. */
export function settlerMotionPose(settler: SettlerPlacement, elapsed: number, reducedMotion: boolean): SettlerMotionPose {
  const activity = settler.activity ?? 'forage'
  const activitySpeed: Record<SettlerActivity, number> = {
    forage: 0.86,
    farm: 0.42,
    craft: 0.36,
    guard: 1.14,
    shelter: 1.24,
    rest: 0.18,
  }
  const walkPhase = elapsed * (activitySpeed[activity] + (settler.phase % 0.18)) + settler.phase
  const orbit = reducedMotion ? settler.phase : walkPhase
  const expandedRadius = Math.max(0.62, settler.radius * (activity === 'guard' || activity === 'shelter' ? 2.1 : 1.65))
  const workRadius = activity === 'farm' || activity === 'craft' ? Math.min(0.17, settler.radius * 0.64) : undefined
  const routeRadius = reducedMotion
    ? settler.radius
    : workRadius ?? (activity === 'rest' ? settler.radius * 0.4 : settler.radius + (expandedRadius - settler.radius) * (1 - Math.exp(-elapsed * 0.82)))
  const workPulse = reducedMotion ? 0 : Math.sin(elapsed * (activity === 'craft' ? 5.8 : activity === 'farm' ? 4.6 : 2.2) + settler.phase)
  const movement = reducedMotion || activity === 'rest' ? 0 : activity === 'farm' || activity === 'craft' ? 0.16 : activity === 'shelter' ? 0.9 : activity === 'guard' ? 0.72 : 0.58
  return {
    tileX: settler.anchorTileX + Math.cos(orbit) * routeRadius,
    tileZ: settler.anchorTileZ + Math.sin(orbit) * routeRadius,
    heading: Math.atan2(-Math.sin(orbit), Math.cos(orbit)),
    movement,
    activity,
    workPulse,
  }
}
