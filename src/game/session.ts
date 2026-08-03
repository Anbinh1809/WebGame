import { createSimulation } from '../simulation/engine'
import type { SimulationState } from '../simulation/types'
import { generateWorld } from '../world/generator'
import type { TileMutationCommand, World, WorldConfig } from '../world/types'

export interface GameSession {
  world: World
  simulation: SimulationState
}

export interface HistoryEntry {
  label: string
  before: GameSession
  after: GameSession
}

export interface GameState {
  session: GameSession
  undoStack: HistoryEntry[]
  redoStack: HistoryEntry[]
}

/** A bounded in-memory history keeps undo responsive without making saves enormous. */
export const MAX_HISTORY_ENTRIES = 32

export function createGameSession(config: WorldConfig): GameSession {
  const world = generateWorld(config)
  return { world, simulation: createSimulation(world) }
}

export function createGameState(config: WorldConfig): GameState {
  return { session: createGameSession(config), undoStack: [], redoStack: [] }
}

export function commitGameChange(state: GameState, after: GameSession, label: string): GameState {
  const entry: HistoryEntry = { label, before: state.session, after }
  return {
    session: after,
    undoStack: [...state.undoStack, entry].slice(-MAX_HISTORY_ENTRIES),
    redoStack: [],
  }
}

/** World recreation is a normal undoable command, so it never silently destroys history. */
export function recreateWorld(state: GameState, config: WorldConfig, label: string): GameState {
  return commitGameChange(state, createGameSession(config), label)
}

export function undoGameChange(state: GameState): GameState {
  const entry = state.undoStack.at(-1)
  if (!entry) return state
  return {
    session: entry.before,
    undoStack: state.undoStack.slice(0, -1),
    redoStack: [entry, ...state.redoStack],
  }
}

export function redoGameChange(state: GameState): GameState {
  const entry = state.redoStack[0]
  if (!entry) return state
  return {
    session: entry.after,
    undoStack: [...state.undoStack, entry].slice(-MAX_HISTORY_ENTRIES),
    redoStack: state.redoStack.slice(1),
  }
}

export function applyTerrainChange(state: GameState, command: TileMutationCommand, world: World): GameState {
  return commitGameChange(state, { ...state.session, world }, command.label)
}
