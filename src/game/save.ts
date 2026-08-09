import type { GameSession, GameState } from './session'
import { createWorldObjectives } from '../simulation/objectives'
import { isVillageKnowledgeLedger } from '../simulation/knowledge'
import { villageEraForTools } from '../simulation/progression'
import { EMPTY_GOD_TOOL_USES, MAX_SIMULATION_TICK, VILLAGE_TOOL_IDS } from '../simulation/types'
import type { CouncilDecision, SimulationEvent, SimulationState, VillageSimulation, VillageToolId, WorldObjective } from '../simulation/types'
import { refreshTileBiome } from '../world/generator'
import type { SoilKind, TerrainKind, Tile, ToolId, VillageSite, World, WorldConfig } from '../world/types'

export const SAVE_SCHEMA_VERSION = 4
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
const ERAS = ['Thời Đồ Đá', 'Làng Gỗ', 'Nông Nghiệp', 'Thời Kim Khí', 'Thị Trấn'] as const
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
    && isIntegerInRange(value.size, 18, 64)
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
    && isNumberInRange(value.resilience, 0, 100)
    && isOneOf(value.era, ERAS)
    && isVillageToolLedger(value.tools)
    && isVillageKnowledgeLedger(value.knowledge, value.tools)
    && value.era === villageEraForTools(value.tools)
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

/** Prevent imports from granting late-game bonuses by forging an out-of-order tool list. */
function isVillageToolLedger(value: unknown): value is VillageToolId[] {
  return Array.isArray(value)
    && value.length > 0
    && value.length <= VILLAGE_TOOL_IDS.length
    && value.every((toolId, index) => toolId === VILLAGE_TOOL_IDS[index])
}

function isGodToolUses(value: unknown): value is Record<ToolId, number> {
  if (!isRecord(value)) return false
  const expectedKeys = Object.keys(EMPTY_GOD_TOOL_USES) as ToolId[]
  const valueKeys = Object.keys(value)
  return valueKeys.length === expectedKeys.length
    && expectedKeys.every((tool) => isIntegerInRange(value[tool], 0, 100_000))
}

function isObjective(value: unknown, expected: WorldObjective): value is WorldObjective {
  if (!isRecord(value)) return false
  return value.id === expected.id
    && value.metric === expected.metric
    && value.title === expected.title
    && value.detail === expected.detail
    && value.target === expected.target
    && isIntegerInRange(value.progress, 0, 100_000)
    && typeof value.completed === 'boolean'
    && value.completed === (value.progress >= value.target)
}

function hasExpectedObjectives(value: unknown, world: World): value is WorldObjective[] {
  if (!Array.isArray(value)) return false
  const expected = createWorldObjectives(world)
  return value.length === expected.length && expected.every((objective, index) => isObjective(value[index], objective))
}

function isCouncilDecision(value: unknown, currentTick: number): value is CouncilDecision {
  return isRecord(value)
    && /^council-storm-\d+-\d+$/.test(String(value.id))
    && isIntegerInRange(value.issuedTick, 0, currentTick)
    && typeof value.title === 'string'
    && value.title.length > 0
    && value.title.length <= 160
    && typeof value.detail === 'string'
    && value.detail.length > 0
    && value.detail.length <= 512
}

function isSimulation(value: unknown, world: World): value is SimulationState {
  if (!isRecord(value)) return false
  const tick = value.tick
  if (!isIntegerInRange(tick, 0, MAX_SIMULATION_TICK) || !isOneOf(value.speed, SIMULATION_SPEEDS) || typeof value.paused !== 'boolean' || !isIntegerInRange(value.eventSequence, 0, Number.MAX_SAFE_INTEGER)) return false
  if (!Array.isArray(value.villages) || !Array.isArray(value.events) || value.events.length > 24) return false
  if ('activeStorm' in value && value.activeStorm !== undefined && !isStorm(value.activeStorm)) return false
  if ('pendingCouncil' in value && value.pendingCouncil !== undefined && !isCouncilDecision(value.pendingCouncil, tick)) return false
  if (!hasExpectedObjectives(value.objectives, world) || !isGodToolUses(value.godToolUses)) return false
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

/**
 * Migration only fills deterministic defaults. The final v4 validator still
 * treats every imported field as untrusted input.
 */
export function migrateSaveDocument(value: unknown): unknown {
  const v2 = migrateV1SaveDocument(value)
  const v3 = migrateV2SaveDocument(v2)
  return migrateV3SaveDocument(v3)
}

function migrateV1SaveDocument(value: unknown): unknown {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.game)) return value
  const game = value.game
  if (!isRecord(game.session) || !isRecord(game.session.world) || !isRecord(game.session.simulation)) return value
  const world = game.session.world
  const simulation = game.session.simulation
  if (!isRecord(world.config) || typeof world.config.seed !== 'string' || !Array.isArray(simulation.villages)) return value
  const legacyWorld = world as unknown as World

  return {
    ...value,
    schemaVersion: 2,
    game: {
      ...game,
      session: {
        ...game.session,
        simulation: {
          ...simulation,
          villages: simulation.villages.map((village) => isRecord(village) ? { ...village, resilience: 42 } : village),
          objectives: createWorldObjectives(legacyWorld),
          godToolUses: { ...EMPTY_GOD_TOOL_USES },
        },
      },
    },
  }
}

function toolsForLegacyEra(era: unknown): VillageToolId[] | undefined {
  const counts: Record<string, number> = {
    'Mầm lửa': 1,
    'Nhà gỗ': 2,
    'Thợ đá': 3,
    'Nông trang': 4,
    'Thành đá': 7,
    'Thời Đồ Đá': 1,
    'Làng Gỗ': 2,
    'Nông Nghiệp': 4,
    'Thời Kim Khí': 6,
    'Thị Trấn': 7,
  }
  const count = typeof era === 'string' ? counts[era] : undefined
  return count === undefined ? undefined : [...VILLAGE_TOOL_IDS.slice(0, count)]
}

function migrateV2SaveDocument(value: unknown): unknown {
  if (!isRecord(value) || value.schemaVersion !== 2 || !isRecord(value.game)) return value
  const game = value.game
  if (!isRecord(game.session) || !isRecord(game.session.simulation)) return value
  const simulation = game.session.simulation
  if (!Array.isArray(simulation.villages)) return value

  return {
    ...value,
    schemaVersion: 3,
    game: {
      ...game,
      session: {
        ...game.session,
        simulation: {
          ...simulation,
          villages: simulation.villages.map((village) => {
            if (!isRecord(village)) return village
            const tools = toolsForLegacyEra(village.era)
            return tools ? { ...village, tools, era: villageEraForTools(tools) } : village
          }),
        },
      },
    },
  }
}

function migrateV3SaveDocument(value: unknown): unknown {
  if (!isRecord(value) || value.schemaVersion !== 3 || !isRecord(value.game)) return value
  const game = value.game
  if (!isRecord(game.session) || !isRecord(game.session.simulation)) return value
  const simulation = game.session.simulation
  if (!Array.isArray(simulation.villages)) return value

  return {
    ...value,
    schemaVersion: SAVE_SCHEMA_VERSION,
    game: {
      ...game,
      session: {
        ...game.session,
        simulation: {
          ...simulation,
          villages: simulation.villages.map((village) => (
            isRecord(village) && !('knowledge' in village) ? { ...village, knowledge: [] } : village
          )),
        },
      },
    },
  }
}

export function decodeSave(raw: string): SaveDecodeResult {
  if (raw.length > MAX_SAVE_BYTES) {
    return { ok: false, reason: 'Tệp lưu quá lớn để nạp an toàn. Hãy dùng bản xuất JSON dưới 2.5 MB.' }
  }
  try {
    const value = migrateSaveDocument(JSON.parse(raw) as unknown)
    if (!isRecord(value) || value.schemaVersion !== SAVE_SCHEMA_VERSION || typeof value.savedAt !== 'string' || Number.isNaN(Date.parse(value.savedAt))) {
      return { ok: false, reason: 'Tệp lưu không đúng phiên bản dữ liệu Aetheria.' }
    }
    if (!isRecord(value.game) || !isRecord(value.game.session)) {
      return { ok: false, reason: 'Tệp lưu bị thiếu phiên chơi hợp lệ.' }
    }
    if (!isWorld(value.game.session.world)) {
      return { ok: false, reason: 'Tệp lưu có dữ liệu thế giới không hợp lệ.' }
    }
    if (!isSimulation(value.game.session.simulation, value.game.session.world)) {
      return { ok: false, reason: 'Tệp lưu có dữ liệu mô phỏng không hợp lệ.' }
    }
    if (!isGameState(value.game)) return { ok: false, reason: 'Tệp lưu chứa lịch sử không được phép nhập.' }
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
