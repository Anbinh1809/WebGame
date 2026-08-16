import { describe, expect, it } from 'vitest'
import { generateWorld } from '../world/generator'
import { DEFAULT_WORLD_CONFIG } from '../world/types'
import { SketchfabModelLayer } from './SketchfabModelLayer'
import type { SpawnedSketchfabEntity } from './SketchfabModelLayer'

describe('SketchfabModelLayer', () => {
  it('instantiates and manages 3D entity instances cleanly', () => {
    const layer = new SketchfabModelLayer()
    const world = generateWorld(DEFAULT_WORLD_CONFIG)

    const entities: SpawnedSketchfabEntity[] = [
      {
        id: 'sk-1',
        name: 'Hải Long Thái Cổ',
        category: 'creature',
        tileIndex: 100,
        x: 5,
        z: 5,
        elevation: 0.5,
        scale: 1.0,
        rotation: 0,
        colorHex: '#06b6d4',
        modelType: 'creature',
      },
      {
        id: 'sk-2',
        name: 'Titan Núi Lửa',
        category: 'titan',
        tileIndex: 150,
        x: 10,
        z: 10,
        elevation: 0.8,
        scale: 1.5,
        rotation: Math.PI / 4,
        colorHex: '#f97316',
        modelType: 'titan',
      },
    ]

    layer.setEntities(entities, world, 'high')
    expect(layer.getEntities().length).toBe(2)
    expect(layer.group.children.length).toBe(2)

    // Remove entity
    layer.removeEntity('sk-1', world, 'high')
    expect(layer.getEntities().length).toBe(1)
    expect(layer.group.children.length).toBe(1)

    // Animation update
    layer.update(0.016)

    // Dispose
    layer.dispose()
    expect(layer.group.children.length).toBe(0)
  })
})
