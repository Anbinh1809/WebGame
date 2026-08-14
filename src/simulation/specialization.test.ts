import { describe, expect, it } from 'vitest'
import {
  calculateSpecializationBonuses,
  getBranchById,
  SPECIALIZATION_BRANCHES,
} from './specialization'

describe('specialization branches', () => {
  it('has four distinct branches with complete 3-tier perks', () => {
    expect(SPECIALIZATION_BRANCHES.length).toBe(4)
    for (const branch of SPECIALIZATION_BRANCHES) {
      expect(branch.perks.length).toBe(3)
      expect(branch.perks[0]?.tier).toBe(1)
      expect(branch.perks[1]?.tier).toBe(2)
      expect(branch.perks[2]?.tier).toBe(3)
      expect(branch.perks.every((p) => p.researchCost > 0)).toBe(true)
      expect(branch.perks.every((p) => Boolean(p.uniqueUnit))).toBe(true)
    }
  })

  it('can fetch branch by id and calculate bonuses correctly', () => {
    const arcane = getBranchById('arcane')
    expect(arcane.name).toContain('Huyền Thuật')

    const bonuses = calculateSpecializationBonuses(['beast-communion', 'heavy-foundry'])
    expect(bonuses.militaryBonus).toBe(15 + 20)
    expect(bonuses.unlockedUnits).toContain('Kỵ Sĩ Hươu Thần')
    expect(bonuses.unlockedUnits).toContain('Vệ Binh Thiết Giáp')
  })
})
