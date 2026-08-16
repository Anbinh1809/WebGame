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
  dnaBonus?: number
  biomassBonus?: number
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
    name: 'Huyền Thuật & Sinh Hóa Tự Nhiên',
    tagline: 'Quang hợp, màng tế bào & tái sinh mô sinh học',
    icon: '🧬',
    accentColor: '#a855f7',
    description: 'Khai mở tiềm năng trao đổi chất, hấp thu năng lượng hóa thạch và ánh sáng, phát triển màng bao bọc và khả năng tự tái sinh mô thần kỳ.',
    prerequisiteEra: 'Nông Nghiệp',
    perks: [
      {
        id: 'beast-communion',
        label: 'Màng Bán Thấm & Ty Thể ATP',
        tier: 1,
        description: 'Tối ưu hóa phản ứng sinh hóa, gia tăng sinh khối tự nhiên và đẩy nhanh tích lũy năng lượng sống.',
        researchCost: 40,
        militaryBonus: 15,
        harvestBonus: 0.08,
        researchBonus: 0.04,
        stormDefenseBonus: 0.05,
        dnaBonus: 12,
        biomassBonus: 25,
        uniqueUnit: 'Kỵ Sĩ Hươu Thần',
      },
      {
        id: 'druid-sanctuary',
        label: 'Quang Hợp Lục Diệp Cổ Đại',
        tier: 2,
        description: 'Thảm thực vật tạo oxy dồi dào, dựng màn chắn sinh thái bảo vệ sinh vật trước biến đổi khí hậu.',
        researchCost: 90,
        militaryBonus: 28,
        harvestBonus: 0.14,
        researchBonus: 0.09,
        stormDefenseBonus: 0.18,
        dnaBonus: 28,
        biomassBonus: 60,
        uniqueUnit: 'Trưởng Lão Druid Tự Nhiên',
      },
      {
        id: 'mana-surge',
        label: 'Đột Biến Tái Sinh Bất Tử',
        tier: 3,
        description: 'Gen Telomere kéo dài vô hạn, kích hoạt luồng sinh lực Aether hồi phục toàn diện hệ sinh thái.',
        researchCost: 160,
        militaryBonus: 50,
        harvestBonus: 0.22,
        researchBonus: 0.18,
        stormDefenseBonus: 0.30,
        dnaBonus: 65,
        biomassBonus: 140,
        uniqueUnit: 'Đại Pháp Sư Tự Nhiên & Mộc Tinh Thần',
      },
    ],
  },
  {
    id: 'forge',
    name: 'Cấu Trúc Hình Thái & Giáp Sinh Học',
    tagline: 'Khung xương cứng, vỏ kitin & cơ khí titan',
    icon: '🛡️',
    accentColor: '#f97316',
    description: 'Tiến hóa bộ xương trong chịu lực, lớp vỏ giáp kitin dày đặc, móng vuốt sắc nhọn và hợp nhất cơ khí sinh học.',
    prerequisiteEra: 'Thời Kim Khí',
    perks: [
      {
        id: 'heavy-foundry',
        label: 'Khung Xương & Giáp Vảy Kitin',
        tier: 1,
        description: 'Hình thành xương sống và lớp vảy bảo vệ các cơ quan nội tạng trước kẻ săn mồi.',
        researchCost: 45,
        militaryBonus: 20,
        harvestBonus: 0.04,
        researchBonus: 0.08,
        stormDefenseBonus: 0.08,
        dnaBonus: 15,
        biomassBonus: 20,
        uniqueUnit: 'Vệ Binh Thiết Giáp',
      },
      {
        id: 'flame-turret',
        label: 'Tuyến Nọc Độc & Hỏa Khí Sinh Học',
        tier: 2,
        description: 'Tế bào bài tiết axit và tuyến nhiệt phòng vệ cực mạnh trước bầy quái vật.',
        researchCost: 95,
        militaryBonus: 36,
        harvestBonus: 0.06,
        researchBonus: 0.12,
        stormDefenseBonus: 0.12,
        dnaBonus: 32,
        biomassBonus: 45,
        uniqueUnit: 'Pháo Thủ Hỏa Khí Luyện Kim',
      },
      {
        id: 'steam-golem',
        label: 'Người Đá Titan & Hóa Thạch Cơ Giới',
        tier: 3,
        description: 'Hợp nhất cấu trúc khoáng chất và cơ thể sống thành Cỗ máy Golem sinh học khổng lồ.',
        researchCost: 175,
        militaryBonus: 58,
        harvestBonus: 0.12,
        researchBonus: 0.20,
        stormDefenseBonus: 0.22,
        dnaBonus: 70,
        biomassBonus: 120,
        uniqueUnit: 'Cỗ Máy Golem Bọc Thép Titan',
      },
    ],
  },
  {
    id: 'maritime',
    name: 'Thủy Sinh & Đại Dương Viễn Cổ',
    tagline: 'Mang thở, vây bơi & hải quái biển sâu',
    icon: '🌊',
    accentColor: '#0ea5e9',
    description: 'Chinh phục đại dương từ rạn san hô cổ đại đến đáy biển sâu, thích nghi áp suất cao và điều khiển dòng hải lưu.',
    prerequisiteEra: 'Làng Gỗ',
    perks: [
      {
        id: 'coastal-fleet',
        label: 'Mang Thở & Vây Thủy Động Học',
        tier: 1,
        description: 'Cá cổ đại phát triển vây bơi cơ động, làm chủ hoàn toàn các rạn san hô và vùng nước nông.',
        researchCost: 35,
        militaryBonus: 14,
        harvestBonus: 0.12,
        researchBonus: 0.05,
        stormDefenseBonus: 0.06,
        dnaBonus: 14,
        biomassBonus: 30,
        uniqueUnit: 'Đàn Cá Cổ Đại & Thủy Thủ Lao Móc',
      },
      {
        id: 'tidal-barrier',
        label: 'Phát Quang Sinh Học & Đê Kè Rạn San Hô',
        tier: 2,
        description: 'Cơ quan phát sáng xua đuổi bóng tối biển sâu, rạn san hô vững chắc chống chọi triều cường.',
        researchCost: 85,
        militaryBonus: 26,
        harvestBonus: 0.18,
        researchBonus: 0.10,
        stormDefenseBonus: 0.24,
        dnaBonus: 30,
        biomassBonus: 70,
        uniqueUnit: 'Tu Sĩ Hải Triều Biển Sâu',
      },
      {
        id: 'leviathan-pact',
        label: 'Khế Ước Thần Thú Leviathan',
        tier: 3,
        description: 'Đánh thức chúa tể đại dương cổ đại, thống trị toàn bộ hải lưu lục địa.',
        researchCost: 155,
        militaryBonus: 52,
        harvestBonus: 0.25,
        researchBonus: 0.16,
        stormDefenseBonus: 0.32,
        dnaBonus: 68,
        biomassBonus: 150,
        uniqueUnit: 'Thần Thú Leviathan Biển Sâu',
      },
    ],
  },
  {
    id: 'imperial',
    name: 'Tập Tính Thích Nghi & Đỉnh Cao Tiến Hóa',
    tagline: 'Săn mồi bầy đàn, chế tác công cụ & nền văn minh',
    icon: '👑',
    accentColor: '#eab308',
    description: 'Từ động vật săn mồi bầy đàn, giữ nhiệt đẳng nhiệt đến vượn người chế tác công cụ, dựng xây nền văn minh vĩ đại.',
    prerequisiteEra: 'Thời Kim Khí',
    perks: [
      {
        id: 'legion-discipline',
        label: 'Săn Mồi Bầy Đàn & Giữ Nhiệt Đẳng Nhiệt',
        tier: 1,
        description: 'Tổ chức phối hợp bầy đàn chính xác và lớp lông dày thích ứng với Kỷ Băng Hà giá lạnh.',
        researchCost: 45,
        militaryBonus: 22,
        harvestBonus: 0.05,
        researchBonus: 0.06,
        stormDefenseBonus: 0.06,
        dnaBonus: 18,
        biomassBonus: 22,
        uniqueUnit: 'Sói Tuyết Đầu Đàn & Thợ Săn Bộ Tộc',
      },
      {
        id: 'granite-citadel',
        label: 'Chế Tác Công Cụ & Thành Trì Đá',
        tier: 2,
        description: 'Đôi tay khéo léo chế tạo rìu đá, đắp thành lũy và phát triển ngôn ngữ giao tiếp xã hội.',
        researchCost: 100,
        militaryBonus: 38,
        harvestBonus: 0.08,
        researchBonus: 0.11,
        stormDefenseBonus: 0.20,
        dnaBonus: 35,
        biomassBonus: 50,
        uniqueUnit: 'Kỵ Binh Thiết Giáp Lạc Việt',
      },
      {
        id: 'grand-imperium',
        label: 'Siêu Trí Tuệ & Văn Minh Siêu Thể',
        tier: 3,
        description: 'Đỉnh cao tiến hóa: Khai mở trí tuệ vũ trụ, làm chủ quy luật sinh thái và khai sáng tương lai.',
        researchCost: 180,
        militaryBonus: 62,
        harvestBonus: 0.15,
        researchBonus: 0.22,
        stormDefenseBonus: 0.25,
        dnaBonus: 80,
        biomassBonus: 160,
        uniqueUnit: 'Đại Tướng Thống Soái Siêu Thể',
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
  dnaBonus: number
  biomassBonus: number
  unlockedUnits: string[]
} {
  let militaryBonus = 0
  let harvestBonus = 0
  let researchBonus = 0
  let stormDefenseBonus = 0
  let dnaBonus = 0
  let biomassBonus = 0
  const unlockedUnits: string[] = []

  for (const branch of SPECIALIZATION_BRANCHES) {
    for (const perk of branch.perks) {
      if (unlockedPerkIds.includes(perk.id)) {
        militaryBonus += perk.militaryBonus
        harvestBonus += perk.harvestBonus
        researchBonus += perk.researchBonus
        stormDefenseBonus += perk.stormDefenseBonus
        dnaBonus += perk.dnaBonus ?? 0
        biomassBonus += perk.biomassBonus ?? 0
        unlockedUnits.push(perk.uniqueUnit)
      }
    }
  }

  return { militaryBonus, harvestBonus, researchBonus, stormDefenseBonus, dnaBonus, biomassBonus, unlockedUnits }
}

