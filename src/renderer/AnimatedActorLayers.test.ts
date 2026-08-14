import { describe, expect, it } from 'vitest'
import { FAUNA_COMBAT_STATS } from '../world/fauna'
import type { FaunaSpawn } from '../world/fauna'
import type { SettlerPlacement } from './SettlerLayer'
import { __animatedActorTestables } from './AnimatedActorLayers'

const deer: FaunaSpawn = {
  id: 'hươu-rừng-1',
  category: 'animal',
  species: 'hươu-rừng',
  tileIndex: 1,
  x: 8,
  z: 4,
  elevation: 0,
  rotation: 0,
  scale: 0.9,
  pace: 0.5,
  phase: 0,
  priority: 0,
  stats: FAUNA_COMBAT_STATS['hươu-rừng'],
}

const settler: SettlerPlacement = {
  id: 'village-1-settler-0',
  anchorTileX: 5,
  anchorTileZ: 7,
  phase: 0,
  radius: 0.2,
  scale: 1,
  clothingColor: 0xffffff,
  skinColor: 0xffffff,
  tool: 'stone-handaxe',
}

describe('animated actor presentation policy', () => {
  it('keeps skinned foreground actors bounded by graphics quality', () => {
    expect(__animatedActorTestables.animatedActorLimit('low')).toBe(16)
    expect(__animatedActorTestables.animatedActorLimit('medium')).toBe(32)
    expect(__animatedActorTestables.animatedActorLimit('high')).toBe(64)
    expect(__animatedActorTestables.animatedActorLimit('ultra')).toBe(64)
  })

  it('uses a deterministic fauna route and calm action choices', () => {
    const reduced = __animatedActorTestables.faunaMotionPose(deer, 5, true)
    const moving = __animatedActorTestables.faunaMotionPose(deer, 0, false)
    const later = __animatedActorTestables.faunaMotionPose(deer, 2, false)
    expect(reduced).toEqual({ tileX: deer.x, tileZ: deer.z, heading: deer.rotation, movement: 0, activity: 'rest' })
    expect(moving.movement).toBeGreaterThan(0)
    expect(Math.hypot(later.tileX - deer.x, later.tileZ - deer.z)).toBeGreaterThan(0.2)
    expect(__animatedActorTestables.faunaClipFor(deer, 0, true, moving.movement)).toBe('idle')
    expect(__animatedActorTestables.faunaClipFor(deer, 0, false, 0.2)).toBe('walk')
    expect(__animatedActorTestables.faunaClipFor(deer, 2, false, 0)).toBe('forage')
    const fleeing = __animatedActorTestables.faunaMotionPose(deer, 0, false, true)
    expect(fleeing.activity).toBe('flee')
    expect(fleeing.movement).toBeGreaterThan(moving.movement)
  })

  it('keeps a reduced-motion resident at a deterministic resting point', () => {
    const pose = __animatedActorTestables.settlerMotionPose(settler, 4, true)
    expect(pose.tileX).toBeCloseTo(5.2)
    expect(pose.tileZ).toBeCloseTo(7)
    expect(pose.heading).toBeCloseTo(0)
  })

  it('gives an active resident a visible route without moving the reduced-motion pose', () => {
    const start = __animatedActorTestables.settlerMotionPose(settler, 0, false)
    const later = __animatedActorTestables.settlerMotionPose(settler, 3, false)
    expect(Math.hypot(later.tileX - start.tileX, later.tileZ - start.tileZ)).toBeGreaterThan(0.5)
  })
  it('changes resident routes and work pulses with their simulation role', () => {
    const farmer = __animatedActorTestables.settlerMotionPose({ ...settler, activity: 'farm' }, 1.3, false)
    const sheltering = __animatedActorTestables.settlerMotionPose({ ...settler, activity: 'shelter' }, 1.3, false)
    expect(farmer.activity).toBe('farm')
    expect(Math.abs(farmer.workPulse)).toBeGreaterThan(0.01)
    expect(sheltering.movement).toBeGreaterThan(farmer.movement)
  })

})
