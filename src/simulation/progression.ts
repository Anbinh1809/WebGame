import type { VillageEra, VillageSimulation, VillageToolId } from './types'

const VILLAGE_ERA_LABELS: Record<VillageEra, string> = {
  'Thời Đồ Đá': 'Thời đồ đá',
  'Làng Gỗ': 'Làng gỗ',
  'Nông Nghiệp': 'Nông nghiệp',
  'Thời Kim Khí': 'Thời kim khí',
  'Thị Trấn': 'Thị trấn',
}

/** Keeps legacy save values stable while presenting Vietnamese era names naturally. */
export function villageEraLabel(era: VillageEra): string {
  return VILLAGE_ERA_LABELS[era]
}

export interface VillageToolEffects {
  harvest: number
  research: number
  stormDefense: number
  resilience: number
}

export interface VillageToolDefinition {
  id: VillageToolId
  label: string
  era: VillageEra
  researchCost: number
  foodCost: number
  benefit: string
  effects: VillageToolEffects
}

const NO_TOOL_EFFECTS: VillageToolEffects = {
  harvest: 0,
  research: 0,
  stormDefense: 0,
  resilience: 0,
}

/** Ordered, deterministic craft ledger. A village can only unlock its next tool. */
export const VILLAGE_TOOL_DEFINITIONS: readonly VillageToolDefinition[] = [
  {
    id: 'stone-handaxe',
    label: 'Rìu tay đá',
    era: 'Thời Đồ Đá',
    researchCost: 0,
    foodCost: 0,
    benefit: 'Khởi đầu khai thác gỗ và đá quanh lửa trại.',
    effects: { harvest: 0.018, research: 0, stormDefense: 0, resilience: 0 },
  },
  {
    id: 'flint-axe',
    label: 'Rìu đá mài',
    era: 'Làng Gỗ',
    researchCost: 6,
    foodCost: 10,
    benefit: '+ thu hoạch, mở xưởng gỗ và mái lá hoàn chỉnh.',
    effects: { harvest: 0.052, research: 0.012, stormDefense: 0, resilience: 1.5 },
  },
  {
    id: 'stone-hoe',
    label: 'Cuốc đá',
    era: 'Nông Nghiệp',
    researchCost: 15,
    foodCost: 16,
    benefit: '+ thu hoạch từ nông trại.',
    effects: { harvest: 0.078, research: 0.018, stormDefense: 0, resilience: 2.5 },
  },
  {
    id: 'wooden-plow',
    label: 'Cày gỗ',
    era: 'Nông Nghiệp',
    researchCost: 25,
    foodCost: 24,
    benefit: 'Tăng mạnh sản lượng và mở rộng ruộng.',
    effects: { harvest: 0.118, research: 0.024, stormDefense: 0, resilience: 4 },
  },
  {
    id: 'copper-hammer',
    label: 'Búa đồng',
    era: 'Thời Kim Khí',
    researchCost: 38,
    foodCost: 32,
    benefit: '+ nghiên cứu, mở lò rèn đồng.',
    effects: { harvest: 0.034, research: 0.07, stormDefense: 0.025, resilience: 5 },
  },
  {
    id: 'bronze-spear',
    label: 'Giáo đồng',
    era: 'Thời Kim Khí',
    researchCost: 52,
    foodCost: 42,
    benefit: 'Tăng phòng thủ và sức chống bão.',
    effects: { harvest: 0.018, research: 0.035, stormDefense: 0.105, resilience: 8 },
  },
  {
    id: 'iron-anvil',
    label: 'Đe sắt',
    era: 'Thị Trấn',
    researchCost: 70,
    foodCost: 55,
    benefit: 'Xưởng sắt và nhà đá làm làng thành thị trấn.',
    effects: { harvest: 0.042, research: 0.11, stormDefense: 0.06, resilience: 12 },
  },
  {
    id: 'obsidian-dagger',
    label: 'Dao găm hắc diện thạch',
    era: 'Thị Trấn',
    researchCost: 85,
    foodCost: 65,
    benefit: 'Lưỡi dao hắc thạch bén ngọt tăng khả năng tự vệ và thu thập tinh hoa.',
    effects: { harvest: 0.03, research: 0.08, stormDefense: 0.08, resilience: 15 },
  },
  {
    id: 'iron-sword',
    label: 'Kiếm thép hiệp sĩ',
    era: 'Thị Trấn',
    researchCost: 105,
    foodCost: 80,
    benefit: 'Thanh kiếm thép rèn gia tăng vượt bậc khả năng bảo vệ lãnh thổ.',
    effects: { harvest: 0.02, research: 0.09, stormDefense: 0.15, resilience: 20 },
  },
  {
    id: 'hunting-bow',
    label: 'Cung săn gân rồng',
    era: 'Thị Trấn',
    researchCost: 130,
    foodCost: 95,
    benefit: 'Vũ khí tầm xa giúp cư dân săn bắn và cảnh giới từ xa an toàn.',
    effects: { harvest: 0.06, research: 0.08, stormDefense: 0.12, resilience: 22 },
  },
  {
    id: 'repeating-crossbow',
    label: 'Nỏ liên thanh cơ khí',
    era: 'Thị Trấn',
    researchCost: 160,
    foodCost: 115,
    benefit: 'Hệ thống nỏ bắn liên hoàn đẩy lùi mọi nguy cơ thiên tai và thú dữ.',
    effects: { harvest: 0.03, research: 0.12, stormDefense: 0.18, resilience: 26 },
  },
  {
    id: 'war-hammer',
    label: 'Búa chiến công thành',
    era: 'Thị Trấn',
    researchCost: 195,
    foodCost: 140,
    benefit: 'Uy lực nghiền nát mở rộng công trình kiên cố.',
    effects: { harvest: 0.05, research: 0.14, stormDefense: 0.16, resilience: 30 },
  },
  {
    id: 'titan-halberd',
    label: 'Đại kích titan',
    era: 'Thị Trấn',
    researchCost: 240,
    foodCost: 175,
    benefit: 'Vũ khí hộ vệ tối thượng đúc từ hợp kim titan siêu cứng.',
    effects: { harvest: 0.04, research: 0.16, stormDefense: 0.22, resilience: 38 },
  },
  {
    id: 'aether-staff',
    label: 'Trượng linh khí Aether',
    era: 'Thị Trấn',
    researchCost: 290,
    foodCost: 210,
    benefit: 'Hấp thu tinh hoa Aether tạo màng bảo hộ vững chãi.',
    effects: { harvest: 0.08, research: 0.24, stormDefense: 0.25, resilience: 45 },
  },
  {
    id: 'crystal-scepter',
    label: 'Quyền trượng pha lê',
    era: 'Thị Trấn',
    researchCost: 350,
    foodCost: 260,
    benefit: 'Biểu tượng vương quyền và trí tuệ đỉnh cao của nền văn minh.',
    effects: { harvest: 0.12, research: 0.32, stormDefense: 0.3, resilience: 60 },
  },
]

export const STARTING_VILLAGE_TOOLS: readonly VillageToolId[] = ['stone-handaxe']

const VILLAGE_TOOL_BY_ID = new Map(VILLAGE_TOOL_DEFINITIONS.map((tool) => [tool.id, tool]))

export function villageToolDefinition(toolId: VillageToolId): VillageToolDefinition {
  const definition = VILLAGE_TOOL_BY_ID.get(toolId)
  if (!definition) throw new Error(`Unknown village tool: ${toolId}`)
  return definition
}

export function villageToolTier(tools: readonly VillageToolId[]): number {
  const lastTool = tools.at(-1)
  return lastTool ? VILLAGE_TOOL_DEFINITIONS.findIndex((tool) => tool.id === lastTool) : -1
}

export function villageEraForTools(tools: readonly VillageToolId[]): VillageEra {
  const tier = villageToolTier(tools)
  if (tier >= 6) return 'Thị Trấn'
  if (tier >= 4) return 'Thời Kim Khí'
  if (tier >= 2) return 'Nông Nghiệp'
  if (tier >= 1) return 'Làng Gỗ'
  return 'Thời Đồ Đá'
}

export function nextVillageTool(tools: readonly VillageToolId[]): VillageToolDefinition | undefined {
  return VILLAGE_TOOL_DEFINITIONS[tools.length]
}

export function hasVillageTool(village: Pick<VillageSimulation, 'tools'>, toolId: VillageToolId): boolean {
  return village.tools.includes(toolId)
}

export function villageToolEffects(tools: readonly VillageToolId[]): VillageToolEffects {
  return tools.reduce<VillageToolEffects>((effects, toolId) => {
    const tool = villageToolDefinition(toolId)
    return {
      harvest: effects.harvest + tool.effects.harvest,
      research: effects.research + tool.effects.research,
      stormDefense: effects.stormDefense + tool.effects.stormDefense,
      resilience: effects.resilience + tool.effects.resilience,
    }
  }, NO_TOOL_EFFECTS)
}

export function villageEvolutionEpochForTools(tools: readonly VillageToolId[]): import('./types').EvolutionEpoch {
  const tier = villageToolTier(tools)
  if (tier >= 6) return 'Kỷ Nhân Sinh (Văn Minh & Siêu Thể)'
  if (tier >= 4) return 'Kỷ Tân Sinh (Thú Khổng Lồ)'
  if (tier >= 3) return 'Kỷ Trung Sinh (Bò Sát & Dực Long)'
  if (tier >= 2) return 'Kỷ Devon (Lên Cạn)'
  if (tier >= 1) return 'Kỷ Cổ Sinh (Thủy Sinh)'
  return 'Kỷ Tiền Cambri (Đơn Bào)'
}

export interface EvolutionEpochDetail {
  id: import('./types').EvolutionEpoch
  title: string
  period: string
  dominantLife: string
  description: string
  icon: string
  accentColor: string
}

export const EVOLUTION_EPOCH_DETAILS: Record<import('./types').EvolutionEpoch, EvolutionEpochDetail> = {
  'Kỷ Tiền Cambri (Đơn Bào)': {
    id: 'Kỷ Tiền Cambri (Đơn Bào)',
    title: 'Kỷ Tiền Cambri',
    period: '4.000 - 541 triệu năm trước',
    dominantLife: 'Vi sinh vật, Tảo lam & Sinh vật đơn bào',
    description: 'Nước súp hữu cơ nguyên thủy. Tế bào bắt đầu hấp thu năng lượng hóa học, phát triển màng bao và quang hợp.',
    icon: '🦠',
    accentColor: '#38bdf8',
  },
  'Kỷ Cổ Sinh (Thủy Sinh)': {
    id: 'Kỷ Cổ Sinh (Thủy Sinh)',
    title: 'Kỷ Cổ Sinh (Cambrian)',
    period: '541 - 419 triệu năm trước',
    dominantLife: 'Cá cổ đại, Động vật thân mềm & San hô',
    description: 'Bùng nổ sinh học đại dương. Hình thành bộ xương trong, mang thở, vây bơi và cơ quan thị giác sơ khai.',
    icon: '🐠',
    accentColor: '#06b6d4',
  },
  'Kỷ Devon (Lên Cạn)': {
    id: 'Kỷ Devon (Lên Cạn)',
    title: 'Kỷ Devon & Than Đá',
    period: '419 - 298 triệu năm trước',
    dominantLife: 'Lưỡng cư nguyên thủy, Côn trùng khổng lồ & Rừng dương xỉ',
    description: 'Sinh vật vây tay tiến hóa thành tứ chi bò lên cạn. Phát triển phổi thở không khí và rừng cây cổ đại.',
    icon: '🦎',
    accentColor: '#10b981',
  },
  'Kỷ Trung Sinh (Bò Sát & Dực Long)': {
    id: 'Kỷ Trung Sinh (Bò Sát & Dực Long)',
    title: 'Kỷ Trung Sinh (Mesozoic)',
    period: '252 - 66 triệu năm trước',
    dominantLife: 'Khủng long, Bò sát khổng lồ & Dực long bầu trời',
    description: 'Kỷ nguyên thống trị của loài bò sát và khủng long. Phát triển cánh màng bay lượn và lớp da sừng cứng cáp.',
    icon: '🦖',
    accentColor: '#f59e0b',
  },
  'Kỷ Tân Sinh (Thú Khổng Lồ)': {
    id: 'Kỷ Tân Sinh (Thú Khổng Lồ)',
    title: 'Kỷ Tân Sinh (Cenozoic)',
    period: '66 - 0.3 triệu năm trước',
    dominantLife: 'Voi ma mút, Gấu tuyết, Sói săn mồi & Vượn người',
    description: 'Kỷ Băng Hà và sự trỗi dậy của động vật có vú đẳng nhiệt. Tập tính săn mồi bầy đàn và trí thông minh tăng vọt.',
    icon: '🦣',
    accentColor: '#ec4899',
  },
  'Kỷ Nhân Sinh (Văn Minh & Siêu Thể)': {
    id: 'Kỷ Nhân Sinh (Văn Minh & Siêu Thể)',
    title: 'Kỷ Nhân Sinh & Tương Lai',
    period: 'Hiện đại - Tương lai siêu tiến hóa',
    dominantLife: 'Nhân loại, Nền văn minh trí tuệ & Siêu sinh thể',
    description: 'Sử dụng công cụ, ngôn ngữ, khoa học luyện kim và kiểm soát năng lượng nguyên tố sáng thế.',
    icon: '✨',
    accentColor: '#a855f7',
  },
}

