import { describe, expect, it } from 'vitest'
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
    expect(__animatedActorTestables.animatedActorLimit('low')).toBe(0)
    expect(__animatedActorTestables.animatedActorLimit('medium')).toBe(1)
    expect(__animatedActorTestables.animatedActorLimit('high')).toBe(2)
    expect(__animatedActorTestables.animatedActorLimit('ultra')).toBe(2)
  })

  it('uses a deterministic fauna route and calm action choices', () => {
    const reduced = __animatedActorTestables.faunaMotionPose(deer, 5, true)
    const moving = __animatedActorTestables.faunaMotionPose(deer, 0, false)
    expect(reduced).toEqual({ tileX: deer.x, tileZ: deer.z, heading: deer.rotation, movement: 0 })
    expect(moving.movement).toBeGreaterThan(0)
    expect(__animatedActorTestables.faunaClipFor(deer, 0, true, moving.movement)).toBe('idle')
    expect(__animatedActorTestables.faunaClipFor(deer, 0, false, 0.2)).toBe('walk')
    expect(__animatedActorTestables.faunaClipFor(deer, 2, false, 0)).toBe('forage')
  })

  it('keeps a reduced-motion resident at a deterministic resting point', () => {
    const pose = __animatedActorTestables.settlerMotionPose(settler, 4, true)
    expect(pose.tileX).toBeCloseTo(5.2)
    expect(pose.tileZ).toBeCloseTo(7)
    expect(pose.heading).toBeCloseTo(0)
  })
})
