import { describe, expect, it } from 'vitest'
import { generateWorld } from '../world/generator'
import { createSimulation } from '../simulation/engine'
import {
  calculateContinentalPower,
  generateChallengers,
  getRankTier,
  simulateBattle,
} from './continentalRanked'

describe('continental ranked arena', () => {
  const world = generateWorld({
    seed: 'ranked-test-seed',
    size: 48,
    climate: 'ôn hòa',
    water: 0.52,
    resources: 0.7,
  })
  const sim = createSimulation(world)

  it('calculates continental power consistently based on world & perks', () => {
    const baseline = calculateContinentalPower(world, sim, [])
    expect(baseline.power).toBeGreaterThan(25)
    expect(baseline.units.length).toBeGreaterThan(0)

    const withPerk = calculateContinentalPower(world, sim, ['beast-communion'])
    expect(withPerk.power).toBeGreaterThan(baseline.power)
    expect(withPerk.units).toContain('Kỵ Sĩ Hươu Thần')
  })

  it('returns appropriate rank tiers for various elo ratings', () => {
    expect(getRankTier(500).tier).toBe('Đồng')
    expect(getRankTier(1200).tier).toBe('Bạc')
    expect(getRankTier(1500).tier).toBe('Vàng')
    expect(getRankTier(1900).tier).toBe('Bạch Kim')
    expect(getRankTier(2300).tier).toBe('Kim Cương')
    expect(getRankTier(3200).tier).toBe('Chúa Tể Sáng Thế')
  })

  it('generates deterministic challengers with balanced parameters', () => {
    const challengers = generateChallengers(150, 1200, 'ranked-test-seed')
    expect(challengers.length).toBe(5)
    expect(challengers[0]?.power).toBeGreaterThan(0)
    expect(challengers.every((c) => Boolean(c.lordName))).toBe(true)
    expect(challengers.every((c) => Boolean(c.continentName))).toBe(true)
  })

  it('simulates battle and produces report with elo and rounds', () => {
    const challengers = generateChallengers(200, 1200, 'ranked-test-seed')
    const challenger = challengers[0]
    expect(challenger).toBeDefined()
    if (!challenger) return

    const playerFleet = {
      id: 'player',
      lordName: 'Đấng Sáng Thế',
      continentName: 'Aetheria',
      power: 220,
      branch: 'arcane' as const,
      units: ['Kỵ Sĩ Hươu Thần', 'Chiến Binh Đồ Đồng'],
      elo: 1200,
      population: 180,
      resilience: 50,
      seed: 'player-seed',
    }

    const report = simulateBattle(playerFleet, challenger)
    expect(report.rounds.length).toBe(3)
    expect(['attacker', 'defender']).toContain(report.winner)
    expect(typeof report.eloChange).toBe('number')
    expect(report.rewardFood).toBeGreaterThanOrEqual(0)
  })
})
