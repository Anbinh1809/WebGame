export type SimulationSpeed = 0 | 1 | 2 | 4 | 8
export type VillageEra = 'Mầm lửa' | 'Nhà gỗ' | 'Thợ đá'
export type EventTone = 'calm' | 'good' | 'warning' | 'danger'

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

export interface SimulationState {
  tick: number
  speed: SimulationSpeed
  paused: boolean
  villages: VillageSimulation[]
  activeStorm?: StormState
  events: SimulationEvent[]
}
