import { describe, expect, it } from 'vitest'
import { createProceduralChronicle, createChronicleDigest } from './chronicle'
import { createGameState } from './session'
import { recordGodToolUse } from '../simulation/engine'
import type { WorldConfig } from '../world/types'

const config: WorldConfig = {
  seed: 'chronicle-seed',
  size: 28,
  climate: 'ôn hòa',
  water: 0.54,
  resources: 0.62,
}

describe('procedural chronicle', () => {
  it('is deterministic for the same seed, tick, and digest without mutating game state', () => {
    const game = createGameState(config)
    const simulation = recordGodToolUse(game.session.simulation, 'forest')
    const before = JSON.stringify(simulation)
    const firstDigest = createChronicleDigest(game.session.world, simulation)
    const secondDigest = createChronicleDigest(game.session.world, simulation)

    expect(secondDigest).toEqual(firstDigest)
    expect(createProceduralChronicle(firstDigest)).toEqual(createProceduralChronicle(secondDigest))
    expect(JSON.stringify(simulation)).toBe(before)
  })

  it('uses the digest to make a bounded, readable world chronicle', () => {
    const game = createGameState(config)
    const digest = createChronicleDigest(game.session.world, game.session.simulation)
    const chronicle = createProceduralChronicle({ ...digest, disaster: 'storm', tick: 12 })

    expect(chronicle.tone).toBe('ominous')
    expect(chronicle.causalInsights).toHaveLength(2)
    expect(chronicle.chronicle).toContain('cư dân')
    expect(chronicle.chronicle.length).toBeLessThan(900)
  })
})
