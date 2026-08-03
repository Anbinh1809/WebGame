import { describe, expect, it } from 'vitest'
import { advanceSimulation, createSimulation, isHabitableTile, MAX_ADVANCE_TICKS, spawnSettlersAt, toggleSimulationPause, triggerStorm } from './engine'
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
})
