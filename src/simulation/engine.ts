import { hash2d, seedToUint32 } from '../world/prng'
import type { World } from '../world/types'
import type {
  SimulationEvent,
  SimulationSpeed,
  SimulationState,
  StormState,
  VillageEra,
  VillageSimulation,
} from './types'

const MAX_EVENTS = 9

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function appendEvent(state: SimulationState, event: SimulationEvent): SimulationState {
  return { ...state, events: [event, ...state.events].slice(0, MAX_EVENTS) }
}

function eventFor(
  tick: number,
  title: string,
  detail: string,
  tone: SimulationEvent['tone'],
): SimulationEvent {
  return { id: `${tick}-${title}`, tick, title, detail, tone }
}

function eraFor(village: VillageSimulation): VillageEra {
  if (village.research >= 44 && village.homes >= 7) return 'Thợ đá'
  if (village.homes >= 4) return 'Nhà gỗ'
  return 'Mầm lửa'
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
  const seasonalModifier = 0.9 + Math.sin(tick / 9) * 0.16
  const workers = Math.max(2, Math.floor(village.population * 0.57))
  const harvest = workers * (0.14 + localResources * 0.17) * seasonalModifier
  const stormPenalty = storm ? storm.intensity * 0.7 : 0
  const consumption = village.population * 0.11 + stormPenalty
  let food = clamp(village.food + harvest - consumption, 0, 999)
  let happiness = clamp(village.happiness + (food > village.population * 2 ? 0.45 : -0.8) - stormPenalty * 0.38, 0, 100)
  let population = village.population
  let homes = village.homes
  let research = village.research + (food > population * 2 ? 0.16 : 0.05)
  const military = village.military + (storm ? 0.02 : 0.06)
  let territory = village.territory
  let lastDecision = storm ? 'Gia cố kho lương trước mưa lớn' : 'Cử nhóm thợ khai khẩn thung lũng'

  if (food === 0 && tick % 4 === 0 && population > 3) {
    population -= 1
    happiness = clamp(happiness - 3, 0, 100)
    lastDecision = 'Chia lại khẩu phần để vượt qua thiếu đói'
  }

  if (tick % 10 === 0 && population >= homes * 4 && food > population * 2.6) {
    homes += 1
    food -= 2.5
    lastDecision = 'Dựng một mái nhà mới bên quảng trường'
  }

  const birthRoll = hash2d(seed, tick, village.tileIndex)
  if (tick % 12 === 0 && food > population * 2.3 && happiness > 57 && birthRoll > 0.48) {
    population += 1
    lastDecision = 'Mở tiệc mừng một cư dân mới'
  }

  if (tick % 18 === 0 && localResources > 0.51 && hash2d(seed ^ 0x6d2b79f5, tick, village.tileIndex) > 0.64) {
    territory += 1
    research += 0.8
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
    era: village.era,
    lastDecision,
  }

  return { ...updated, era: eraFor(updated) }
}

function createPeriodicEvent(state: SimulationState, seed: number): SimulationEvent | undefined {
  if (state.tick % 16 !== 0) return undefined
  const village = state.villages[0]
  if (!village) return undefined
  const roll = hash2d(seed ^ 0x9e3779b9, state.tick, village.tileIndex)

  if (roll > 0.78) {
    return eventFor(state.tick, 'Mạch quặng lộ thiên', `${village.name} tăng tốc nghiên cứu nhờ một vỉa đá sáng.`, 'good')
  }
  if (roll < 0.18) {
    return eventFor(state.tick, 'Mùa cỏ thưa', 'Nguồn thức ăn giảm nhẹ; dân làng ưu tiên tích trữ.', 'warning')
  }
  return eventFor(state.tick, 'Lửa trại đêm', `${village.name} ghi thêm một mẩu chuyện vào biên niên sử.`, 'calm')
}

export function createSimulation(world: World): SimulationState {
  const villages = world.villages.map((site, index) => ({
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
    era: 'Mầm lửa' as VillageEra,
    lastDecision: 'Chọn nơi dựng lửa đầu tiên',
  }))

  return {
    tick: 0,
    speed: 1,
    paused: false,
    villages,
    events: [eventFor(0, 'Bình minh đầu tiên', 'Một cộng đồng nhỏ bắt đầu viết lịch sử của Aetheria.', 'good')],
  }
}

export function advanceSimulation(state: SimulationState, world: World, ticks = 1): SimulationState {
  let next = state
  const seed = seedToUint32(world.config.seed)

  for (let step = 0; step < ticks; step += 1) {
    const tick = next.tick + 1
    const storm = next.activeStorm
    const villages = next.villages.map((village) => updateVillage(village, world, tick, storm, seed))
    let activeStorm: StormState | undefined
    let events = next.events

    if (storm && storm.remainingTicks > 1) {
      activeStorm = { ...storm, remainingTicks: storm.remainingTicks - 1 }
    }

    if (storm && storm.remainingTicks === 1) {
      events = [eventFor(tick, 'Mây tan', 'Mưa lớn rút đi; kho lương cần thời gian để hồi phục.', 'calm'), ...events].slice(0, MAX_EVENTS)
    }

    const steppedState: SimulationState = {
      tick,
      speed: next.speed,
      paused: next.paused,
      villages,
      events,
    }
    next = activeStorm ? { ...steppedState, activeStorm } : steppedState
    const periodicEvent = createPeriodicEvent(next, seed)
    if (periodicEvent) next = appendEvent(next, periodicEvent)
  }

  return next
}

export function setSimulationSpeed(state: SimulationState, speed: SimulationSpeed): SimulationState {
  return { ...state, speed, paused: speed === 0 ? true : state.paused }
}

export function toggleSimulationPause(state: SimulationState): SimulationState {
  return { ...state, paused: !state.paused }
}

export function spawnSettlers(state: SimulationState, amount = 4): SimulationState {
  const village = state.villages[0]
  if (!village) return state
  const settlers = Math.max(1, Math.min(12, Math.round(amount)))
  const updatedVillage = { ...village, population: village.population + settlers, happiness: clamp(village.happiness + 2, 0, 100) }
  const next = { ...state, villages: [updatedVillage, ...state.villages.slice(1)] }
  return appendEvent(next, eventFor(state.tick, 'Người lữ hành đến', `${settlers} cư dân mới gia nhập ${village.name}.`, 'good'))
}

export function triggerStorm(state: SimulationState): SimulationState {
  const village = state.villages[0]
  if (!village) return state
  const next = {
    ...state,
    activeStorm: { remainingTicks: 18, intensity: 1.6 },
  }
  return appendEvent(next, eventFor(state.tick, 'Mưa lớn', `Mây đen phủ ${village.name}; mùa màng và hạnh phúc đang chịu thử thách.`, 'danger'))
}
