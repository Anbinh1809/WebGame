import type { GameSession, GameState } from './session'
import { MAX_SIMULATION_TICK } from '../simulation/types'
import type { SimulationEvent, SimulationState, VillageSimulation } from '../simulation/types'
import { refreshTileBiome } from '../world/generator'
import type { SoilKind, TerrainKind, Tile, VillageSite, World, WorldConfig } from '../world/types'

export const SAVE_SCHEMA_VERSION = 1
export const SAVE_STORAGE_KEY = 'aetheria-world-shaper.save.v1'
/**
 * Saves are intentionally bounded before JSON.parse. This keeps a corrupt or
 * accidentally huge local import from freezing the single-page game.
 */
export const MAX_SAVE_BYTES = 2_500_000

interface SaveDocument {
  schemaVersion: number
  savedAt: string
  game: GameState
}

export type SaveDecodeResult =
  | { ok: true; game: GameState }
  | { ok: false; reason: string }

const CLIMATES = ['ôn hòa', 'ấm', 'lạnh'] as const
const BIOMES = ['biển', 'bờ cát', 'đồng cỏ', 'rừng', 'đồi', 'núi', 'tuyết'] as const
const SOILS = ['thường', 'màu mỡ', 'cằn cỗi'] as const
const ERAS = ['Mầm lửa', 'Nhà gỗ', 'Thợ đá'] as const
const EVENT_TONES = ['calm', 'good', 'warning', 'danger'] as const
const SIMULATION_SPEEDS = [0, 1, 2, 4, 8] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isInteger(value) && (value as number) >= minimum && (value as number) <= maximum
}

function isNumberInRange(value: unknown, minimum: number, maximum: number): value is number {
  return isFiniteNumber(value) && value >= minimum && value <= maximum
}

function isOneOf<T extends string | number>(value: unknown, choices: readonly T[]): value is T {
  return choices.includes(value as T)
}

function hasUniqueIds(items: Array<{ id: string }>): boolean {
  return new Set(items.map((item) => item.id)).size === items.length
}

function isWorldConfig(value: unknown): value is WorldConfig {
  if (!isRecord(value)) return false
  return typeof value.seed === 'string'
    && value.seed.length > 0
    && value.seed.length <= 64
    && value.seed === value.seed.trim()
    && isIntegerInRange(value.size, 18, 52)
    && isOneOf(value.climate, CLIMATES)
    && isNumberInRange(value.water, 0.2, 0.82)
    && isNumberInRange(value.resources, 0.2, 1)
}

function isTile(value: unknown): value is Tile {
  if (!isRecord(value)) return false
  return Number.isInteger(value.index)
    && Number.isInteger(value.x)
    && Number.isInteger(value.z)
    && isNumberInRange(value.height, -0.75, 1.62)
    && isNumberInRange(value.moisture, 0, 1)
    && isNumberInRange(value.temperature, 0, 1)
    && isOneOf(value.biome, BIOMES as readonly TerrainKind[])
    && isOneOf(value.soil, SOILS as readonly SoilKind[])
    && typeof value.forest === 'boolean'
    && isNumberInRange(value.resources, 0, 1)
}

function isEcologicallyConsistentTile(tile: Tile, config: WorldConfig): boolean {
  const refreshed = refreshTileBiome(tile, config)
  return refreshed.biome === tile.biome && refreshed.forest === tile.forest && refreshed.resources === tile.resources
}

function isVillageSite(value: unknown, tileCount: number): value is VillageSite {
  return isRecord(value)
    && typeof value.id === 'string'
    && value.id.length > 0
    && value.id.length <= 96
    && typeof value.name === 'string'
    && value.name.length > 0
    && value.name.length <= 96
    && isIntegerInRange(value.tileIndex, 0, tileCount - 1)
}

function isWorld(value: unknown): value is World {
  if (!isRecord(value) || !isWorldConfig(value.config) || !Array.isArray(value.tiles) || !Array.isArray(value.villages)) return false
  const config = value.config
  const tiles = value.tiles
  const villages = value.villages
  const tileCount = config.size * config.size

  if (!isIntegerInRange(value.revision, 0, Number.MAX_SAFE_INTEGER) || tiles.length !== tileCount || !tiles.every(isTile)) return false
  if (!tiles.every((tile, index) => tile.index === index && tile.x === index % config.size && tile.z === Math.floor(index / config.size))) return false
  if (!villages.every((village) => isVillageSite(village, tileCount))) return false

  const typedTiles = tiles as Tile[]
  const sites = villages as VillageSite[]
  return hasUniqueIds(sites)
    && new Set(sites.map((site) => site.tileIndex)).size === sites.length
    && typedTiles.every((tile) => isEcologicallyConsistentTile(tile, config))
    && sites.every((site) => {
      const home = typedTiles[site.tileIndex]
      return Boolean(home && home.biome !== 'biển' && home.biome !== 'bờ cát')
    })
}

function isVillageSimulation(value: unknown, world: World): value is VillageSimulation {
  if (!isRecord(value)) return false
  const matchingSite = world.villages.find((site) => site.id === value.id && site.tileIndex === value.tileIndex)
  return typeof value.id === 'string'
    && matchingSite !== undefined
    && typeof value.name === 'string'
    && value.name === matchingSite.name
    && isIntegerInRange(value.tileIndex, 0, world.tiles.length - 1)
    && isIntegerInRange(value.population, 0, 100_000)
    && isNumberInRange(value.food, 0, 999)
    && isNumberInRange(value.happiness, 0, 100)
    && isIntegerInRange(value.homes, 0, 100_000)
    && isNumberInRange(value.research, 0, 100_000)
    && isNumberInRange(value.military, 0, 100)
    && isIntegerInRange(value.territory, 0, 100_000)
    && isOneOf(value.era, ERAS)
    && typeof value.lastDecision === 'string'
    && value.lastDecision.length <= 512
}

function isStorm(value: unknown): boolean {
  return isRecord(value)
    && isIntegerInRange(value.remainingTicks, 1, 18)
    && isNumberInRange(value.intensity, 0.1, 3)
}

function isEvent(value: unknown, currentTick: number): value is SimulationEvent {
  if (!isRecord(value) || typeof value.id !== 'string' || !isIntegerInRange(value.tick, 0, currentTick)) return false
  const idParts = /^event-(\d+)-[a-z][a-z0-9-]*-(\d+)$/.exec(value.id)
  const eventTick = idParts ? Number(idParts[1]) : Number.NaN
  const eventSequence = idParts ? Number(idParts[2]) : Number.NaN
  return value.id.length > 0
    && Number.isSafeInteger(eventTick)
    && eventTick === value.tick
    && Number.isSafeInteger(eventSequence)
    && typeof value.title === 'string'
    && value.title.length > 0
    && value.title.length <= 160
    && typeof value.detail === 'string'
    && value.detail.length <= 512
    && isOneOf(value.tone, EVENT_TONES)
}

function isSimulation(value: unknown, world: World): value is SimulationState {
  if (!isRecord(value)) return false
  const tick = value.tick
  if (!isIntegerInRange(tick, 0, MAX_SIMULATION_TICK) || !isOneOf(value.speed, SIMULATION_SPEEDS) || typeof value.paused !== 'boolean' || !isIntegerInRange(value.eventSequence, 0, Number.MAX_SAFE_INTEGER)) return false
  if (!Array.isArray(value.villages) || !Array.isArray(value.events) || value.events.length > 24) return false
  if ('activeStorm' in value && value.activeStorm !== undefined && !isStorm(value.activeStorm)) return false
  if (!value.villages.every((village) => isVillageSimulation(village, world))) return false
  if (!value.events.every((event) => isEvent(event, tick))) return false
  const villages = value.villages as VillageSimulation[]
  const events = value.events as SimulationEvent[]
  const highestEventSequence = events.reduce((highest, event) => {
    const match = /^event-\d+-[a-z][a-z0-9-]*-(\d+)$/.exec(event.id)
    return Math.max(highest, Number(match?.[1] ?? -1))
  }, -1)
  return hasUniqueIds(villages)
    && hasUniqueIds(events)
    && villages.length === world.villages.length
    && world.villages.every((site) => villages.some((village) => village.id === site.id && village.tileIndex === site.tileIndex && village.name === site.name))
    && value.eventSequence > highestEventSequence
}

function isSession(value: unknown): value is GameSession {
  return isRecord(value) && isWorld(value.world) && isSimulation(value.simulation, value.world)
}

function isGameState(value: unknown): value is GameState {
  return isRecord(value) && isSession(value.session) && Array.isArray(value.undoStack) && Array.isArray(value.redoStack)
    && value.undoStack.length === 0
    && value.redoStack.length === 0
}

/** Undo snapshots are useful in one active session, but are not persisted. */
function makePersistentGame(game: GameState): GameState {
  return { session: game.session, undoStack: [], redoStack: [] }
}

export function serializeSave(game: GameState): string {
  const document: SaveDocument = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    game: makePersistentGame(game),
  }
  return JSON.stringify(document)
}

export function decodeSave(raw: string): SaveDecodeResult {
  if (raw.length > MAX_SAVE_BYTES) {
    return { ok: false, reason: 'Tệp lưu quá lớn để nạp an toàn. Hãy dùng bản xuất JSON dưới 2.5 MB.' }
  }
  try {
    const value: unknown = JSON.parse(raw)
    if (!isRecord(value) || value.schemaVersion !== SAVE_SCHEMA_VERSION || typeof value.savedAt !== 'string' || Number.isNaN(Date.parse(value.savedAt))) {
      return { ok: false, reason: 'Tệp lưu không đúng phiên bản dữ liệu Aetheria.' }
    }
    if (!isGameState(value.game)) return { ok: false, reason: 'Tệp lưu bị thiếu hoặc có dữ liệu thế giới không hợp lệ.' }
    return { ok: true, game: value.game }
  } catch {
    return { ok: false, reason: 'Không thể đọc JSON của tệp lưu.' }
  }
}

export function saveToLocalStorage(game: GameState, storage: Storage = window.localStorage): void {
  storage.setItem(SAVE_STORAGE_KEY, serializeSave(game))
}

export function loadFromLocalStorage(storage: Storage = window.localStorage): SaveDecodeResult {
  const raw = storage.getItem(SAVE_STORAGE_KEY)
  return raw ? decodeSave(raw) : { ok: false, reason: 'Chưa có bản lưu cục bộ trên thiết bị này.' }
}
