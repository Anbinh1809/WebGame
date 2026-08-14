import type { SpecializationBranchId } from '../simulation/specialization'
import { calculateSpecializationBonuses } from '../simulation/specialization'
import type { SimulationState } from '../simulation/types'
import type { World } from '../world/types'
import { hash2d, seedToUint32 } from '../world/prng'

export type RankTier = 'Đồng' | 'Bạc' | 'Vàng' | 'Bạch Kim' | 'Kim Cương' | 'Chúa Tể Sáng Thế'

export interface RankTierInfo {
  tier: RankTier
  minElo: number
  badge: string
  color: string
  rewardTitle: string
}

export const RANK_TIERS: readonly RankTierInfo[] = [
  { tier: 'Đồng', minElo: 0, badge: '🥉', color: '#cd7f32', rewardTitle: 'Sứ Giả Sơ Khai' },
  { tier: 'Bạc', minElo: 1000, badge: '🥈', color: '#94a3b8', rewardTitle: 'Hộ Vệ Lục Địa' },
  { tier: 'Vàng', minElo: 1400, badge: '🥇', color: '#eab308', rewardTitle: 'Chúa Đảo Danh Dự' },
  { tier: 'Bạch Kim', minElo: 1800, badge: '💎', color: '#38bdf8', rewardTitle: 'Đại Tướng Lục Địa' },
  { tier: 'Kim Cương', minElo: 2200, badge: '👑', color: '#a855f7', rewardTitle: 'Vua Thần Thoại' },
  { tier: 'Chúa Tể Sáng Thế', minElo: 2600, badge: '🌌', color: '#f43f5e', rewardTitle: 'Chúa Tể Sáng Thế Vô Song' },
]

export function getRankTier(elo: number): RankTierInfo {
  for (let i = RANK_TIERS.length - 1; i >= 0; i -= 1) {
    const tier = RANK_TIERS[i]
    if (tier && elo >= tier.minElo) return tier
  }
  return RANK_TIERS[0] ?? { tier: 'Đồng', minElo: 0, badge: '🥉', color: '#cd7f32', rewardTitle: 'Sứ Giả Sơ Khai' }
}

export interface ContinentalFleet {
  id: string
  lordName: string
  continentName: string
  power: number
  branch: SpecializationBranchId
  units: string[]
  elo: number
  population: number
  resilience: number
  seed: string
}

export interface BattleRound {
  round: number
  title: string
  description: string
  attackerDamage: number
  defenderDamage: number
}

export interface BattleReport {
  id: string
  timestamp: string
  attacker: ContinentalFleet
  defender: ContinentalFleet
  winner: 'attacker' | 'defender'
  eloChange: number
  rewardFood: number
  rewardResearch: number
  rounds: BattleRound[]
  summary: string
}

export function calculateContinentalPower(
  _world: World,
  simulation: SimulationState,
  unlockedPerks: readonly string[] = [],
): {
  power: number
  population: number
  militaryTotal: number
  resilienceAvg: number
  units: string[]
} {
  const population = simulation.villages.reduce((sum, v) => sum + v.population, 0)
  const militaryTotal = simulation.villages.reduce((sum, v) => sum + v.military, 0)
  const resilienceAvg = simulation.villages.length > 0
    ? simulation.villages.reduce((sum, v) => sum + v.resilience, 0) / simulation.villages.length
    : 10

  const specBonuses = calculateSpecializationBonuses(unlockedPerks)

  const toolWeight = simulation.villages.reduce((sum, v) => sum + v.tools.length * 15, 0)
  const knowledgeWeight = simulation.villages.reduce((sum, v) => sum + v.knowledge.length * 10, 0)
  const territoryWeight = simulation.villages.reduce((sum, v) => sum + v.territory * 5, 0)

  const rawPower = Math.round(
    population * 0.4 +
    militaryTotal * 2.5 +
    resilienceAvg * 5 +
    toolWeight +
    knowledgeWeight +
    territoryWeight +
    specBonuses.militaryBonus * 4,
  )

  const baseUnits: string[] = ['Dân Binh Cầm Giáo', 'Thợ Săn Rừng']
  if (toolWeight > 40) baseUnits.push('Chiến Binh Đồ Đồng')
  if (toolWeight > 70) baseUnits.push('Kỵ Sĩ Thiết Giáp')
  const units = Array.from(new Set([...baseUnits, ...specBonuses.unlockedUnits]))

  return {
    power: Math.max(25, rawPower),
    population,
    militaryTotal,
    resilienceAvg,
    units,
  }
}

const AI_LORDS = [
  { name: 'Thần Tộc Aethelgard', continent: 'Lục Địa Bắc Cực', branch: 'forge' as const },
  { name: 'Nữ Vương Sylphira', continent: 'Thánh Lãnh Rừng Xanh', branch: 'arcane' as const },
  { name: 'Đại Hạm Đội Thalassia', continent: 'Quần Đảo Hải Thần', branch: 'maritime' as const },
  { name: 'Đế Vương Valerius', continent: 'Đế Chế Hoa Cương', branch: 'imperial' as const },
  { name: 'Thợ Rèn Ignis', continent: 'Vùng Đất Hỏa Nham', branch: 'forge' as const },
  { name: 'Tộc Trưởng Cổ Mộc', continent: 'Đại Ngàn Vô Tận', branch: 'arcane' as const },
  { name: 'Hải Soái Drake', continent: 'Vịnh Cướp Biển Kraken', branch: 'maritime' as const },
  { name: 'Thống Chế Aurelius', continent: 'Đại Thảo Nguyên Hoàng Gia', branch: 'imperial' as const },
]

export function generateChallengers(playerPower: number, playerElo: number, playerSeed: string): ContinentalFleet[] {
  const seedNum = seedToUint32(playerSeed)
  const challengers: ContinentalFleet[] = []

  const powerMultipliers = [0.8, 0.95, 1.1, 1.25, 1.45]

  for (let i = 0; i < 5; i += 1) {
    const lordTemplate = AI_LORDS[(seedNum + i) % AI_LORDS.length] ?? AI_LORDS[0]!
    const multiplier = powerMultipliers[i] ?? 1
    const power = Math.max(30, Math.round(playerPower * multiplier + (hash2d(seedNum + i, i, 1) - 0.5) * 40))
    const eloOffset = Math.round((multiplier - 1) * 300 + (hash2d(seedNum, i * 7, 2) - 0.5) * 80)
    const elo = Math.max(100, playerElo + eloOffset)

    const units = [
      'Tiên Phong Trọng Giáp',
      'Đại Cung Thủ',
      lordTemplate.branch === 'arcane' ? 'Pháp Sư Tự Nhiên' :
      lordTemplate.branch === 'forge' ? 'Golem Cơ Khí' :
      lordTemplate.branch === 'maritime' ? 'Chiến Thuyền Hộ Vệ' : 'Vệ Binh Hoàng Gia',
    ]

    challengers.push({
      id: `challenger-${i}-${seedNum}`,
      lordName: lordTemplate.name,
      continentName: lordTemplate.continent,
      power,
      branch: lordTemplate.branch,
      units,
      elo,
      population: Math.round(power * 0.8),
      resilience: Math.min(95, Math.round(20 + power * 0.08)),
      seed: `challenger-seed-${i}-${seedNum}`,
    })
  }

  return challengers
}

export function simulateBattle(attacker: ContinentalFleet, defender: ContinentalFleet): BattleReport {
  const powerDiff = attacker.power - defender.power
  const winChance = 0.5 + (powerDiff / (attacker.power + defender.power + 1)) * 0.75
  const roll = Math.random()
  const isAttackerWinner = roll < Math.min(0.95, Math.max(0.05, winChance))

  const baseElo = 28
  const eloChange = isAttackerWinner
    ? Math.round(baseElo * (1 + Math.max(0, (defender.elo - attacker.elo) / 400)))
    : -Math.round(baseElo * (1 + Math.max(0, (attacker.elo - defender.elo) / 400)))

  const rounds: BattleRound[] = [
    {
      round: 1,
      title: 'Đổ Bộ Bờ Biển & Giáp Lá Cà',
      description: `Đội quân ${attacker.lordName} dùng ${attacker.units[0] || 'Bộ binh'} đổ bộ vào phòng tuyến ${defender.continentName}.`,
      attackerDamage: Math.round(attacker.power * 0.35 + Math.random() * 10),
      defenderDamage: Math.round(defender.power * 0.32 + Math.random() * 10),
    },
    {
      round: 2,
      title: 'Xung Đột Chiến Thuật & Kỹ Năng Nhánh',
      description: `${attacker.lordName} tung ${attacker.units[attacker.units.length - 1] || 'Chủ lực'} đối đầu với lực lượng phòng thủ ${defender.units[defender.units.length - 1] || 'Kẻ thủ thành'}.`,
      attackerDamage: Math.round(attacker.power * 0.4 + Math.random() * 15),
      defenderDamage: Math.round(defender.power * 0.38 + Math.random() * 15),
    },
    {
      round: 3,
      title: 'Tổng Lực Công Thành & Quyết Định Trận Đấu',
      description: isAttackerWinner
        ? `Đội ngũ ${attacker.lordName} phá vỡ thành trì của ${defender.continentName}, chiếm lĩnh trung tâm lục địa!`
        : `Lực lượng phòng thủ kiên cường của ${defender.lordName} đẩy lùi cuộc đổ bộ của ${attacker.lordName}!`,
      attackerDamage: Math.round(attacker.power * 0.3),
      defenderDamage: Math.round(defender.power * 0.3),
    },
  ]

  const rewardFood = isAttackerWinner ? Math.round(attacker.power * 0.6) : 5
  const rewardResearch = isAttackerWinner ? Math.round(attacker.power * 0.4) : 2

  const summary = isAttackerWinner
    ? `Chiến thắng vang dội trước ${defender.lordName}! Lực lượng viễn chinh mang về vinh quang (+${eloChange} Elo) cùng lương thực và khoáng thạch phong phú.`
    : `Cuộc viễn chinh trước ${defender.lordName} gặp nhiều kháng cự và phải rút lui an toàn (${eloChange} Elo). Hãy củng cố quân lực để tái đấu! `

  return {
    id: `battle-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    attacker,
    defender,
    winner: isAttackerWinner ? 'attacker' : 'defender',
    eloChange,
    rewardFood,
    rewardResearch,
    rounds,
    summary,
  }
}

const RANKED_STORAGE_KEY = 'aetheria-continental-ranked-v1'

export interface StoredRankedProfile {
  elo: number
  wins: number
  losses: number
  history: BattleReport[]
}

export function loadRankedProfile(): StoredRankedProfile {
  try {
    const raw = window.localStorage.getItem(RANKED_STORAGE_KEY)
    if (!raw) return { elo: 1000, wins: 0, losses: 0, history: [] }
    const parsed = JSON.parse(raw) as StoredRankedProfile
    return {
      elo: Number.isFinite(parsed.elo) ? parsed.elo : 1000,
      wins: Number.isFinite(parsed.wins) ? parsed.wins : 0,
      losses: Number.isFinite(parsed.losses) ? parsed.losses : 0,
      history: Array.isArray(parsed.history) ? parsed.history.slice(0, 15) : [],
    }
  } catch {
    return { elo: 1000, wins: 0, losses: 0, history: [] }
  }
}

export function saveRankedProfile(profile: StoredRankedProfile): void {
  try {
    window.localStorage.setItem(RANKED_STORAGE_KEY, JSON.stringify(profile))
  } catch {
    // Non-critical persistence
  }
}
