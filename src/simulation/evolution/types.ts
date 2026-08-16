export type EvolutionArchetype =
  | 'aquatic'
  | 'amphibious'
  | 'terrestrial'
  | 'arboreal'
  | 'aerial'
  | 'chthonic'
  | 'aetherial'
  | 'crystalline'

export type CladeDomain = 'fauna' | 'flora' | 'fungi' | 'mineraloid' | 'cyber-symbiote'

export type ElementalAffinity = 'none' | 'fire' | 'water' | 'earth' | 'storm' | 'aether' | 'abyss' | 'crystal'

export interface EvolvedSpeciesStats {
  health: number
  attack: number
  defense: number
  speed: number
  adaptation: number
  intelligence: number
  biomassEfficiency: number
  photosynthesis: number
  resilience: number
  mutationAffinity: number
  elementalAffinity: ElementalAffinity
}

export type EvolutionNodeCategory = 'cellular' | 'morphology' | 'metabolism' | 'neural' | 'apex'

export type NodeRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic'

export interface EvolutionNode {
  id: string
  name: string
  scientificName: string
  tier: 1 | 2 | 3 | 4 | 5
  category: EvolutionNodeCategory
  description: string
  icon: string
  dnaCost: number
  biomassCost: number
  unlocked: boolean
  statDeltas: Partial<EvolvedSpeciesStats>
  unlockedTraits: string[]
  prerequisites: string[]
  parentBranchId?: string
  rarity: NodeRarity
  branchIndex: number
}

export interface CladeSignature {
  cladeHash: string
  keystoneTaxonId: number // 0 to 199 -> exactly 1/200 = 0.5% collision
  branchVector: [number, number, number, number]
  divergenceScore: number
  lineageCode: string
}

export interface ConvergenceEvent {
  islandAId: string
  islandBId: string
  keystoneTaxonId: number
  convergenceRate: number // 0.005 (0.5%)
  resonanceTier: 'cosmic' | 'aetheric' | 'primordial'
  resonanceName: string
  bonusMultiplier: number
  timestamp: number
}

export interface EvolvedSpeciesRecord {
  id: string
  originalSpeciesId: string
  name: string
  classification: string
  domain: CladeDomain
  archetype: EvolutionArchetype
  tier: number
  stats: EvolvedSpeciesStats
  activeTraits: string[]
  unlockedNodes: string[]
  mutationGeneration: number
  modelVariantId?: string
  colorHex: string
}

export interface EvolutionMutationRecord {
  id: string
  timestamp: number
  nodeId: string
  nodeName: string
  speciesId: string
  tier: number
  statBoostSummary: string
  energyCost: { dna: number; biomass: number }
}

export interface IslandEvolutionProfile {
  islandId: string
  islandName: string
  islandSeed: string
  cladeSignature: CladeSignature
  dominantArchetype: EvolutionArchetype
  dnaPoints: number
  biomassPoints: number
  generationCount: number
  nodes: Record<string, EvolutionNode>
  unlockedNodeIds: string[]
  speciesCatalog: Record<string, EvolvedSpeciesRecord>
  mutationLog: EvolutionMutationRecord[]
  convergenceEvents: ConvergenceEvent[]
}

export const MATHEMATICAL_KEYSTONE_SPACE = 200 // 1/200 = 0.005 = 0.5% duplicate rate

export const ARCHETYPE_DESCRIPTIONS: Record<EvolutionArchetype, { name: string; icon: string; desc: string }> = {
  aquatic: { name: 'Thủy Sinh Đại Dương', icon: '🌊', desc: 'Thích ứng bơi lặn sâu, mang lọc và điện giật biển sâu.' },
  amphibious: { name: 'Lưỡng Cư Bãi Lầy', icon: '🐸', desc: 'Thích nghi cả đất và nước, da tiết độc và tái sinh cực mạnh.' },
  terrestrial: { name: 'Bộ Hành Đồng Bằng', icon: '🐾', desc: 'Cơ bắp phát triển, tốc độ cao, khả năng săn mồi và bầy đàn.' },
  arboreal: { name: 'Lâm Mộc Tán Rừng', icon: '🌿', desc: 'Leo trèo, quang hợp sinh học, ngụy trang và phản xạ nhanh.' },
  aerial: { name: 'Dực Điểu Tầng Không', icon: '🦅', desc: 'Cánh bay lượn, tầm nhìn viễn kính, tấn công chớp nhoáng từ trên cao.' },
  chthonic: { name: 'Địa Cương Hang Động', icon: '🌋', desc: 'Giáp khoáng thạch, xúc giác siêu nhạy, miễn nhiễm nhiệt độ khắc nghiệt.' },
  aetherial: { name: 'Linh Khí Thần Thoại', icon: '✨', desc: 'Tích tụ tinh thể Aether, năng lượng siêu nhiên và sóng xung kích.' },
  crystalline: { name: 'Tinh Thể Dung Hợp', icon: '💎', desc: 'Cấu trúc silicate cứng cáp, khúc xạ ánh sáng và phóng chùm tinh thể.' },
}
