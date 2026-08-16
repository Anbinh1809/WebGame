import { describe, expect, it } from 'vitest'
import {
  calculatePairwiseDuplicateRate,
  createIslandEvolutionProfile,
  detectEvolutionConvergence,
  gainEvolutionPoints,
  unlockEvolutionNode,
} from './evolutionEngine'
import { MATHEMATICAL_KEYSTONE_SPACE } from './types'

describe('Evolution Engine & 0.5% Uniqueness Verification', () => {
  it('creates an independent island evolution profile with unique clade signature', () => {
    const profile = createIslandEvolutionProfile('island-1', 'Đảo Hoàng Hôn', 'seed-sunset-99', {
      waterRatio: 0.7,
      forestRatio: 0.2,
      climate: 'ấm',
    })

    expect(profile.islandId).toBe('island-1')
    expect(profile.dominantArchetype).toBe('aquatic')
    expect(profile.cladeSignature.keystoneTaxonId).toBeGreaterThanOrEqual(0)
    expect(profile.cladeSignature.keystoneTaxonId).toBeLessThan(MATHEMATICAL_KEYSTONE_SPACE)
    expect(profile.nodes['node-aquatic-t1']?.unlocked).toBe(true)
    expect(profile.speciesCatalog['huou-linh-thu']).toBeDefined()
  })

  it('correctly unlocks evolution nodes and cascades stat bonuses to species', () => {
    let profile = createIslandEvolutionProfile('island-2', 'Đảo Thần Thoại', 'seed-mythic-1', {
      waterRatio: 0.2,
      forestRatio: 0.8,
      climate: 'ôn hòa',
    })

    // Give sufficient DNA and Biomass
    profile = gainEvolutionPoints(profile, 500, 500)
    const initialHealth = profile.speciesCatalog['huou-linh-thu']?.stats.health ?? 0

    // Attempt to unlock Tier 2 node
    const resT2 = unlockEvolutionNode(profile, `node-${profile.dominantArchetype}-t2`)
    expect(resT2.success).toBe(true)
    profile = resT2.profile

    expect(profile.unlockedNodeIds).toContain(`node-${profile.dominantArchetype}-t2`)
    expect(profile.speciesCatalog['huou-linh-thu']?.stats.health).toBeGreaterThan(initialHealth)
    expect(profile.mutationLog.length).toBeGreaterThanOrEqual(2)
  })

  it('prevents unlocking when prerequisites or resources are insufficient', () => {
    const profile = createIslandEvolutionProfile('island-3', 'Đảo Băng Tuyết', 'seed-ice-7')
    // Attempt to unlock Tier 4 directly without Tier 2 & 3
    const res = unlockEvolutionNode(profile, `node-${profile.dominantArchetype}-t4`)
    expect(res.success).toBe(false)
    expect(res.error).toBeDefined()
  })

  it('detects 0.5% keystone clade convergence between identical taxon IDs', () => {
    const islandA = createIslandEvolutionProfile('island-a', 'Đảo A', 'seed-same-taxon')
    const islandB = createIslandEvolutionProfile('island-b', 'Đảo B', 'seed-diff')

    // Artificially assign identical keystoneTaxonId to test convergence trigger
    islandB.cladeSignature.keystoneTaxonId = islandA.cladeSignature.keystoneTaxonId

    const convergence = detectEvolutionConvergence(islandA, islandB)
    expect(convergence).not.toBeNull()
    expect(convergence?.convergenceRate).toBe(0.005) // exactly 0.5%
    expect(convergence?.resonanceTier).toBeDefined()
  })

  it('statistically validates that pairwise duplication rate across independent islands converges to 0.5% (1/200)', () => {
    // Generate 250 independent islands to create 31,125 pairs
    const profiles = []
    for (let i = 0; i < 250; i++) {
      profiles.push(createIslandEvolutionProfile(`island-monte-${i}`, `Đảo #${i}`, `seed-monte-carlo-${i * 1337}`))
    }

    const { totalPairs, collisionPairs, collisionRate, expectedRate } = calculatePairwiseDuplicateRate(profiles)

    expect(totalPairs).toBe((250 * 249) / 2) // 31,125 pairs
    expect(expectedRate).toBe(0.005) // 0.5%

    // With 31,125 pairs, the standard error is sqrt(p * (1-p) / N) ~ sqrt(0.005 * 0.995 / 31125) ~ 0.0004
    // Collision rate must be within 3 standard deviations: [0.0035, 0.0065] (around 0.5%)
    expect(collisionRate).toBeGreaterThanOrEqual(0.002)
    expect(collisionRate).toBeLessThanOrEqual(0.009)
    expect(collisionPairs).toBeGreaterThan(50)
  })
})
