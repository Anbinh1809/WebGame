import type {
  ConvergenceEvent,
  EvolvedSpeciesRecord,
  EvolvedSpeciesStats,
  EvolutionArchetype,
  EvolutionMutationRecord,
  EvolutionNode,
  IslandEvolutionProfile,
  NodeRarity,
} from './types'
import { MATHEMATICAL_KEYSTONE_SPACE } from './types'

function stringHash(str: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function pseudoRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function determineDominantArchetype(
  seed: string,
  env?: { waterRatio?: number; forestRatio?: number; elevationAvg?: number; climate?: string },
): EvolutionArchetype {
  const water = env?.waterRatio ?? 0.5
  const forest = env?.forestRatio ?? 0.4
  const elevation = env?.elevationAvg ?? 0.5
  const climate = env?.climate ?? 'ôn hòa'

  if (water > 0.65) return 'aquatic'
  if (water > 0.45 && forest > 0.5) return 'amphibious'
  if (climate === 'lạnh' && elevation > 0.6) return 'aetherial'
  if (elevation > 0.7) return 'chthonic'
  if (forest > 0.6) return 'arboreal'
  if (elevation > 0.55 && water < 0.4) return 'aerial'
  if (climate === 'ấm' && water < 0.3) return 'crystalline'
  
  const hash = stringHash(seed)
  const archetypes: EvolutionArchetype[] = [
    'terrestrial',
    'arboreal',
    'aerial',
    'amphibious',
    'aquatic',
    'chthonic',
    'aetherial',
    'crystalline',
  ]
  return archetypes[hash % archetypes.length] ?? 'terrestrial'
}

export function generateCladeSignature(islandSeed: string, archetype: EvolutionArchetype) {
  const seedNum = stringHash(`${islandSeed}-clade-${archetype}`)
  const rng = pseudoRandom(seedNum)
  
  // Mathematical calibration: modulo 200 ensures exactly 1/200 = 0.005 (0.5%) duplicate collision rate
  const keystoneTaxonId = Math.floor(rng() * MATHEMATICAL_KEYSTONE_SPACE)
  const branchVector: [number, number, number, number] = [
    Math.round(rng() * 100) / 100,
    Math.round(rng() * 100) / 100,
    Math.round(rng() * 100) / 100,
    Math.round(rng() * 100) / 100,
  ]
  const divergenceScore = Math.round((0.5 + rng() * 0.5) * 1000) / 1000
  const hexPart = seedNum.toString(16).padStart(8, '0').toUpperCase()
  const lineageCode = `EVO-${archetype.substring(0, 3).toUpperCase()}-${keystoneTaxonId.toString().padStart(3, '0')}-${hexPart.substring(0, 4)}`

  return {
    cladeHash: `AETH-${hexPart}`,
    keystoneTaxonId,
    branchVector,
    divergenceScore,
    lineageCode,
  }
}

function generateEvolutionNodes(archetype: EvolutionArchetype, seedNum: number): Record<string, EvolutionNode> {
  const rng = pseudoRandom(seedNum ^ 0x9e3779b9)
  const nodes: Record<string, EvolutionNode> = {}

  const branchNames: Record<EvolutionArchetype, string[][]> = {
    aquatic: [
      ['Màng Tế Bào Thủy Tinh', 'cellular', 'Tối ưu trao đổi ion mặn và thẩm thấu nước biển.'],
      ['Vây Cá Lực Đẩy Thủy Động', 'morphology', 'Tăng 45% tốc độ lướt sóng và giảm ma sát nước.'],
      ['Phát Quang Sinh Học Biển Sâu', 'metabolism', 'Tự phát sáng thu hút con mồi và giao tiếp trong bóng tối.'],
      ['Hệ Thần Kinh Thấu Thị Sóng Âm', 'neural', 'Cảm nhận xung điện và sóng hạ âm của toàn bộ đại dương.'],
      ['Thần Thú Hải Vương Cổ Đại', 'apex', 'Hóa thân thành sinh vật tối cao thống trị mọi vùng biển.'],
    ],
    amphibious: [
      ['Tế Bào Hô Hấp Kép Da-Phổi', 'cellular', 'Hấp thu oxy trực tiếp qua lớp da ẩm và biểu bì.'],
      ['Tuyến Độc Alcaloid Sinh Học', 'morphology', 'Tiết chất độc gây tê liệt kẻ săn mồi khi va chạm.'],
      ['Tái Sinh Mô Phức Hợp', 'metabolism', 'Tự phục hồi chi và vết thương chỉ trong vài giây.'],
      ['Ý Thức Cộng Hưởng Đầm Lầy', 'neural', 'Kết nối giác quan với toàn bộ thảm thực vật đầm lầy.'],
      ['Thần Thú Đầm Lầy Bất Hoại', 'apex', 'Cực hạn thích nghi, miễn nhiễm mọi độc tố và biến đổi khí hậu.'],
    ],
    terrestrial: [
      ['Cấu Trúc Tế Bào Sợi Cơ Bắp Siêu Đặc', 'cellular', 'Gia tăng sức bền cơ học và chịu tải trọng cực lớn.'],
      ['Móng Vuốt Kim Loại Hóa', 'morphology', 'Tích tụ hợp chất canxi-sắt gia tăng sát thương cào xé.'],
      ['Trao Đổi Chất Nhanh Siêu Cấp', 'metabolism', 'Chuyển hóa 95% thức ăn thành năng lượng hoạt động.'],
      ['Tập Tính Bầy Đàn Chiến Thuật', 'neural', 'Tổ chức săn mồi có phân công và bọc lót theo bầy.'],
      ['Chúa Tể Đồng Bằng Vạn Thú', 'apex', 'Lãnh tụ vạn loài với uy áp áp đảo mọi đối thủ xung quanh.'],
    ],
    arboreal: [
      ['Diệp Lục Tích Hợp Mô Động Vật', 'cellular', 'Quang hợp trực tiếp dưới ánh sáng mặt trời để bù năng lượng.'],
      ['Khớp Mềm Co Giãn Đa Hướng', 'morphology', 'Nhảy chuyền cành cực nhanh với độ chuẩn xác tuyệt đối.'],
      ['Phấn Hoa Gây Ảo Giác', 'metabolism', 'Phát tán bào tử mê hoặc kẻ địch xâm phạm lãnh thổ.'],
      ['Mạng Lưới Thần Kinh Rừng Rậm', 'neural', 'Đồng bộ xung thần kinh với mạng lưới rễ cây đại ngàn.'],
      ['Mộc Tinh Thần Thụ Thần Thoại', 'apex', 'Kiểm soát thảm thực vật và hồi sinh toàn bộ hệ sinh thái.'],
    ],
    aerial: [
      ['Khung Xương Rỗng Titan Khinh Khí', 'cellular', 'Giảm 60% trọng lượng cơ thể nhưng cứng gấp 3 lần thép.'],
      ['Cánh Lông Vũ Phản Lực Khí Động', 'morphology', 'Tạo lực nâng phi thường và lượn siêu thanh.'],
      ['Thị Giác Viễn Kính Tinh Thần', 'metabolism', 'Nhìn rõ con mồi từ độ cao 5000m trong mọi thời tiết.'],
      ['Phản Xạ Không Gian 3 Chiều', 'neural', 'Né tránh mọi đòn tấn công trên không với tốc độ tia chớp.'],
      ['Bá Vương Bầu Trời Dực Thần', 'apex', 'Thống trị không phận với sấm sét và bão lốc cuồng nộ.'],
    ],
    chthonic: [
      ['Lớp Biểu Bì Tinh Thể Silicate', 'cellular', 'Chống chịu dung nham nóng chảy và áp suất nghìn bar.'],
      ['Giáp Gai Đá Núi Lửa', 'morphology', 'Phản đòn sát thương vật lý và nghiền nát vật cản.'],
      ['Hấp Thu Nhiệt Địa Tầng', 'metabolism', 'Chuyển hóa nhiệt năng magma thành năng lượng sống bất tận.'],
      ['Địa Chấn Cảm Ứng Vạn Dặm', 'neural', 'Phát hiện chuyển động xuyên lòng đất trong bán kính lớn.'],
      ['Titan Nham Thạch Cổ Đại', 'apex', 'Khởi phát động đất và biến đổi hoàn toàn cấu trúc địa hình.'],
    ],
    aetherial: [
      ['Màng Tế Bào Thấm Hút Hạt Aether', 'cellular', 'Hấp thu trực tiếp hạt năng lượng nguyên tố vũ trụ.'],
      ['Hào Quang Hộ Thể Linh Khí', 'morphology', 'Màn chắn năng lượng hấp thụ 50% sát thương.'],
      ['Ngưng Tụ Linh Hạch Aether', 'metabolism', 'Tạo nguồn năng lượng thần thoại vĩnh cửu.'],
      ['Ý Niệm Thấu Suốt Đa Chiều', 'neural', 'Dự đoán trước hành động của kẻ địch trong tương lai gần.'],
      ['Linh Thần Tinh Tú Thượng Cổ', 'apex', 'Hòa làm một với năng lượng thiên địa, bất tử theo thời gian.'],
    ],
    crystalline: [
      ['Tế Bào Lưới Tinh Thể Lục Giác', 'cellular', 'Khúc xạ mọi tia bức xạ và ánh sáng gây hại.'],
      ['Lưỡi Dao Pha Lê Sắc Lạnh', 'morphology', 'Móng vuốt pha lê cắt đứt mọi loại giáp kiên cố nhất.'],
      ['Cộng Hưởng Âm Ba Tinh Thể', 'metabolism', 'Phát sóng siêu âm phá hủy cấu trúc tế bào kẻ địch.'],
      ['Tâm Trí Pha Lê Đồng Bộ', 'neural', 'Chia sẻ dữ liệu ký ức tức thời giữa các cá thể trong loài.'],
    ],
  }

  const branch = branchNames[archetype]
  const rarities: NodeRarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic']

  branch.forEach((item, index) => {
    const tier = (index + 1) as 1 | 2 | 3 | 4 | 5
    const id = `node-${archetype}-t${tier}`
    const statDeltas: Partial<EvolvedSpeciesStats> = {
      health: Math.round(15 + tier * 25 + rng() * 10),
      attack: Math.round(5 + tier * 12 + rng() * 8),
      defense: Math.round(5 + tier * 10 + rng() * 6),
      speed: Math.round(5 + tier * 8 + rng() * 5),
      adaptation: Math.round(10 + tier * 16),
      intelligence: Math.round(8 + tier * 15),
      biomassEfficiency: Math.round(10 + tier * 14),
      photosynthesis: archetype === 'arboreal' ? 20 + tier * 15 : 5 + tier * 5,
      resilience: Math.round(12 + tier * 15),
      mutationAffinity: Math.round(10 + tier * 12),
    }

    const name = item[0] ?? `Node ${tier}`
    const category = (item[1] ?? 'morphology') as EvolutionNode['category']
    const description = item[2] ?? ''
    const rarity = rarities[index] ?? 'common'

    nodes[id] = {
      id,
      name,
      scientificName: `${archetype.toUpperCase()}_CLADE_G${tier}_${name.replace(/\s+/g, '_')}`,
      tier,
      category,
      description,
      icon: tier === 1 ? '🧬' : tier === 2 ? '🦴' : tier === 3 ? '⚡' : tier === 4 ? '🧠' : '👑',
      dnaCost: tier * 35,
      biomassCost: tier * 60,
      unlocked: tier === 1, // T1 unlocked by default
      statDeltas,
      unlockedTraits: [`Đột biến ${name}`, `Thức tỉnh bậc ${tier}`],
      prerequisites: tier > 1 ? [`node-${archetype}-t${tier - 1}`] : [],
      ...(tier > 1 ? { parentBranchId: `node-${archetype}-t${tier - 1}` } : {}),
      rarity,
      branchIndex: index,
    }
  })

  return nodes
}

export function generateDefaultSpeciesCatalog(
  archetype: EvolutionArchetype,
  seedNum: number,
): Record<string, EvolvedSpeciesRecord> {
  const rng = pseudoRandom(seedNum ^ 0xa4c1b3f7)
  const catalog: Record<string, EvolvedSpeciesRecord> = {}

  const baseTemplates = [
    { id: 'huou-linh-thu', original: 'hươu-rừng', name: 'Hươu Linh Thụ', domain: 'fauna' as const, color: '#10b981' },
    { id: 'soi-tuyet-san-moi', original: 'sói-hoang', name: 'Sói Tuyết Băng Sơn', domain: 'fauna' as const, color: '#38bdf8' },
    { id: 'cu-tuong-chien-than', original: 'cự-tượng', name: 'Cự Tượng Titan', domain: 'fauna' as const, color: '#94a3b8' },
    { id: 'duc-long-co-dai', original: 'dực-long', name: 'Dực Long Thái Cổ', domain: 'fauna' as const, color: '#f59e0b' },
    { id: 'moc-quai-dai-ngan', original: 'mộc-quái', name: 'Mộc Tinh Cổ Thụ', domain: 'flora' as const, color: '#22c55e' },
    { id: 'thach-thu-nham-thach', original: 'thạch-thú', name: 'Người Đá Magma', domain: 'mineraloid' as const, color: '#ef4444' },
  ]

  baseTemplates.forEach((tpl) => {
    const stats: EvolvedSpeciesStats = {
      health: Math.round(50 + rng() * 100),
      attack: Math.round(15 + rng() * 35),
      defense: Math.round(10 + rng() * 30),
      speed: Math.round(10 + rng() * 25),
      adaptation: Math.round(40 + rng() * 40),
      intelligence: Math.round(30 + rng() * 50),
      biomassEfficiency: Math.round(40 + rng() * 40),
      photosynthesis: tpl.domain === 'flora' ? 85 : 15,
      resilience: Math.round(45 + rng() * 45),
      mutationAffinity: Math.round(35 + rng() * 50),
      elementalAffinity: archetype === 'aquatic' ? 'water' : archetype === 'chthonic' ? 'fire' : archetype === 'aetherial' ? 'aether' : 'earth',
    }

    catalog[tpl.id] = {
      id: tpl.id,
      originalSpeciesId: tpl.original,
      name: `${tpl.name} [Nhánh ${archetype}]`,
      classification: `${archetype.toUpperCase()} / ${tpl.domain.toUpperCase()}`,
      domain: tpl.domain,
      archetype,
      tier: 1,
      stats,
      activeTraits: ['Khởi sinh nguyên thủy', `Thích ứng hệ sinh thái ${archetype}`],
      unlockedNodes: [`node-${archetype}-t1`],
      mutationGeneration: 1,
      colorHex: tpl.color,
    }
  })

  return catalog
}

export function createIslandEvolutionProfile(
  islandId: string,
  islandName: string,
  islandSeed: string,
  env?: { waterRatio?: number; forestRatio?: number; elevationAvg?: number; climate?: string },
): IslandEvolutionProfile {
  const dominantArchetype = determineDominantArchetype(islandSeed, env)
  const seedNum = stringHash(`${islandSeed}-${islandId}`)
  const cladeSignature = generateCladeSignature(islandSeed, dominantArchetype)
  const nodes = generateEvolutionNodes(dominantArchetype, seedNum)
  const speciesCatalog = generateDefaultSpeciesCatalog(dominantArchetype, seedNum)

  return {
    islandId,
    islandName,
    islandSeed,
    cladeSignature,
    dominantArchetype,
    dnaPoints: 120,
    biomassPoints: 200,
    generationCount: 1,
    nodes,
    unlockedNodeIds: [`node-${dominantArchetype}-t1`],
    speciesCatalog,
    mutationLog: [
      {
        id: `mut-init-${islandId}`,
        timestamp: Date.now(),
        nodeId: `node-${dominantArchetype}-t1`,
        nodeName: nodes[`node-${dominantArchetype}-t1`]?.name ?? 'Khởi Nguyên Tế Bào',
        speciesId: 'huou-linh-thu',
        tier: 1,
        statBoostSummary: 'Khai mở nhánh tiến hóa nguyên thủy',
        energyCost: { dna: 0, biomass: 0 },
      },
    ],
    convergenceEvents: [],
  }
}

export function unlockEvolutionNode(
  profile: IslandEvolutionProfile,
  nodeId: string,
): { success: boolean; error?: string; profile: IslandEvolutionProfile; mutationRecord?: EvolutionMutationRecord } {
  const node = profile.nodes[nodeId]
  if (!node) {
    return { success: false, error: `Không tìm thấy nút tiến hóa: ${nodeId}`, profile }
  }

  if (node.unlocked) {
    return { success: false, error: 'Nút tiến hóa này đã được mở khóa trước đó.', profile }
  }

  // Check prerequisites
  for (const prereqId of node.prerequisites) {
    if (!profile.unlockedNodeIds.includes(prereqId)) {
      const prereqNode = profile.nodes[prereqId]
      return {
        success: false,
        error: `Cần mở khóa tiến hóa tiên quyết: ${prereqNode ? prereqNode.name : prereqId}`,
        profile,
      }
    }
  }

  // Check costs
  if (profile.dnaPoints < node.dnaCost || profile.biomassPoints < node.biomassCost) {
    return {
      success: false,
      error: `Không đủ tài nguyên! Cần ${node.dnaCost} DNA và ${node.biomassCost} Sinh khối (Hiện có: ${profile.dnaPoints} DNA, ${profile.biomassPoints} Sinh khối).`,
      profile,
    }
  }

  // Apply unlock
  const nextNodes = {
    ...profile.nodes,
    [nodeId]: { ...node, unlocked: true },
  }
  const nextUnlockedNodeIds = [...profile.unlockedNodeIds, nodeId]

  // Apply stat boosts to species catalog
  const nextSpeciesCatalog = { ...profile.speciesCatalog }
  Object.keys(nextSpeciesCatalog).forEach((spKey) => {
    const sp = nextSpeciesCatalog[spKey]
    if (!sp) return
    const curStats = sp.stats
    const deltas = node.statDeltas

    const nextStats: EvolvedSpeciesStats = {
      health: curStats.health + (deltas.health ?? 0),
      attack: curStats.attack + (deltas.attack ?? 0),
      defense: curStats.defense + (deltas.defense ?? 0),
      speed: curStats.speed + (deltas.speed ?? 0),
      adaptation: Math.min(100, curStats.adaptation + (deltas.adaptation ?? 0)),
      intelligence: Math.min(100, curStats.intelligence + (deltas.intelligence ?? 0)),
      biomassEfficiency: Math.min(100, curStats.biomassEfficiency + (deltas.biomassEfficiency ?? 0)),
      photosynthesis: Math.min(100, curStats.photosynthesis + (deltas.photosynthesis ?? 0)),
      resilience: Math.min(100, curStats.resilience + (deltas.resilience ?? 0)),
      mutationAffinity: Math.min(100, curStats.mutationAffinity + (deltas.mutationAffinity ?? 0)),
      elementalAffinity: curStats.elementalAffinity,
    }

    nextSpeciesCatalog[spKey] = {
      id: sp.id,
      originalSpeciesId: sp.originalSpeciesId,
      name: sp.name,
      classification: sp.classification,
      domain: sp.domain,
      archetype: sp.archetype,
      ...(sp.modelVariantId !== undefined ? { modelVariantId: sp.modelVariantId } : {}),
      colorHex: sp.colorHex,
      tier: Math.max(sp.tier, node.tier),
      stats: nextStats,
      activeTraits: Array.from(new Set([...sp.activeTraits, ...node.unlockedTraits])),
      unlockedNodes: [...sp.unlockedNodes, nodeId],
      mutationGeneration: sp.mutationGeneration + 1,
    }
  })

  const mutationRecord: EvolutionMutationRecord = {
    id: `mut-${Date.now()}-${nodeId}`,
    timestamp: Date.now(),
    nodeId,
    nodeName: node.name,
    speciesId: 'all-species',
    tier: node.tier,
    statBoostSummary: `HP +${node.statDeltas.health ?? 0}, ATK +${node.statDeltas.attack ?? 0}, DEF +${node.statDeltas.defense ?? 0}, ADAPT +${node.statDeltas.adaptation ?? 0}%`,
    energyCost: { dna: node.dnaCost, biomass: node.biomassCost },
  }

  const updatedProfile: IslandEvolutionProfile = {
    ...profile,
    dnaPoints: profile.dnaPoints - node.dnaCost,
    biomassPoints: profile.biomassPoints - node.biomassCost,
    generationCount: profile.generationCount + 1,
    nodes: nextNodes,
    unlockedNodeIds: nextUnlockedNodeIds,
    speciesCatalog: nextSpeciesCatalog,
    mutationLog: [mutationRecord, ...profile.mutationLog].slice(0, 50),
  }

  return { success: true, profile: updatedProfile, mutationRecord }
}

export function gainEvolutionPoints(
  profile: IslandEvolutionProfile,
  dnaDelta: number,
  biomassDelta: number,
): IslandEvolutionProfile {
  return {
    ...profile,
    dnaPoints: Math.max(0, profile.dnaPoints + dnaDelta),
    biomassPoints: Math.max(0, profile.biomassPoints + biomassDelta),
  }
}

/**
 * Mathematical 0.5% Duplicate Probability / Keystone Clade Convergence Detector
 * Two independent random islands have exactly 1 in 200 (0.5%) chance to share the identical keystoneTaxonId.
 * When this occurs, a rare Convergence Event is triggered with cosmic synergies.
 */
export function detectEvolutionConvergence(
  islandA: IslandEvolutionProfile,
  islandB: IslandEvolutionProfile,
): ConvergenceEvent | null {
  if (islandA.islandId === islandB.islandId) return null

  if (islandA.cladeSignature.keystoneTaxonId === islandB.cladeSignature.keystoneTaxonId) {
    const isSameArchetype = islandA.dominantArchetype === islandB.dominantArchetype
    const resonanceTier = isSameArchetype ? 'cosmic' : 'aetheric'
    const bonusMultiplier = isSameArchetype ? 2.5 : 1.8

    return {
      islandAId: islandA.islandId,
      islandBId: islandB.islandId,
      keystoneTaxonId: islandA.cladeSignature.keystoneTaxonId,
      convergenceRate: 1 / MATHEMATICAL_KEYSTONE_SPACE, // exactly 0.005 (0.5%)
      resonanceTier,
      resonanceName: `Hiện Tượng Đồng Quy Tiến Hóa [Mã Keystone #${islandA.cladeSignature.keystoneTaxonId}]`,
      bonusMultiplier,
      timestamp: Date.now(),
    }
  }

  return null
}

export function calculatePairwiseDuplicateRate(profiles: IslandEvolutionProfile[]): {
  totalPairs: number
  collisionPairs: number
  collisionRate: number
  expectedRate: number
} {
  if (profiles.length < 2) {
    return { totalPairs: 0, collisionPairs: 0, collisionRate: 0, expectedRate: 0.005 }
  }

  let totalPairs = 0
  let collisionPairs = 0

  for (let i = 0; i < profiles.length; i++) {
    const pA = profiles[i]
    if (!pA) continue
    for (let j = i + 1; j < profiles.length; j++) {
      const pB = profiles[j]
      if (!pB) continue
      totalPairs++
      if (pA.cladeSignature.keystoneTaxonId === pB.cladeSignature.keystoneTaxonId) {
        collisionPairs++
      }
    }
  }

  return {
    totalPairs,
    collisionPairs,
    collisionRate: totalPairs > 0 ? collisionPairs / totalPairs : 0,
    expectedRate: 1 / MATHEMATICAL_KEYSTONE_SPACE, // 0.005 (0.5%)
  }
}
