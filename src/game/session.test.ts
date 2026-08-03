import { describe, expect, it } from 'vitest'
import { applyTerrainChange, createGameState, recreateWorld, redoGameChange, undoGameChange } from './session'
import { applyTerrainTool, applyTileCommand } from '../world/commands'
import type { WorldConfig } from '../world/types'

const config: WorldConfig = { seed: 'history-seed', size: 28, climate: 'ôn hòa', water: 0.54, resources: 0.62 }

describe('undo and redo history', () => {
  it('keeps prior history across world recreation and restores every command in order', () => {
    const initial = createGameState(config)
    const first = applyTerrainTool(initial.session.world, 0, 'raise', 'Nâng đất')
    expect(first).toBeDefined()
    if (!first) return
    const afterFirst = applyTerrainChange(initial, first.command, first.world)
    const second = applyTerrainTool(afterFirst.session.world, 1, 'lower', 'Hạ đất')
    expect(second).toBeDefined()
    if (!second) return
    const afterSecond = applyTerrainChange(afterFirst, second.command, second.world)
    const recreated = recreateWorld(afterSecond, { ...config, seed: 'history-seed-new' }, 'Tái tạo thế giới')

    expect(recreated.undoStack).toHaveLength(3)
    const undoOne = undoGameChange(recreated)
    const undoTwo = undoGameChange(undoOne)
    const undoThree = undoGameChange(undoTwo)
    expect(undoThree.session.world).toEqual(initial.session.world)
    expect(redoGameChange(redoGameChange(redoGameChange(undoThree))).session.world.config.seed).toBe('history-seed-new')
  })

  it('rejects replaying a terrain command against an unrelated world revision', () => {
    const initial = createGameState(config)
    const command = applyTerrainTool(initial.session.world, 0, 'raise', 'Nâng đất')
    expect(command).toBeDefined()
    if (!command) return
    const unrelated = recreateWorld(initial, { ...config, seed: 'another-world' }, 'Tái tạo')
    expect(applyTileCommand(unrelated.session.world, command.command)).toBeUndefined()
  })
})
