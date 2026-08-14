import { beforeEach, describe, expect, it } from 'vitest'
import { createGameState } from './session'
import { generateWorld } from '../world/generator'
import { DEFAULT_WORLD_CONFIG } from '../world/types'
import {
  listSaveSlots,
  saveGameToSlot,
  loadGameFromSlot,
  deleteSaveSlot,
  renameSaveSlot,
} from './save'

class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  public get length(): number { return this.store.size }
  public clear(): void { this.store.clear() }
  public getItem(key: string): string | null { return this.store.get(key) ?? null }
  public key(index: number): string | null { return Array.from(this.store.keys())[index] ?? null }
  public removeItem(key: string): void { this.store.delete(key) }
  public setItem(key: string, value: string): void { this.store.set(key, value) }
}

describe('multi-slot saves', () => {
  let storage: Storage

  beforeEach(() => {
    storage = new MemoryStorage()
  })

  it('can save, list, load, rename, and delete multiple save slots', () => {
    const world1 = generateWorld({ ...DEFAULT_WORLD_CONFIG, seed: 'test-seed-1' })
    const game1 = createGameState(world1.config)

    const world2 = generateWorld({ ...DEFAULT_WORLD_CONFIG, seed: 'test-seed-2' })
    const game2 = createGameState(world2.config)

    // Save slot 1
    const meta1 = saveGameToSlot(game1, 'Thế giới Rừng Xanh', 'slot-1', 'sunrise-vale', storage)
    expect(meta1.slotId).toBe('slot-1')
    expect(meta1.worldName).toBe('Thế giới Rừng Xanh')

    // Save slot 2
    const meta2 = saveGameToSlot(game2, 'Đảo Hoang Dã', 'slot-2', 'coral-archipelago', storage)
    expect(meta2.slotId).toBe('slot-2')

    // List slots
    const slots = listSaveSlots(storage)
    expect(slots.length).toBe(2)
    expect(slots[0]?.slotId).toBe('slot-2') // latest first

    // Load slot 1
    const loadResult1 = loadGameFromSlot('slot-1', storage)
    expect(loadResult1.ok).toBe(true)
    if (loadResult1.ok) {
      expect(loadResult1.game.session.world.config.seed).toBe('test-seed-1')
    }

    // Rename slot 1
    expect(renameSaveSlot('slot-1', 'Thung Lũng Đại Ngàn', storage)).toBe(true)
    const updatedSlots = listSaveSlots(storage)
    expect(updatedSlots.find((s) => s.slotId === 'slot-1')?.worldName).toBe('Thung Lũng Đại Ngàn')

    // Delete slot 2
    expect(deleteSaveSlot('slot-2', storage)).toBe(true)
    expect(listSaveSlots(storage).length).toBe(1)
    expect(loadGameFromSlot('slot-2', storage).ok).toBe(false)
  })
})
