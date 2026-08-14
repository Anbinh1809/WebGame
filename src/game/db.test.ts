import { beforeEach, describe, expect, it } from 'vitest'
import { aetheriaDb, DB_NAME, DB_VERSION } from './db'
import { generateWorld } from '../world/generator'
import { DEFAULT_WORLD_CONFIG } from '../world/types'
import { createGameState } from './session'

class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  public get length(): number { return this.store.size }
  public clear(): void { this.store.clear() }
  public getItem(key: string): string | null { return this.store.get(key) ?? null }
  public key(index: number): string | null { return Array.from(this.store.keys())[index] ?? null }
  public removeItem(key: string): void { this.store.delete(key) }
  public setItem(key: string, value: string): void { this.store.set(key, value) }
}

describe('Aetheria IndexedDB & Storage Engine', () => {
  let storage: Storage

  beforeEach(() => {
    storage = new MemoryStorage()
  })

  it('exposes database configuration and support detection', () => {
    expect(DB_NAME).toBe('aetheria-world-shaper-db')
    expect(DB_VERSION).toBe(2)
    expect(typeof aetheriaDb.isIndexedDbSupported()).toBe('boolean')
  })

  it('can save, list, load, rename, and delete game states through database API', async () => {
    const world = generateWorld({ ...DEFAULT_WORLD_CONFIG, seed: 'db-test-seed' })
    const game = createGameState(world.config)

    const meta = await aetheriaDb.saveGame(game, 'Thế Giới Khởi Nguyên', 'db-slot-1', 'sunrise-vale', storage)
    expect(meta.slotId).toBe('db-slot-1')
    expect(meta.worldName).toBe('Thế Giới Khởi Nguyên')
    expect(meta.seed).toBe('db-test-seed')

    const slots = await aetheriaDb.listSlots(storage)
    expect(slots.some((s) => s.slotId === 'db-slot-1')).toBe(true)

    const loadResult = await aetheriaDb.loadGame('db-slot-1', storage)
    expect(loadResult.ok).toBe(true)
    if (loadResult.ok) {
      expect(loadResult.game.session.world.config.seed).toBe('db-test-seed')
    }

    const renamed = await aetheriaDb.renameSlot('db-slot-1', 'Thế Giới Đổi Tên', storage)
    expect(renamed).toBe(true)

    const deleted = await aetheriaDb.deleteSlot('db-slot-1', storage)
    expect(deleted).toBe(true)
  })

  it('handles telemetry logging gracefully', async () => {
    await aetheriaDb.logTelemetry({
      level: 'info',
      category: 'simulation',
      message: 'Test simulation event recorded',
      details: { tick: 100 },
    })

    const logs = await aetheriaDb.getRecentLogs(10)
    expect(Array.isArray(logs)).toBe(true)
  })
})
