import { villageEraLabel, villageToolDefinition, villageToolTier } from './progression'
import type {
  VillageKnowledgeAssessment,
  VillageKnowledgeId,
  VillageSimulation,
  VillageToolId,
} from './types'

export interface VillageKnowledgeEffects {
  harvest: number
  research: number
  stormDefense: number
  resilience: number
}

export interface VillageKnowledgeDefinition {
  id: VillageKnowledgeId
  label: string
  summary: string
  requiredToolId: VillageToolId
  requires: readonly VillageKnowledgeId[]
  aliases: readonly string[]
  effects: VillageKnowledgeEffects
}

const NO_KNOWLEDGE_EFFECTS: VillageKnowledgeEffects = {
  harvest: 0,
  research: 0,
  stormDefense: 0,
  resilience: 0,
}

/**
 * Finite, explainable knowledge catalogue. A player's wording is only used to
 * identify one of these techniques; it never directly changes simulation data.
 */
export const VILLAGE_KNOWLEDGE_DEFINITIONS: readonly VillageKnowledgeDefinition[] = [
  {
    id: 'fire-stewardship',
    label: 'Giữ lửa và hong khô',
    summary: 'Giảm hao hụt lương thực và giúp làng hồi phục tốt hơn.',
    requiredToolId: 'stone-handaxe',
    requires: [],
    aliases: ['giữ lửa', 'giu lua', 'hong khô', 'hong kho', 'bảo quản bằng khói', 'bao quan bang khoi'],
    effects: { harvest: 0.012, research: 0, stormDefense: 0, resilience: 2 },
  },
  {
    id: 'weaving-and-storage',
    label: 'Đan giỏ và dự trữ',
    summary: 'Sắp xếp hạt giống và thực phẩm trước mùa mưa.',
    requiredToolId: 'stone-handaxe',
    requires: ['fire-stewardship'],
    aliases: ['đan giỏ', 'dan gio', 'dự trữ', 'du tru', 'kho lương', 'kho luong'],
    effects: { harvest: 0.014, research: 0.004, stormDefense: 0, resilience: 1.5 },
  },
  {
    id: 'timber-joinery',
    label: 'Ghép mộng gỗ',
    summary: 'Làm mái và vách chắc hơn bằng các mối ghép đơn giản.',
    requiredToolId: 'flint-axe',
    requires: ['weaving-and-storage'],
    aliases: ['ghép mộng', 'ghep mong', 'mộng gỗ', 'mong go', 'xưởng gỗ', 'xuong go'],
    effects: { harvest: 0.006, research: 0.012, stormDefense: 0.01, resilience: 2.5 },
  },
  {
    id: 'seed-selection',
    label: 'Chọn hạt giống',
    summary: 'Giữ lại hạt khỏe để mùa sau cho năng suất ổn định hơn.',
    requiredToolId: 'stone-hoe',
    requires: ['weaving-and-storage'],
    aliases: ['chọn hạt giống', 'chon hat giong', 'hạt giống', 'hat giong', 'gieo hạt', 'gieo hat'],
    effects: { harvest: 0.03, research: 0.006, stormDefense: 0, resilience: 1 },
  },
  {
    id: 'crop-rotation',
    label: 'Luân canh mùa vụ',
    summary: 'Đổi cây trồng theo mùa để đất không nhanh bạc màu.',
    requiredToolId: 'wooden-plow',
    requires: ['seed-selection'],
    aliases: ['luân canh', 'luan canh', 'đổi cây trồng', 'doi cay trong', 'mùa vụ', 'mua vu'],
    effects: { harvest: 0.04, research: 0.012, stormDefense: 0, resilience: 2 },
  },
  {
    id: 'irrigation-channel',
    label: 'Dẫn nước ruộng',
    summary: 'Đào rãnh nhỏ đưa nước về ruộng và giảm thiệt hại khi hạn.',
    requiredToolId: 'wooden-plow',
    requires: ['seed-selection'],
    aliases: ['dẫn nước', 'dan nuoc', 'rãnh nước', 'ranh nuoc', 'tưới ruộng', 'tuoi ruong'],
    effects: { harvest: 0.03, research: 0, stormDefense: 0, resilience: 4 },
  },
  {
    id: 'ore-sorting',
    label: 'Phân loại quặng',
    summary: 'Nhận biết quặng tốt trước khi đưa vào lò rèn.',
    requiredToolId: 'copper-hammer',
    requires: ['timber-joinery'],
    aliases: ['phân loại quặng', 'phan loai quang', 'quặng đồng', 'quang dong', 'tuyển quặng', 'tuyen quang'],
    effects: { harvest: 0, research: 0.05, stormDefense: 0.008, resilience: 1.5 },
  },
  {
    id: 'alloy-casting',
    label: 'Đúc hợp kim',
    summary: 'Đúc vật dụng đồng chắc hơn để tăng sức phòng vệ.',
    requiredToolId: 'bronze-spear',
    requires: ['ore-sorting'],
    aliases: ['đúc hợp kim', 'duc hop kim', 'đúc đồng', 'duc dong', 'hợp kim', 'hop kim'],
    effects: { harvest: 0.006, research: 0.038, stormDefense: 0.035, resilience: 3 },
  },
  {
    id: 'masonry',
    label: 'Xây móng đá',
    summary: 'Gia cố kho và nhà bằng móng đá, giúp thị trấn chịu bão tốt hơn.',
    requiredToolId: 'iron-anvil',
    requires: ['alloy-casting'],
    aliases: ['xây móng đá', 'xay mong da', 'xây đá', 'xay da', 'nề đá', 'ne da'],
    effects: { harvest: 0, research: 0.018, stormDefense: 0.045, resilience: 7 },
  },
  {
    id: 'record-keeping',
    label: 'Sổ ghi mùa vụ',
    summary: 'Ghi lại mùa, kho và công việc để nghiên cứu tiến đều hơn.',
    requiredToolId: 'iron-anvil',
    requires: ['crop-rotation'],
    aliases: ['sổ ghi', 'so ghi', 'ghi mùa vụ', 'ghi mua vu', 'ghi chép', 'ghi chep'],
    effects: { harvest: 0.01, research: 0.07, stormDefense: 0, resilience: 1 },
  },
]

const VILLAGE_KNOWLEDGE_BY_ID = new Map(VILLAGE_KNOWLEDGE_DEFINITIONS.map((knowledge) => [knowledge.id, knowledge]))

const FUTURE_CONCEPTS = [
  { aliases: ['điện', 'dien', 'điện lưới', 'dien luoi', 'máy phát', 'may phat', 'pin'], label: 'Điện năng', detail: 'cần luyện kim chính xác, dây dẫn và máy phát mà làng chưa thể chế tạo' },
  { aliases: ['động cơ hơi nước', 'dong co hoi nuoc', 'hơi nước', 'hoi nuoc'], label: 'Động cơ hơi nước', detail: 'cần luyện sắt, nồi áp lực và gia công cơ khí vượt quá xưởng hiện có' },
  { aliases: ['máy tính', 'may tinh', 'internet', 'robot', 'trí tuệ nhân tạo', 'tri tue nhan tao'], label: 'Công nghệ số', detail: 'cần điện năng, linh kiện chính xác và hạ tầng chưa tồn tại trong thế giới này' },
] as const

function normalizeKnowledgeText(value: string): string {
  return value
    .slice(0, 160)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function includesConcept(proposal: string, alias: string): boolean {
  const normalizedAlias = normalizeKnowledgeText(alias)
  return normalizedAlias.length >= 3 && (proposal === normalizedAlias || proposal.includes(normalizedAlias))
}

function matchingKnowledge(proposal: string): VillageKnowledgeDefinition | undefined {
  let match: { definition: VillageKnowledgeDefinition; score: number } | undefined
  for (const definition of VILLAGE_KNOWLEDGE_DEFINITIONS) {
    for (const alias of [definition.label, ...definition.aliases]) {
      const normalizedAlias = normalizeKnowledgeText(alias)
      if (!includesConcept(proposal, alias)) continue
      if (!match || normalizedAlias.length > match.score) match = { definition, score: normalizedAlias.length }
    }
  }
  return match?.definition
}

function missingKnowledge(definition: VillageKnowledgeDefinition, knowledge: readonly VillageKnowledgeId[]): VillageKnowledgeId[] {
  return definition.requires.filter((knowledgeId) => !knowledge.includes(knowledgeId))
}

function hasRequiredTool(village: Pick<VillageSimulation, 'tools'>, knowledge: VillageKnowledgeDefinition): boolean {
  return village.tools.includes(knowledge.requiredToolId)
}

export function villageKnowledgeDefinition(knowledgeId: VillageKnowledgeId): VillageKnowledgeDefinition {
  const definition = VILLAGE_KNOWLEDGE_BY_ID.get(knowledgeId)
  if (!definition) throw new Error(`Unknown village knowledge: ${knowledgeId}`)
  return definition
}

/** Uses only declared tools and prior entries, so the result is deterministic and explainable. */
export function assessVillageKnowledge(village: VillageSimulation, proposal: string): VillageKnowledgeAssessment {
  const normalizedProposal = normalizeKnowledgeText(proposal)
  if (!normalizedProposal) {
    return {
      status: 'unrecognized',
      title: 'Cần một đề xuất cụ thể',
      detail: 'Hãy truyền một kỹ thuật như “Giữ lửa”, “Chọn hạt giống” hoặc “Dẫn nước ruộng”.',
    }
  }

  const futureConcept = FUTURE_CONCEPTS.find((concept) => concept.aliases.some((alias) => includesConcept(normalizedProposal, alias)))
  if (futureConcept) {
    return {
      status: 'too-advanced',
      title: `${futureConcept.label} chưa hợp thời đại`,
      detail: `${village.name} đang ở ${villageEraLabel(village.era)}; ${futureConcept.detail}.`,
    }
  }

  const definition = matchingKnowledge(normalizedProposal)
  if (!definition) {
    return {
      status: 'unrecognized',
      title: 'Chưa nhận diện được kỹ thuật này',
      detail: `Hội đồng chỉ nhận kỹ thuật có thể làm từ công cụ hiện có của ${villageEraLabel(village.era)}. Hãy thử một gợi ý bên dưới.`,
    }
  }

  if (village.knowledge.includes(definition.id)) {
    return {
      status: 'duplicate',
      title: `${definition.label} đã được truyền đạt`,
      detail: `Dân làng đã dùng kỹ thuật này. ${definition.summary}`,
      knowledgeId: definition.id,
    }
  }

  if (!hasRequiredTool(village, definition)) {
    const requiredTool = villageToolDefinition(definition.requiredToolId)
    return {
      status: 'too-advanced',
      title: `${definition.label} chưa hợp thời đại`,
      detail: `Cần ${requiredTool.label} trước; làng hiện mới có cấp công cụ ${villageToolTier(village.tools) + 1} và đang ở ${villageEraLabel(village.era)}.`,
      knowledgeId: definition.id,
    }
  }

  const missing = missingKnowledge(definition, village.knowledge)
  if (missing.length > 0) {
    return {
      status: 'missing-prerequisite',
      title: `${definition.label} còn thiếu tiền đề`,
      detail: `Hãy truyền ${missing.map((knowledgeId) => villageKnowledgeDefinition(knowledgeId).label).join(', ')} trước khi áp dụng kỹ thuật này.`,
      knowledgeId: definition.id,
    }
  }

  return {
    status: 'accepted',
    title: `Phù hợp: ${definition.label}`,
    detail: `${definition.summary} Kỹ thuật này tương thích với ${villageEraLabel(village.era)} và công cụ hiện có.`,
    knowledgeId: definition.id,
  }
}

export function availableVillageKnowledge(village: VillageSimulation): VillageKnowledgeDefinition[] {
  return VILLAGE_KNOWLEDGE_DEFINITIONS.filter((definition) => (
    !village.knowledge.includes(definition.id)
    && hasRequiredTool(village, definition)
    && missingKnowledge(definition, village.knowledge).length === 0
  ))
}

export function villageKnowledgeEffects(knowledge: readonly VillageKnowledgeId[]): VillageKnowledgeEffects {
  return knowledge.reduce<VillageKnowledgeEffects>((effects, knowledgeId) => {
    const definition = villageKnowledgeDefinition(knowledgeId)
    return {
      harvest: effects.harvest + definition.effects.harvest,
      research: effects.research + definition.effects.research,
      stormDefense: effects.stormDefense + definition.effects.stormDefense,
      resilience: effects.resilience + definition.effects.resilience,
    }
  }, NO_KNOWLEDGE_EFFECTS)
}

/** Reject forged imports that bypass a tool gate, a prerequisite, or uniqueness. */
export function isVillageKnowledgeLedger(value: unknown, tools: readonly VillageToolId[]): value is VillageKnowledgeId[] {
  if (!Array.isArray(value) || value.length > VILLAGE_KNOWLEDGE_DEFINITIONS.length) return false
  if (!value.every((knowledgeId) => typeof knowledgeId === 'string' && VILLAGE_KNOWLEDGE_BY_ID.has(knowledgeId as VillageKnowledgeId))) return false
  const knowledge = value as VillageKnowledgeId[]
  if (new Set(knowledge).size !== knowledge.length) return false
  return knowledge.every((knowledgeId) => {
    const definition = villageKnowledgeDefinition(knowledgeId)
    return tools.includes(definition.requiredToolId) && definition.requires.every((requiredId) => knowledge.includes(requiredId))
  })
}
