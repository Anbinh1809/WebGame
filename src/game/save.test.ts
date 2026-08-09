import { describe, expect, it } from 'vitest'
import { decodeSave, MAX_SAVE_BYTES, migrateSaveDocument, serializeSave } from './save'
import { applyTerrainChange, createGameState } from './session'
import { applyTerrainTool } from '../world/commands'
import type { WorldConfig } from '../world/types'

const config: WorldConfig = { seed: 'save-round-trip', size: 28, climate: 'ôn hòa', water: 0.54, resources: 0.62 }

describe('local save schema', () => {
  it('accepts saves from every supported world size, including the expanded 60 by 60 map', () => {
    const largeWorld = createGameState({ ...config, seed: 'save-60-by-60', size: 60 })
    const decoded = decodeSave(serializeSave(largeWorld))
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    expect(decoded.game.session.world.config.size).toBe(60)
    expect(decoded.game.session.world.tiles).toHaveLength(3_600)
  })

  it('round-trips the current game session while dropping ephemeral undo snapshots', () => {
    const initial = createGameState(config)
    const terrainChange = applyTerrainTool(initial.session.world, 0, 'raise', 'Nâng đất')
    expect(terrainChange).toBeDefined()
    if (!terrainChange) return
    const game = applyTerrainChange(initial, terrainChange.command, terrainChange.world)
    const decoded = decodeSave(serializeSave(game))
    if (!decoded.ok) return
    expect(decoded.game.session).toEqual(game.session)
    expect(decoded.game.undoStack).toEqual([])
    expect(decoded.game.redoStack).toEqual([])
    expect(decoded.game.session.world.revision).toBe(1)
    expect(decoded.game.session.world.tiles[0]).toEqual(terrainChange.world.tiles[0])
  })

  it('rejects malformed or duplicate-event save data before hydration', () => {
    expect(decodeSave('{not json}').ok).toBe(false)
    const invalid = JSON.parse(serializeSave(createGameState(config))) as { game: { session: { simulation: { events: Array<{ id: string }> } } } }
    invalid.game.session.simulation.events.push({ ...invalid.game.session.simulation.events[0]!, id: invalid.game.session.simulation.events[0]!.id })
    expect(decodeSave(JSON.stringify(invalid)).ok).toBe(false)
  })

  it('rejects invalid nested state and oversized imports before hydration', () => {
    const withBrokenStorm = JSON.parse(serializeSave(createGameState(config))) as { game: { session: { simulation: { activeStorm: unknown } } } }
    withBrokenStorm.game.session.simulation.activeStorm = { remainingTicks: 0, intensity: Number.NaN }
    expect(decodeSave(JSON.stringify(withBrokenStorm)).ok).toBe(false)

    const withBrokenTerrain = JSON.parse(serializeSave(createGameState(config))) as { game: { session: { world: { tiles: Array<{ biome: string }> } } } }
    withBrokenTerrain.game.session.world.tiles[0]!.biome = 'volcano'
    expect(decodeSave(JSON.stringify(withBrokenTerrain)).ok).toBe(false)
    expect(decodeSave(' '.repeat(MAX_SAVE_BYTES + 1)).ok).toBe(false)
  })

  it('rejects settlements, ecology, and event sequences that would desynchronize a loaded session', () => {
    const oceanSettlement = JSON.parse(serializeSave(createGameState(config))) as {
      game: { session: { world: { tiles: Array<{ biome: string }>; villages: Array<{ tileIndex: number }> }; simulation: { villages: Array<{ tileIndex: number }> } } }
    }
    const oceanIndex = oceanSettlement.game.session.world.tiles.findIndex((tile) => tile.biome === 'biển')
    expect(oceanIndex).toBeGreaterThanOrEqual(0)
    oceanSettlement.game.session.world.villages[0]!.tileIndex = oceanIndex
    oceanSettlement.game.session.simulation.villages[0]!.tileIndex = oceanIndex
    expect(decodeSave(JSON.stringify(oceanSettlement)).ok).toBe(false)

    const inconsistentEcology = JSON.parse(serializeSave(createGameState(config))) as {
      game: { session: { world: { tiles: Array<{ biome: string; forest: boolean }> } } }
    }
    inconsistentEcology.game.session.world.tiles[0]!.biome = 'rừng'
    inconsistentEcology.game.session.world.tiles[0]!.forest = false
    expect(decodeSave(JSON.stringify(inconsistentEcology)).ok).toBe(false)

    const collidingEventSequence = JSON.parse(serializeSave(createGameState(config))) as {
      game: { session: { simulation: { eventSequence: number; events: Array<{ id: string; tick: number }> } } }
    }
    const event = collidingEventSequence.game.session.simulation.events[0]!
    event.id = `event-${event.tick}-settlers-joined-1`
    collidingEventSequence.game.session.simulation.eventSequence = 1
    expect(decodeSave(JSON.stringify(collidingEventSequence)).ok).toBe(false)
  })

  it('rejects imported undo snapshots because saves intentionally contain only the current session', () => {
    const withHistory = JSON.parse(serializeSave(createGameState(config))) as { game: { undoStack: unknown[] } }
    withHistory.game.undoStack.push({})
    expect(decodeSave(JSON.stringify(withHistory)).ok).toBe(false)
  })

  it('migrates v1 saves deterministically to the current objective, resilience, craft, and knowledge schema', () => {
    const legacy = JSON.parse(serializeSave(createGameState(config))) as {
      schemaVersion: number
      game: {
        session: {
          world: unknown
          simulation: {
            villages: Array<Record<string, unknown>>
            objectives?: unknown
            godToolUses?: unknown
          }
        }
      }
    }
    legacy.schemaVersion = 1
    for (const village of legacy.game.session.simulation.villages) {
      delete village.resilience
      delete village.knowledge
    }
    delete legacy.game.session.simulation.objectives
    delete legacy.game.session.simulation.godToolUses

    const migratedDocument = migrateSaveDocument(legacy) as {
      schemaVersion: number
      game: {
        session: {
          world: unknown
          simulation: { villages: Array<Record<string, unknown>> }
        }
      }
    }
    expect(migratedDocument.schemaVersion).toBe(4)
    expect(migratedDocument.game.session.world).toEqual(legacy.game.session.world)
    expect(migratedDocument.game.session.simulation.villages[0]?.resilience).toBe(42)
    const migrated = decodeSave(JSON.stringify(legacy))
    if (!migrated.ok) throw new Error(migrated.reason)
    expect(migrated.ok).toBe(true)
    if (!migrated.ok) return
    expect(migrated.game.session.simulation.villages[0]!.resilience).toBe(42)
    expect(migrated.game.session.simulation.objectives).toHaveLength(3)
    expect(migrated.game.session.simulation.godToolUses.forest).toBe(0)
    expect(migrated.game.session.simulation.villages[0]!.tools).toEqual(['stone-handaxe'])
    expect(migrated.game.session.simulation.villages[0]!.knowledge).toEqual([])
    expect(migrated.game.session.simulation.villages[0]!.era).toBe('Thời Đồ Đá')
  })

  it('migrates a v2 era into its ordered tool ledger without granting out-of-order tools', () => {
    const legacy = JSON.parse(serializeSave(createGameState(config))) as {
      schemaVersion: number
      game: { session: { simulation: { villages: Array<Record<string, unknown>> } } }
    }
    legacy.schemaVersion = 2
    const village = legacy.game.session.simulation.villages[0]!
    village.era = 'Thợ đá'
    delete village.tools

    const migrated = decodeSave(JSON.stringify(legacy))
    if (!migrated.ok) throw new Error(migrated.reason)
    expect(migrated.game.session.simulation.villages[0]!.tools).toEqual(['stone-handaxe', 'flint-axe', 'stone-hoe'])
    expect(migrated.game.session.simulation.villages[0]!.era).toBe('Nông Nghiệp')
  })

  it('migrates v3 saves with an empty knowledge ledger and rejects forged late-era knowledge', () => {
    const legacy = JSON.parse(serializeSave(createGameState(config))) as {
      schemaVersion: number
      game: { session: { simulation: { villages: Array<Record<string, unknown>> } } }
    }
    legacy.schemaVersion = 3
    delete legacy.game.session.simulation.villages[0]!.knowledge

    const migratedDocument = migrateSaveDocument(legacy) as {
      schemaVersion: number
      game: { session: { simulation: { villages: Array<Record<string, unknown>> } } }
    }
    expect(migratedDocument.schemaVersion).toBe(4)
    expect(migratedDocument.game.session.simulation.villages[0]!.knowledge).toEqual([])
    expect(decodeSave(JSON.stringify(legacy)).ok).toBe(true)

    const forged = JSON.parse(serializeSave(createGameState(config))) as {
      game: { session: { simulation: { villages: Array<{ knowledge: unknown[] }> } } }
    }
    forged.game.session.simulation.villages[0]!.knowledge = ['masonry']
    expect(decodeSave(JSON.stringify(forged)).ok).toBe(false)
  })
})
