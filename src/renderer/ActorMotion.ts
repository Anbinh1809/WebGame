import type { FaunaSpawn } from '../world/fauna'
import type { SettlerPlacement } from './SettlerLayer'

export type SettlerActivity = 'forage' | 'farm' | 'craft' | 'guard' | 'shelter' | 'rest' | 'chop' | 'mine' | 'build' | 'hunt'

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
  const alongDistance = fleeing ? 0.45 : 0.28
  const acrossDistance = fleeing ? 0.22 : 0.12
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
    forage: 0.82,
    farm: 0.38,
    craft: 0.32,
    chop: 0.36,
    mine: 0.34,
    build: 0.42,
    hunt: 0.95,
    guard: 1.08,
    shelter: 1.28,
    rest: 0.16,
  }
  const walkPhase = elapsed * (activitySpeed[activity] + (settler.phase % 0.18)) + settler.phase
  const orbit = reducedMotion ? settler.phase : walkPhase

  let targetRadius = settler.radius
  let workSpeed = 2.4
  let isStationaryWork = false

  switch (activity) {
    case 'chop':
      targetRadius = Math.max(0.68, settler.radius * 1.55)
      workSpeed = 5.2
      isStationaryWork = Math.sin(elapsed * 0.4 + settler.phase) > 0.2
      break
    case 'mine':
      targetRadius = Math.max(0.75, settler.radius * 1.7)
      workSpeed = 5.4
      isStationaryWork = Math.sin(elapsed * 0.38 + settler.phase) > 0.2
      break
    case 'build':
      targetRadius = Math.max(0.42, settler.radius * 1.1)
      workSpeed = 6.0
      isStationaryWork = Math.sin(elapsed * 0.5 + settler.phase) > 0.15
      break
    case 'hunt':
      targetRadius = Math.max(1.1, settler.radius * 2.2)
      workSpeed = 3.6
      break
    case 'farm':
      targetRadius = Math.min(0.24, settler.radius * 0.7)
      workSpeed = 4.8
      isStationaryWork = true
      break
    case 'craft':
      targetRadius = Math.min(0.2, settler.radius * 0.6)
      workSpeed = 5.8
      isStationaryWork = true
      break
    case 'guard':
      targetRadius = Math.max(0.9, settler.radius * 1.9)
      workSpeed = 2.0
      break
    case 'shelter':
      targetRadius = Math.min(0.18, settler.radius * 0.45)
      workSpeed = 1.0
      break
    case 'rest':
      targetRadius = Math.min(0.22, settler.radius * 0.5)
      workSpeed = 1.4
      break
    case 'forage':
    default:
      targetRadius = Math.max(0.6, settler.radius * 1.4)
      workSpeed = 2.6
      break
  }

  const routeRadius = reducedMotion ? settler.radius : targetRadius
  const workPulse = reducedMotion ? 0 : Math.sin(elapsed * workSpeed + settler.phase)
  const movement = reducedMotion || activity === 'rest'
    ? 0
    : isStationaryWork
      ? 0.12
      : activity === 'shelter'
        ? 0.95
        : activity === 'hunt' || activity === 'guard'
          ? 0.8
          : 0.55

  return {
    tileX: settler.anchorTileX + Math.cos(orbit) * routeRadius,
    tileZ: settler.anchorTileZ + Math.sin(orbit) * routeRadius,
    heading: Math.atan2(-Math.sin(orbit), Math.cos(orbit)),
    movement,
    activity,
    workPulse,
  }
}
