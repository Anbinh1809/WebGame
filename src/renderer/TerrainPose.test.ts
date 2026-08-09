import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { generateWorld } from '../world/generator'
import { sampleTerrainHeight, sampleTerrainNormal, solveTwoBoneKnee } from './TerrainPose'

describe('terrain pose helpers', () => {
  it('samples exact tile heights and a usable surface normal', () => {
    const world = generateWorld({ seed: 'terrain-pose', size: 24, climate: 'ôn hòa', water: 0.54, resources: 0.72 })
    const tile = world.tiles[137]
    expect(tile).toBeDefined()
    expect(sampleTerrainHeight(world, tile!.x, tile!.z)).toBeCloseTo(tile!.height)

    const normal = sampleTerrainNormal(world, 0.72, tile!.x + 0.2, tile!.z + 0.2, new THREE.Vector3())
    expect(normal.length()).toBeCloseTo(1)
    expect(normal.y).toBeGreaterThan(0)
  })

  it('solves a knee that preserves both limb lengths', () => {
    const hip = new THREE.Vector3(0, 0.42, 0)
    const foot = new THREE.Vector3(0.1, 0.02, 0.1)
    const knee = solveTwoBoneKnee(hip, foot, 0.3, 0.3, new THREE.Vector3(0, 0, 1), new THREE.Vector3())
    expect(knee.distanceTo(hip)).toBeCloseTo(0.3, 4)
    expect(knee.distanceTo(foot)).toBeCloseTo(0.3, 4)
  })
})
