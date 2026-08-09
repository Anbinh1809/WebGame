import { describe, expect, it } from 'vitest'
import { advanceSimulation, createSimulation, developVillageTool, isHabitableTile, MAX_ADVANCE_TICKS, recordGodToolUse, resolveCouncilDecision, spawnSettlersAt, submitVillageKnowledge, toggleSimulationPause, triggerStorm } from './engine'
import { MAX_SIMULATION_TICK } from './types'
import { generateWorld } from '../world/generator'
import type { WorldConfig } from '../world/types'

const config: WorldConfig = {
  seed: 'mô-phỏng-cố-định',
  size: 28,
  climate: 'ôn hòa',
  water: 0.54,
  resources: 0.62,
}

describe('simulation engine', () => {
  it('advances deterministically for an identical world and tick count', () => {
    const world = generateWorld(config)
    const first = advanceSimulation(createSimulation(world), world, 48)
    const second = advanceSimulation(createSimulation(world), world, 48)
    expect(second).toEqual(first)
  })

  it('records and resolves a storm disaster', () => {
    const world = generateWorld(config)
    const storm = triggerStorm(createSimulation(world))
    const resolved = advanceSimulation(storm, world, 18)
    expect(storm.activeStorm).toBeDefined()
    expect(resolved.activeStorm).toBeUndefined()
    expect(resolved.events.some((event) => event.title === 'Mây tan')).toBe(true)
  })

  it('creates deterministic unique IDs when more than one event happens in the same tick', () => {
    const world = generateWorld(config)
    const state = { ...createSimulation(world), tick: 15, activeStorm: { remainingTicks: 1, intensity: 1.6 } }
    const next = advanceSimulation(state, world, 1)
    const sameTick = next.events.filter((event) => event.tick === 16)
    expect(sameTick.length).toBeGreaterThanOrEqual(2)
    expect(new Set(next.events.map((event) => event.id)).size).toBe(next.events.length)
    expect(advanceSimulation(state, world, 1).events).toEqual(next.events)
  })

  it('spawns settlers at the clicked habitable tile and rejects water tiles', () => {
    const world = generateWorld(config)
    const initial = createSimulation(world)
    const invalid = world.tiles.find((tile) => tile.biome === 'biển' || tile.biome === 'bờ cát')
    const valid = world.tiles.find((tile) => isHabitableTile(tile))
    expect(invalid).toBeDefined()
    expect(valid).toBeDefined()
    if (!invalid || !valid) return
    expect(spawnSettlersAt(initial, world, invalid.index).ok).toBe(false)
    const accepted = spawnSettlersAt(initial, world, valid.index)
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return
    expect(accepted.simulation.events[0]?.id).toMatch(/^event-0-(settlers-joined|settlement-founded)-/)
    expect(accepted.simulation.villages.some((village) => village.tileIndex === valid.index)).toBe(true)
  })

  it('makes storms explicitly global, independent of a tile selection', () => {
    const world = generateWorld(config)
    const storm = triggerStorm(createSimulation(world))
    expect(storm.events[0]?.title).toBe('Mưa lớn toàn cõi')
    expect(storm.events[0]?.detail).toContain('toàn')
  })

  it('bounds pathological tick requests and resumes a zero-speed imported simulation safely', () => {
    const world = generateWorld(config)
    const initial = createSimulation(world)

    expect(advanceSimulation(initial, world, Number.POSITIVE_INFINITY)).toEqual(initial)
    expect(advanceSimulation(initial, world, MAX_ADVANCE_TICKS + 10).tick).toBe(MAX_ADVANCE_TICKS)
    expect(toggleSimulationPause({ ...initial, speed: 0, paused: true })).toMatchObject({ speed: 1, paused: false })
  })

  it('does not overflow the simulation clock or a full settlement through repeated settler clicks', () => {
    const world = generateWorld(config)
    const initial = createSimulation(world)
    const village = initial.villages[0]!
    const saturated = { ...initial, villages: [{ ...village, population: 100_000 }] }

    expect(advanceSimulation({ ...initial, tick: MAX_SIMULATION_TICK }, world, 1)).toMatchObject({
      tick: MAX_SIMULATION_TICK,
      speed: 0,
      paused: true,
    })
    expect(spawnSettlersAt(saturated, world, village.tileIndex).ok).toBe(false)
  })

  it('uses nearby fertility, water, and forest for deterministic harvest and resilience', () => {
    const world = generateWorld(config)
    const home = world.tiles[world.villages[0]!.tileIndex]!
    const restoredEcology = {
      ...world,
      tiles: world.tiles.map((tile) => Math.abs(tile.x - home.x) + Math.abs(tile.z - home.z) <= 3
        ? { ...tile, soil: 'màu mỡ' as const, moisture: 1, forest: true, resources: 1 }
        : tile),
    }
    const depletedEcology = {
      ...world,
      tiles: world.tiles.map((tile) => Math.abs(tile.x - home.x) + Math.abs(tile.z - home.z) <= 3
        ? { ...tile, soil: 'cằn cỗi' as const, moisture: 0, forest: false, resources: 0 }
        : tile),
    }
    const restored = advanceSimulation(createSimulation(restoredEcology), restoredEcology, 8)
    const depleted = advanceSimulation(createSimulation(depletedEcology), depletedEcology, 8)

    expect(restored.villages[0]!.food).toBeGreaterThan(depleted.villages[0]!.food)
    expect(restored.villages[0]!.resilience).toBeGreaterThan(depleted.villages[0]!.resilience)
  })

  it('records god tools without changing ticks and resolves a visible council trade-off', () => {
    const world = generateWorld(config)
    const initial = createSimulation(world)
    const logged = recordGodToolUse(initial, 'forest')
    expect(logged.tick).toBe(initial.tick)
    expect(logged.godToolUses.forest).toBe(1)
    expect(logged.events[0]?.id).toMatch(/^event-0-god-tool-forest-/)

    const storm = triggerStorm(initial)
    expect(storm.pendingCouncil).toBeDefined()
    const resolved = resolveCouncilDecision(storm, 'stockpile')
    expect(resolved.pendingCouncil).toBeUndefined()
    expect(resolved.villages[0]!.resilience).toBeGreaterThan(storm.villages[0]!.resilience)
    expect(resolved.villages[0]!.food).toBeLessThan(storm.villages[0]!.food)
  })

  it('requires an ordered research and food investment before a village changes era', () => {
    const world = generateWorld(config)
    const initial = createSimulation(world)
    const blocked = developVillageTool(initial)
    expect(blocked.ok).toBe(false)

    const prepared = {
      ...initial,
      villages: initial.villages.map((village) => ({ ...village, research: 999, food: 999 })),
    }
    const firstCraft = developVillageTool(prepared)
    expect(firstCraft.ok).toBe(true)
    if (!firstCraft.ok) return
    expect(firstCraft.simulation.villages[0]!.tools).toEqual(['stone-handaxe', 'flint-axe'])
    expect(firstCraft.simulation.villages[0]!.era).toBe('Làng Gỗ')
    expect(firstCraft.simulation.events[0]?.title).toBe('Bước vào Làng gỗ')

    let progressed = firstCraft.simulation
    while (true) {
      const next = developVillageTool(progressed)
      if (!next.ok) break
      progressed = next.simulation
    }
    expect(progressed.villages[0]!.tools).toHaveLength(7)
    expect(progressed.villages[0]!.era).toBe('Thị Trấn')
  })

  it('only applies player-taught knowledge after a deterministic era and capability assessment', () => {
    const world = generateWorld(config)
    const initial = createSimulation(world)
    const accepted = submitVillageKnowledge(initial, 'Giữ lửa và hong khô')
    expect(accepted.ok).toBe(true)
    if (!accepted.ok) return

    expect(accepted.simulation.villages[0]!.knowledge).toEqual(['fire-stewardship'])
    expect(accepted.simulation.events[0]?.title).toBe('Tri thức: Giữ lửa và hong khô')
    const baseline = advanceSimulation(initial, world, 8)
    const taught = advanceSimulation(accepted.simulation, world, 8)
    expect(taught.villages[0]!.resilience).toBeGreaterThan(baseline.villages[0]!.resilience)

    const tooEarly = submitVillageKnowledge(initial, 'Dẫn nước ruộng')
    expect(tooEarly.ok).toBe(false)
    if (!tooEarly.ok) expect(tooEarly.assessment.status).toBe('too-advanced')
    expect(submitVillageKnowledge(initial, 'máy tính').ok).toBe(false)
  })
})
