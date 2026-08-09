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
