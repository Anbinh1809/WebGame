export type SpecializationBranchId = 'arcane' | 'forge' | 'maritime' | 'imperial'

export interface SpecializationPerk {
  id: string
  label: string
  tier: 1 | 2 | 3
  description: string
  researchCost: number
  militaryBonus: number
  harvestBonus: number
  researchBonus: number
  stormDefenseBonus: number
  uniqueUnit: string
}

export interface SpecializationBranch {
  id: SpecializationBranchId
  name: string
  tagline: string
  icon: string
  accentColor: string
  description: string
  prerequisiteEra: string
  perks: readonly SpecializationPerk[]
}

export const SPECIALIZATION_BRANCHES: readonly SpecializationBranch[] = [
  {
    id: 'arcane',
    name: 'Huyền Thuật & Tự Nhiên',
    tagline: 'Sức mạnh cổ xưa của rừng già & linh thú',
    icon: '🔮',
    accentColor: '#a855f7',
    description: 'Tôn vinh sự hòa hợp với đất trời, triệu hồi linh thú và điều khiển các luồng mana tự nhiên bảo vệ lục địa.',
    prerequisiteEra: 'Nông Nghiệp',
    perks: [
      {
        id: 'beast-communion',
        label: 'Giao Tiếp Linh Thú',
        tier: 1,
        description: 'Thuần hóa muông thú quanh làng, tăng lương thực và lực lượng canh gác.',
        researchCost: 40,
        militaryBonus: 15,
        harvestBonus: 0.08,
        researchBonus: 0.04,
        stormDefenseBonus: 0.05,
        uniqueUnit: 'Kỵ Sĩ Hươu Thần',
      },
      {
        id: 'druid-sanctuary',
        label: 'Thánh Địa Rừng Thiêng',
        tier: 2,
        description: 'Dựng bảo hộ ma pháp giúp chống chọi thiên tai và hồi sinh thảm thực vật.',
        researchCost: 90,
        militaryBonus: 28,
        harvestBonus: 0.14,
        researchBonus: 0.09,
        stormDefenseBonus: 0.18,
        uniqueUnit: 'Trưởng Lão Druid',
      },
      {
        id: 'mana-surge',
        label: 'Bộc Phát Mana Sáng Thế',
        tier: 3,
        description: 'Triệu hồi sấm sét ma thuật và linh lực vô biên hỗ trợ chiến trận.',
        researchCost: 160,
        militaryBonus: 50,
        harvestBonus: 0.22,
        researchBonus: 0.18,
        stormDefenseBonus: 0.30,
        uniqueUnit: 'Đại Pháp Sư Tự Nhiên',
      },
    ],
  },
  {
    id: 'forge',
    name: 'Cơ Khí & Luyện Kim Hỏa Sơn',
    tagline: 'Đe búa rền vang, giáp sắt & hỏa tiễn',
    icon: '⚙️',
    accentColor: '#f97316',
    description: 'Chinh phục lòng đất, khai quặng luyện kim, chế tạo máy móc tự động và trang bị vũ khí sắt thép tối tân.',
    prerequisiteEra: 'Thời Kim Khí',
    perks: [
      {
        id: 'heavy-foundry',
        label: 'Lò Luyện Kim Cao Áp',
        tier: 1,
        description: 'Đúc vũ khí và giáp sắt bền chắc cho toàn bộ quân đoàn.',
        researchCost: 45,
        militaryBonus: 20,
        harvestBonus: 0.04,
        researchBonus: 0.08,
        stormDefenseBonus: 0.08,
        uniqueUnit: 'Vệ Binh Thiết Giáp',
      },
      {
        id: 'flame-turret',
        label: 'Tháp Súng Phun Hỏa',
        tier: 2,
        description: 'Lắp đặt vũ khí hỏa lực tầm xa phòng thủ vững chắc trước quái vật và kẻ thù.',
        researchCost: 95,
        militaryBonus: 36,
        harvestBonus: 0.06,
        researchBonus: 0.12,
        stormDefenseBonus: 0.12,
        uniqueUnit: 'Pháo Thủ Hỏa Khí',
      },
      {
        id: 'steam-golem',
        label: 'Người Đá Cơ Giới (Golem)',
        tier: 3,
        description: 'Chế tạo cỗ máy chiến tranh khổng lồ nghiền nát mọi chướng ngại vật.',
        researchCost: 175,
        militaryBonus: 58,
        harvestBonus: 0.12,
        researchBonus: 0.20,
        stormDefenseBonus: 0.22,
        uniqueUnit: 'Cỗ Máy Golem Bọc Thép',
      },
    ],
  },
  {
    id: 'maritime',
    name: 'Thủy Triều & Hàng Hải Viễn Dương',
    tagline: 'Làm chủ đại dương, thương thuyền & hải quái',
    icon: '⚓',
    accentColor: '#0ea5e9',
    description: 'Tận dụng sức mạnh biển khơi, mở rộng giao thương hàng hải và chế ngự các ngọn sóng cuồng nộ.',
    prerequisiteEra: 'Làng Gỗ',
    perks: [
      {
        id: 'coastal-fleet',
        label: 'Hạm Đội Ven Bờ',
        tier: 1,
        description: 'Mở rộng ngư trường đánh bắt và tuần tra phòng thủ hải phận.',
        researchCost: 35,
        militaryBonus: 14,
        harvestBonus: 0.12,
        researchBonus: 0.05,
        stormDefenseBonus: 0.06,
        uniqueUnit: 'Thủy Thủ Lao Móc',
      },
      {
        id: 'tidal-barrier',
        label: 'Đê Kè Chắn Sóng Biển',
        tier: 2,
        description: 'Bảo vệ cư dân ven biển an toàn trước triều cường và giông bão lớn.',
        researchCost: 85,
        militaryBonus: 26,
        harvestBonus: 0.18,
        researchBonus: 0.10,
        stormDefenseBonus: 0.24,
        uniqueUnit: 'Tu Sĩ Hải Triều',
      },
      {
        id: 'leviathan-pact',
        label: 'Khế Ước Thủy Quái',
        tier: 3,
        description: 'Hiệp ước cổ xưa triệu hồi Thần Thú Biển Sâu chi viện các trận hải chiến.',
        researchCost: 155,
        militaryBonus: 52,
        harvestBonus: 0.25,
        researchBonus: 0.16,
        stormDefenseBonus: 0.32,
        uniqueUnit: 'Thần Thú Leviathan Biển Sâu',
      },
    ],
  },
  {
    id: 'imperial',
    name: 'Đế Chế & Thành Trì Quân Phiệt',
    tagline: 'Kỷ luật thép, thành cao hào sâu & đại quân',
    icon: '👑',
    accentColor: '#eab308',
    description: 'Xây dựng đế chế hùng mạnh với kỷ luật quân ngũ nghiêm minh, thành trì đá kiên cố và quân số áp đảo.',
    prerequisiteEra: 'Thời Kim Khí',
    perks: [
      {
        id: 'legion-discipline',
        label: 'Kỷ Luật Quân Đoàn',
        tier: 1,
        description: 'Tổ chức đội ngũ quân sự bài bản, gia tăng sĩ khí và sức chiến đấu.',
        researchCost: 45,
        militaryBonus: 22,
        harvestBonus: 0.05,
        researchBonus: 0.06,
        stormDefenseBonus: 0.06,
        uniqueUnit: 'Lính Lê Dương Khiên Giáo',
      },
      {
        id: 'granite-citadel',
        label: 'Thành Trì Đá Hoa Cương',
        tier: 2,
        description: 'Tường thành kiên cố bất khả xâm phạm bảo vệ trung tâm lục địa.',
        researchCost: 100,
        militaryBonus: 38,
        harvestBonus: 0.08,
        researchBonus: 0.11,
        stormDefenseBonus: 0.20,
        uniqueUnit: 'Kỵ Binh Thiết Giáp',
      },
      {
        id: 'grand-imperium',
        label: 'Đại Tướng Lục Địa & Kỳ Đài',
        tier: 3,
        description: 'Thống nhất toàn cõi, xuất quân chinh phạt các lục địa đối thủ.',
        researchCost: 180,
        militaryBonus: 62,
        harvestBonus: 0.15,
        researchBonus: 0.22,
        stormDefenseBonus: 0.25,
        uniqueUnit: 'Đại Tướng Thống Soái',
      },
    ],
  },
]

export interface SpecializationState {
  chosenBranch?: SpecializationBranchId
  unlockedPerks: string[]
}

export function getBranchById(id: SpecializationBranchId): SpecializationBranch {
  const branch = SPECIALIZATION_BRANCHES.find((b) => b.id === id)
  if (!branch) throw new Error(`Unknown specialization branch: ${id}`)
  return branch
}

export function calculateSpecializationBonuses(unlockedPerkIds: readonly string[]): {
  militaryBonus: number
  harvestBonus: number
  researchBonus: number
  stormDefenseBonus: number
  unlockedUnits: string[]
} {
  let militaryBonus = 0
  let harvestBonus = 0
  let researchBonus = 0
  let stormDefenseBonus = 0
  const unlockedUnits: string[] = []

  for (const branch of SPECIALIZATION_BRANCHES) {
    for (const perk of branch.perks) {
      if (unlockedPerkIds.includes(perk.id)) {
        militaryBonus += perk.militaryBonus
        harvestBonus += perk.harvestBonus
        researchBonus += perk.researchBonus
        stormDefenseBonus += perk.stormDefenseBonus
        unlockedUnits.push(perk.uniqueUnit)
      }
    }
  }

  return { militaryBonus, harvestBonus, researchBonus, stormDefenseBonus, unlockedUnits }
}
