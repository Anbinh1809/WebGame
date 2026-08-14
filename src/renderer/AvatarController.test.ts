import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { generateWorld } from '../world/generator'
import { AvatarController } from './AvatarController'

describe('AvatarController', () => {
  const world = generateWorld({
    seed: 'avatar-test-seed',
    size: 48,
    climate: 'ôn hòa',
    water: 0.52,
    resources: 0.7,
  })

  it('initializes in inactive god mode and can enter avatar mode', () => {
    const controller = new AvatarController(0.72)
    expect(controller.isActive()).toBe(false)

    controller.enter(world, 24, 24)
    expect(controller.isActive()).toBe(true)
    expect(controller.getPerspective()).toBe('third-person')

    const state = controller.getState()
    expect(state.active).toBe(true)
    expect(state.stamina).toBe(100)

    controller.togglePerspective()
    expect(controller.getPerspective()).toBe('first-person')

    controller.exit()
    expect(controller.isActive()).toBe(false)
    controller.dispose()
  })

  it('handles movement keys and updates camera', () => {
    const controller = new AvatarController(0.72)
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
    controller.enter(world, 24, 24)

    controller.handleKeyDown('KeyW')
    controller.handleMouseMove(5, 2)
    controller.update(0.016, world, camera)

    const state = controller.getState()
    expect(state.active).toBe(true)
    expect(camera.position.length()).toBeGreaterThan(0)

    controller.handleKeyUp('KeyW')
    controller.exit()
    controller.dispose()
  })
})
