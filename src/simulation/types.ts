import type { ToolId } from '../world/types'

export type SimulationSpeed = 0 | 1 | 2 | 4 | 8
export type VillageEra = 'Mầm lửa' | 'Nhà gỗ' | 'Thợ đá' | 'Nông trang' | 'Thành đá'
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
