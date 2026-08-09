import { hash2d, seedToUint32 } from '../world/prng'
import type { Tile, ToolId, VillageSite, World } from '../world/types'
import { assessVillageKnowledge, villageKnowledgeDefinition, villageKnowledgeEffects } from './knowledge'
import { nearestVillage, tileDistance } from './metrics'
import { createWorldObjectives, refreshWorldObjectives } from './objectives'
import { nextVillageTool, STARTING_VILLAGE_TOOLS, villageEraForTools, villageEraLabel, villageToolEffects } from './progression'
import { EMPTY_GOD_TOOL_USES, MAX_SIMULATION_TICK } from './types'
import type {
  CouncilChoiceId,
  SimulationEvent,
  SimulationSpeed,
  SimulationState,
  StormState,
  VillageEra,
  VillageKnowledgeAssessment,
  VillageSimulation,
} from './types'

const MAX_EVENTS = 24
const MAX_VILLAGE_VALUE = 100_000
/** A hard ceiling protects callers outside the animation loop from pathological tick requests. */
export const MAX_ADVANCE_TICKS = 120
const SETTLEMENT_JOIN_DISTANCE = 4.5

interface EventInput {
  kind: string
  title: string
  detail: string
  tone: SimulationEvent['tone']
}

export type SpawnSettlersResult =
  | { ok: true; simulation: SimulationState; villageSite: VillageSite; createdVillage: boolean }
  | { ok: false; simulation: SimulationState; reason: string }

export type DevelopVillageToolResult =
  | { ok: true; simulation: SimulationState; toolLabel: string; era: VillageEra }
  | { ok: false; simulation: SimulationState; reason: string }

export type SubmitVillageKnowledgeResult =
  | { ok: true; simulation: SimulationState; knowledgeLabel: string; assessment: VillageKnowledgeAssessment }
  | { ok: false; simulation: SimulationState; reason: string; assessment: VillageKnowledgeAssessment }

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function appendEvent(state: SimulationState, input: EventInput): SimulationState {
  const event: SimulationEvent = {
    id: `event-${state.tick}-${input.kind}-${state.eventSequence}`,
    tick: state.tick,
    title: input.title,
    detail: input.detail,
    tone: input.tone,
  }
  return {
    ...state,
    eventSequence: state.eventSequence + 1,
    events: [event, ...state.events].slice(0, MAX_EVENTS),
  }
}

function eraFor(village: VillageSimulation): VillageEra {
  return villageEraForTools(village.tools)
}

interface SettlementEcology {
  fertility: number
  water: number
  forest: number
}

/**
 * Reads nearby, actual terrain rather than a global world average. Terrain
 * tools therefore have observable consequences for settlement survival.
 */
function settlementEcology(world: World, tileIndex: number): SettlementEcology {
  const home = world.tiles[tileIndex]
  if (!home) return { fertility: 0.2, water: 0.2, forest: 0 }
  let weightTotal = 0
  let fertility = 0
  let water = 0
  let forest = 0

  for (const tile of world.tiles) {
    const distance = Math.abs(tile.x - home.x) + Math.abs(tile.z - home.z)
    if (distance > 3) continue
    const weight = 1 - distance / 4
    weightTotal += weight
    fertility += weight * (tile.soil === 'màu mỡ' ? 1 : tile.soil === 'thường' ? 0.48 : 0.08)
    water += weight * (tile.biome === 'biển' || tile.moisture > 0.72 ? 1 : tile.moisture * 0.52)
    forest += weight * (tile.forest ? 1 : 0)
  }

  const divisor = Math.max(weightTotal, 1)
  return { fertility: fertility / divisor, water: water / divisor, forest: forest / divisor }
}

function localizedResourceScore(world: World, tileIndex: number): number {
  const home = world.tiles[tileIndex]
  if (!home) return 0.35
  let resourceScore = home.resources * 1.35
  let samples = 1

  for (const tile of world.tiles) {
    const distance = Math.abs(tile.x - home.x) + Math.abs(tile.z - home.z)
    if (distance > 3 || tile.biome === 'biển') continue
    resourceScore += tile.resources * (1 - distance / 5)
    samples += 1
  }

  return resourceScore / samples
}

function updateVillage(
  village: VillageSimulation,
  world: World,
  tick: number,
  storm: StormState | undefined,
  seed: number,
): VillageSimulation {
  const localResources = localizedResourceScore(world, village.tileIndex)
  const ecology = settlementEcology(world, village.tileIndex)
  const seasonalModifier = 0.9 + Math.sin(tick / 9) * 0.16
  const workers = Math.max(2, Math.floor(village.population * 0.57))
  const toolEffects = villageToolEffects(village.tools)
  const knowledgeEffects = villageKnowledgeEffects(village.knowledge)
  const researchBonus = clamp(village.research / 320, 0, 0.18)
  const territoryBonus = clamp(village.territory / 90, 0, 0.12)
  const harvest = workers * (
    0.1
    + localResources * 0.13
    + ecology.fertility * 0.14
    + ecology.water * 0.08
    + ecology.forest * 0.035
    + researchBonus
    + territoryBonus
    + toolEffects.harvest
    + knowledgeEffects.harvest
  ) * seasonalModifier
  const stormDefense = clamp(village.military / 65 + toolEffects.stormDefense + knowledgeEffects.stormDefense, 0, 0.62)
  const resilienceTarget = clamp(24 + ecology.fertility * 22 + ecology.water * 18 + ecology.forest * 17 + village.military * 0.23 + toolEffects.resilience + knowledgeEffects.resilience, 0, 100)
  const resilience = clamp(
    village.resilience + (resilienceTarget - village.resilience) * 0.075 + (storm ? -storm.intensity * 0.45 : 0.2),
    0,
    100,
  )
  const stormPenalty = storm ? storm.intensity * 0.7 * (1 - stormDefense) * (1 - resilience / 180) : 0
  const consumption = village.population * 0.11 + stormPenalty
  let food = clamp(village.food + harvest - consumption, 0, 999)
  let happiness = clamp(village.happiness + (food > village.population * 2 ? 0.45 : -0.8) - stormPenalty * 0.38, 0, 100)
  let population = clamp(village.population, 0, MAX_VILLAGE_VALUE)
  let homes = clamp(village.homes, 0, MAX_VILLAGE_VALUE)
  let research = clamp(village.research + (food > population * 2 ? 0.16 : 0.05) + toolEffects.research + knowledgeEffects.research, 0, MAX_VILLAGE_VALUE)
  const military = clamp(village.military + (storm ? 0.02 : 0.06), 0, 100)
  let territory = clamp(village.territory, 0, MAX_VILLAGE_VALUE)
  let lastDecision = storm
    ? 'Gia cố kho lương trước mưa lớn'
    : 'Cử nhóm thợ khai khẩn thung lũng'

  if (food === 0 && tick % 4 === 0 && population > 3) {
    population = clamp(population - 1, 0, MAX_VILLAGE_VALUE)
    happiness = clamp(happiness - 3, 0, 100)
    lastDecision = 'Chia lại khẩu phần để vượt qua thiếu đói'
  }

  if (tick % 10 === 0 && population >= homes * 4 && food > population * 2.6) {
    homes = clamp(homes + 1, 0, MAX_VILLAGE_VALUE)
    food -= 2.5
    lastDecision = 'Dựng một mái nhà mới bên quảng trường'
  }

  const birthRoll = hash2d(seed, tick, village.tileIndex)
  if (tick % 12 === 0 && food > population * 2.3 && happiness > 57 && birthRoll > 0.48) {
    population = clamp(population + 1, 0, MAX_VILLAGE_VALUE)
    lastDecision = 'Mở tiệc mừng một cư dân mới'
  }

  if (tick % 18 === 0 && localResources > 0.51 && hash2d(seed ^ 0x6d2b79f5, tick, village.tileIndex) > 0.64) {
    territory = clamp(territory + 1, 0, MAX_VILLAGE_VALUE)
    research = clamp(research + 0.8, 0, MAX_VILLAGE_VALUE)
    lastDecision = 'Đánh dấu một lối mòn giàu tài nguyên'
  }

  const updated: VillageSimulation = {
    ...village,
    population,
    food,
    happiness,
    homes,
    research,
    military,
    territory,
    resilience,
    era: village.era,
    lastDecision,
  }

  return { ...updated, era: eraFor(updated) }
}

function createPeriodicEvent(state: SimulationState, seed: number): EventInput | undefined {
  if (state.tick % 16 !== 0) return undefined
  const village = state.villages[0]
  if (!village) return undefined
  const roll = hash2d(seed ^ 0x9e3779b9, state.tick, village.tileIndex)

  if (roll > 0.78) {
    return { kind: 'resource-vein', title: 'Mạch quặng lộ thiên', detail: `${village.name} tăng tốc nghiên cứu nhờ một vỉa đá sáng.`, tone: 'good' }
  }
  if (roll < 0.18) {
    return { kind: 'thin-grass', title: 'Mùa cỏ thưa', detail: 'Nguồn thức ăn giảm nhẹ; dân làng ưu tiên tích trữ.', tone: 'warning' }
  }
  return { kind: 'campfire', title: 'Lửa trại đêm', detail: `${village.name} ghi thêm một mẩu chuyện vào biên niên sử.`, tone: 'calm' }
}

function villageFromSite(site: VillageSite, index: number): VillageSimulation {
  return {
    id: site.id,
    name: site.name,
    tileIndex: site.tileIndex,
    population: 9 + index * 2,
    food: 32,
    happiness: 68,
    homes: 3,
    research: 4,
    military: 2,
    territory: 3,
    resilience: 42,
    era: 'Thời Đồ Đá',
    tools: [...STARTING_VILLAGE_TOOLS],
    knowledge: [],
    lastDecision: 'Chọn nơi dựng lửa đầu tiên',
  }
}

export function isHabitableTile(tile: Tile | undefined): tile is Tile {
  return Boolean(tile && tile.biome !== 'biển' && tile.biome !== 'bờ cát' && tile.height > -0.05)
}

export function createSimulation(world: World): SimulationState {
  const state: SimulationState = {
    tick: 0,
    speed: 1,
    paused: false,
    villages: world.villages.map(villageFromSite),
    eventSequence: 0,
    events: [],
    objectives: createWorldObjectives(world),
    godToolUses: { ...EMPTY_GOD_TOOL_USES },
  }
  return appendEvent(state, {
    kind: 'first-dawn',
    title: 'Bình minh đầu tiên',
    detail: 'Một cộng đồng nhỏ bắt đầu viết lịch sử của Aetheria.',
    tone: 'good',
  })
}

export function advanceSimulation(state: SimulationState, world: World, ticks = 1): SimulationState {
  if (state.tick >= MAX_SIMULATION_TICK) {
    return state.paused && state.speed === 0 ? state : { ...state, speed: 0, paused: true }
  }

  let next = state
  const seed = seedToUint32(world.config.seed)
  const stepCount = Number.isFinite(ticks) ? Math.min(MAX_ADVANCE_TICKS, Math.max(0, Math.floor(ticks))) : 0

  for (let step = 0; step < stepCount; step += 1) {
    if (next.tick >= MAX_SIMULATION_TICK) break
    const tick = next.tick + 1
    const storm = next.activeStorm
    const villages = next.villages.map((village) => updateVillage(village, world, tick, storm, seed))
    const activeStorm = storm && storm.remainingTicks > 1
      ? { ...storm, remainingTicks: storm.remainingTicks - 1 }
      : undefined
    const steppedState: SimulationState = {
      tick,
      speed: next.speed,
      paused: next.paused,
      villages,
      eventSequence: next.eventSequence,
      events: next.events,
      objectives: next.objectives,
      godToolUses: next.godToolUses,
      ...(activeStorm ? { activeStorm } : {}),
      ...(next.pendingCouncil ? { pendingCouncil: next.pendingCouncil } : {}),
    }
    next = storm && storm.remainingTicks === 1
      ? appendEvent(steppedState, { kind: 'storm-cleared', title: 'Mây tan', detail: 'Mưa lớn rút đi; kho lương cần thời gian để hồi phục.', tone: 'calm' })
      : steppedState
    const periodicEvent = createPeriodicEvent(next, seed)
    if (periodicEvent) next = appendEvent(next, periodicEvent)
    const objectiveUpdate = refreshWorldObjectives(next.objectives, world, next.villages)
    next = { ...next, objectives: objectiveUpdate.objectives }
    for (const objective of objectiveUpdate.newlyCompleted) {
      next = appendEvent(next, {
        kind: 'objective-complete',
        title: 'Cột mốc: ' + objective.title,
        detail: objective.detail,
        tone: 'good',
      })
    }
  }

  return next.tick >= MAX_SIMULATION_TICK && (!next.paused || next.speed !== 0)
    ? { ...next, speed: 0, paused: true }
    : next
}

export function setSimulationSpeed(state: SimulationState, speed: SimulationSpeed): SimulationState {
  return { ...state, speed, paused: speed === 0 ? true : state.paused }
}

export function toggleSimulationPause(state: SimulationState): SimulationState {
  if (state.speed === 0) return { ...state, speed: 1, paused: false }
  return { ...state, paused: !state.paused }
}

export function spawnSettlersAt(state: SimulationState, world: World, tileIndex: number, amount = 4): SpawnSettlersResult {
  const tile = world.tiles[tileIndex]
  if (!isHabitableTile(tile)) {
    return { ok: false, simulation: state, reason: 'Cư dân chỉ có thể hạ trại trên đất khô, không phải biển hoặc bờ cát.' }
  }

  const settlers = Math.max(1, Math.min(12, Math.round(amount)))
  const nearest = nearestVillage(tile, world, state.villages)
  const nearestTile = nearest ? world.tiles[nearest.tileIndex] : undefined

  if (nearest && nearestTile && tileDistance(tile, nearestTile) <= SETTLEMENT_JOIN_DISTANCE) {
    if (nearest.population >= MAX_VILLAGE_VALUE) {
      return { ok: false, simulation: state, reason: 'Cộng đồng này đã đạt giới hạn dân số; hãy lập một tiền đồn mới.' }
    }
    const updatedVillage = {
      ...nearest,
      population: clamp(nearest.population + settlers, 0, MAX_VILLAGE_VALUE),
      happiness: clamp(nearest.happiness + 2, 0, 100),
      lastDecision: 'Đón những người lữ hành từ vùng đất lân cận',
    }
    const simulation = appendEvent(
      { ...state, villages: state.villages.map((village) => village.id === nearest.id ? updatedVillage : village) },
      { kind: 'settlers-joined', title: 'Người lữ hành đến', detail: `${settlers} cư dân mới gia nhập ${nearest.name}.`, tone: 'good' },
    )
    return { ok: true, simulation, villageSite: { id: nearest.id, name: nearest.name, tileIndex: nearest.tileIndex }, createdVillage: false }
  }

  const site: VillageSite = {
    id: `village-${tile.index}`,
    name: `Tiền đồn ${tile.x + 1}-${tile.z + 1}`,
    tileIndex: tile.index,
  }
  const existing = state.villages.find((village) => village.id === site.id)
  if (existing) {
    return { ok: false, simulation: state, reason: 'Ô này đã có một cộng đồng; hãy chọn một vùng đất khác.' }
  }
  const newVillage: VillageSimulation = {
    ...villageFromSite(site, state.villages.length),
    population: settlers,
    food: 12 + settlers,
    homes: 1,
    happiness: 72,
    lastDecision: 'Dựng trại mới theo ý chỉ của Người Kiến Tạo',
  }
  const simulation = appendEvent(
    { ...state, villages: [...state.villages, newVillage] },
    { kind: 'settlement-founded', title: 'Tiền đồn mới', detail: `${settlers} cư dân lập nên ${site.name} tại ô ${tile.x + 1}, ${tile.z + 1}.`, tone: 'good' },
  )
  return { ok: true, simulation, villageSite: site, createdVillage: true }
}

export function triggerStorm(state: SimulationState): SimulationState {
  const location = state.villages.length === 0 ? 'toàn cõi Aetheria' : 'toàn bộ các cộng đồng'
  return appendEvent(
    {
      ...state,
      activeStorm: { remainingTicks: 18, intensity: 1.6 },
      ...(state.pendingCouncil ? {} : {
        pendingCouncil: {
          id: 'council-storm-' + state.tick + '-' + state.eventSequence,
          issuedTick: state.tick,
          title: 'Mây đen ở chân trời',
          detail: 'Chọn một chuẩn bị có đánh đổi trước khi cơn mưa lớn quét qua các làng.',
        },
      }),
    },
    { kind: 'global-storm', title: 'Mưa lớn toàn cõi', detail: `Mây đen phủ ${location}; mùa màng và hạnh phúc đang chịu thử thách.`, tone: 'danger' },
  )
}

/**
 * Crafts exactly the next settlement tool. The action is explicit so players
 * decide when to trade stored food and research for a new era.
 */
export function developVillageTool(state: SimulationState, villageId = state.villages[0]?.id): DevelopVillageToolResult {
  const village = state.villages.find((candidate) => candidate.id === villageId)
  if (!village) return { ok: false, simulation: state, reason: 'Chưa có cộng đồng nào để phát triển công cụ.' }

  const tool = nextVillageTool(village.tools)
  if (!tool) return { ok: false, simulation: state, reason: `${village.name} đã hoàn thành toàn bộ chuỗi công cụ.` }

  const missingResearch = Math.max(0, Math.ceil(tool.researchCost - village.research))
  const missingFood = Math.max(0, Math.ceil(tool.foodCost - village.food))
  if (missingResearch > 0 || missingFood > 0) {
    const requirements = [
      missingResearch > 0 ? `thiếu ${missingResearch} nghiên cứu` : undefined,
      missingFood > 0 ? `thiếu ${missingFood} lương thực` : undefined,
    ].filter((value): value is string => Boolean(value))
    return { ok: false, simulation: state, reason: `Chưa thể rèn ${tool.label}: ${requirements.join(', ')}.` }
  }

  const tools = [...village.tools, tool.id]
  const era = eraFor({ ...village, tools })
  const developedVillage: VillageSimulation = {
    ...village,
    tools,
    food: clamp(village.food - tool.foodCost, 0, 999),
    research: clamp(village.research - tool.researchCost, 0, MAX_VILLAGE_VALUE),
    era,
    lastDecision: `Rèn ${tool.label} để đưa cộng đồng tiến lên`,
  }
  const next = { ...state, villages: state.villages.map((candidate) => candidate.id === village.id ? developedVillage : candidate) }
  const crafted = appendEvent(next, {
    kind: `craft-${tool.id}`,
    title: `Rèn ${tool.label}`,
    detail: `${village.name} dùng ${tool.researchCost} nghiên cứu và ${tool.foodCost} lương thực. ${tool.benefit}`,
    tone: 'good',
  })
  const simulation = village.era === era
    ? crafted
    : appendEvent(crafted, {
        kind: `era-${tool.id}`,
        title: `Bước vào ${villageEraLabel(era)}`,
        detail: `${village.name} mở thêm kiến trúc và công cụ mới trong thế giới 3D.`,
        tone: 'good',
      })
  return { ok: true, simulation, toolLabel: tool.label, era }
}

/**
 * Accepts only a catalogue-backed technique after checking the active village's
 * actual tool ledger and prerequisite knowledge. No free-form text affects the
 * deterministic simulation.
 */
export function submitVillageKnowledge(state: SimulationState, proposal: string, villageId = state.villages[0]?.id): SubmitVillageKnowledgeResult {
  const village = state.villages.find((candidate) => candidate.id === villageId)
  if (!village) {
    const assessment: VillageKnowledgeAssessment = {
      status: 'unrecognized',
      title: 'Chưa có cộng đồng để học hỏi',
      detail: 'Hãy lập một cộng đồng trước khi truyền đạt tri thức.',
    }
    return { ok: false, simulation: state, reason: assessment.detail, assessment }
  }

  const assessment = assessVillageKnowledge(village, proposal)
  if (assessment.status !== 'accepted' || !assessment.knowledgeId) {
    return { ok: false, simulation: state, reason: `${assessment.title}. ${assessment.detail}`, assessment }
  }

  const knowledge = villageKnowledgeDefinition(assessment.knowledgeId)
  const educatedVillage: VillageSimulation = {
    ...village,
    knowledge: [...village.knowledge, knowledge.id],
    lastDecision: `Truyền đạt ${knowledge.label} cho cộng đồng`,
  }
  const simulation = appendEvent(
    { ...state, villages: state.villages.map((candidate) => candidate.id === village.id ? educatedVillage : candidate) },
    {
      kind: `knowledge-${knowledge.id}`,
      title: `Tri thức: ${knowledge.label}`,
      detail: `${village.name} tiếp nhận ${knowledge.label}. ${knowledge.summary}`,
      tone: 'good',
    },
  )
  return { ok: true, simulation, knowledgeLabel: knowledge.label, assessment }
}

const GOD_TOOL_LABELS: Record<ToolId, string> = {
  raise: 'Nâng địa hình',
  lower: 'Hạ địa hình',
  water: 'Gọi nước',
  forest: 'Gieo rừng',
  fertile: 'Làm đất màu mỡ',
  barren: 'Làm đất cằn cỗi',
  settler: 'Thả cư dân',
  storm: 'Gọi mưa lớn',
}

/**
 * Records player intent for the chronicle without changing terrain, ticks, or
 * any deterministic outcome by itself.
 */
export function recordGodToolUse(state: SimulationState, tool: ToolId): SimulationState {
  const uses = state.godToolUses[tool] + 1
  const next = { ...state, godToolUses: { ...state.godToolUses, [tool]: uses } }
  if (uses !== 1 && uses % 5 !== 0) return next
  return appendEvent(next, {
    kind: 'god-tool-' + tool,
    title: GOD_TOOL_LABELS[tool],
    detail: uses === 1
      ? 'Quyền năng này lần đầu để lại dấu ấn trong biên niên sử.'
      : 'Quyền năng này đã được dùng ' + uses + ' lần.',
    tone: tool === 'storm' || tool === 'barren' ? 'warning' : 'calm',
  })
}

export function resolveCouncilDecision(state: SimulationState, choice: CouncilChoiceId): SimulationState {
  const pending = state.pendingCouncil
  if (!pending) return state
  const villages = state.villages.map((village) => {
    if (choice === 'stockpile') {
      return {
        ...village,
        food: clamp(village.food - 4, 0, 999),
        happiness: clamp(village.happiness - 1, 0, 100),
        resilience: clamp(village.resilience + 8, 0, 100),
        lastDecision: 'Hy sinh một phần lương thực để củng cố kho dự trữ',
      }
    }
    return {
      ...village,
      food: clamp(village.food - 3, 0, 999),
      happiness: clamp(village.happiness - 2, 0, 100),
      military: clamp(village.military + 8, 0, 100),
      resilience: clamp(village.resilience + 4, 0, 100),
      lastDecision: 'Tạm gác lễ hội để gia cố phòng vệ trước giông bão',
    }
  })
  const input: EventInput = choice === 'stockpile'
    ? {
        kind: 'council-stockpile',
        title: 'Kho lương được niêm phong',
        detail: 'Dân làng chấp nhận mất một phần tiện nghi để tăng sức hồi phục.',
        tone: 'good',
      }
    : {
        kind: 'council-ward',
        title: 'Tường chắn mưa được dựng lên',
        detail: 'Làng đổi chút lương thực và niềm vui lấy phòng vệ trước bão.',
        tone: 'good',
      }
  const resolved = { ...state, villages }
  delete resolved.pendingCouncil
  return appendEvent(resolved, input)
}
