import type { ToolId } from '../world/types'

export type SimulationSpeed = 0 | 1 | 2 | 4 | 8
export type VillageEra = 'Thời Đồ Đá' | 'Làng Gỗ' | 'Nông Nghiệp' | 'Thời Kim Khí' | 'Thị Trấn'
export const VILLAGE_TOOL_IDS = [
  'stone-handaxe',
  'flint-axe',
  'stone-hoe',
  'wooden-plow',
  'copper-hammer',
  'bronze-spear',
  'iron-anvil',
] as const
export type VillageToolId = (typeof VILLAGE_TOOL_IDS)[number]
export const VILLAGE_KNOWLEDGE_IDS = [
  'fire-stewardship',
  'weaving-and-storage',
  'timber-joinery',
  'seed-selection',
  'crop-rotation',
  'irrigation-channel',
  'ore-sorting',
  'alloy-casting',
  'masonry',
  'record-keeping',
] as const
export type VillageKnowledgeId = (typeof VILLAGE_KNOWLEDGE_IDS)[number]
export type VillageKnowledgeAssessmentStatus = 'accepted' | 'duplicate' | 'too-advanced' | 'missing-prerequisite' | 'unrecognized'

/** A transparent result for a player-provided knowledge proposal. */
export interface VillageKnowledgeAssessment {
  status: VillageKnowledgeAssessmentStatus
  title: string
  detail: string
  knowledgeId?: VillageKnowledgeId
}
export type EventTone = 'calm' | 'good' | 'warning' | 'danger'
export type CouncilChoiceId = 'stockpile' | 'raise-ward'
export type WorldObjectiveId = 'rooted-grove' | 'full-granary' | 'stormward'
export type ObjectiveMetric = 'forest-tiles' | 'stored-food' | 'resilience'

/** Prevents imported or long-running sessions from leaving safe integer territory. */
export const MAX_SIMULATION_TICK = 1_000_000

export interface VillageSimulation {
  id: string
  name: string
  tileIndex: number
  population: number
  food: number
  happiness: number
  homes: number
  research: number
  military: number
  territory: number
  /** Capacity to absorb a disaster and recover without a soft-lock. */
  resilience: number
  era: VillageEra
  /** Ordered craft ledger that controls both gameplay bonuses and visual growth. */
  tools: VillageToolId[]
  /** Player-taught, validated techniques; arbitrary text never becomes simulation state. */
  knowledge: VillageKnowledgeId[]
  lastDecision: string
}

export interface StormState {
  remainingTicks: number
  intensity: number
}

export interface SimulationEvent {
  id: string
  tick: number
  title: string
  detail: string
  tone: EventTone
}

export interface WorldObjective {
  id: WorldObjectiveId
  metric: ObjectiveMetric
  title: string
  detail: string
  target: number
  progress: number
  completed: boolean
}

export interface CouncilDecision {
  id: string
  issuedTick: number
  title: string
  detail: string
}

export const EMPTY_GOD_TOOL_USES: Record<ToolId, number> = {
  raise: 0,
  lower: 0,
  water: 0,
  forest: 0,
  fertile: 0,
  barren: 0,
  settler: 0,
  storm: 0,
}

export interface SimulationState {
  tick: number
  speed: SimulationSpeed
  paused: boolean
  villages: VillageSimulation[]
  /** Monotonic sequence makes simultaneous, deterministic events safe React keys. */
  eventSequence: number
  activeStorm?: StormState
  events: SimulationEvent[]
  objectives: WorldObjective[]
  godToolUses: Record<ToolId, number>
  pendingCouncil?: CouncilDecision
}
