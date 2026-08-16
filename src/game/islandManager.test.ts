import { beforeEach, describe, expect, it } from 'vitest'
import { IslandArchipelagoManager } from './islandManager'
import { DEFAULT_WORLD_CONFIG } from '../world/types'

describe('IslandArchipelagoManager', () => {
  let manager: IslandArchipelagoManager

  beforeEach(() => {
    manager = new IslandArchipelagoManager()
  })

  it('initializes with default Prime Island and valid evolution profile', () => {
    const active = manager.getActiveIsland()
    expect(active).toBeDefined()
    expect(active.name).toContain('Aetheria')
    expect(active.evolution.dominantArchetype).toBeDefined()
    expect(active.evolution.cladeSignature.keystoneTaxonId).toBeGreaterThanOrEqual(0)
  })

  it('creates and switches between multiple independent player islands', () => {
    const customConfig = { ...DEFAULT_WORLD_CONFIG, seed: 'seed-island-volcano', climate: 'ấm' as const }
    const island2 = manager.createIsland('Đảo Hỏa Diệm', customConfig)

    expect(island2.name).toBe('Đảo Hỏa Diệm')
    expect(manager.getAllIslands().length).toBeGreaterThanOrEqual(2)
    expect(manager.getActiveIsland().id).toBe(island2.id)

    // Switch back to prime island
    manager.switchIsland('island-prime')
    expect(manager.getActiveIsland().id).toBe('island-prime')
  })

  it('manages evolution node unlocking and DNA points across active island', () => {
    manager.addActiveIslandEvolutionPoints(400, 400)
    const active = manager.getActiveIsland()
    expect(active.evolution.dnaPoints).toBeGreaterThanOrEqual(400)

    const archetype = active.evolution.dominantArchetype
    const res = manager.unlockActiveIslandEvolutionNode(`node-${archetype}-t2`)
    expect(res.success).toBe(true)
    expect(res.evolution.unlockedNodeIds).toContain(`node-${archetype}-t2`)
  })

  it('manages 3D Sketchfab spawned entity state per island', () => {
    manager.addActiveIslandSketchfabEntity({
      id: 'entity-1',
      name: 'Rồng Thái Cổ',
      category: 'creature',
      tileIndex: 12,
      x: 1,
      z: 1,
      elevation: 0.5,
      scale: 1,
      rotation: 0,
      modelType: 'creature',
    })

    expect(manager.getActiveIsland().spawnedSketchfabEntities.length).toBe(1)

    manager.removeActiveIslandSketchfabEntity('entity-1')
    expect(manager.getActiveIsland().spawnedSketchfabEntities.length).toBe(0)
  })
})
