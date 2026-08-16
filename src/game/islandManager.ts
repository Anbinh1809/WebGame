import {
  calculatePairwiseDuplicateRate,
  createIslandEvolutionProfile,
  detectEvolutionConvergence,
  gainEvolutionPoints,
  unlockEvolutionNode,
} from '../simulation/evolution/evolutionEngine'
import type { ConvergenceEvent, IslandEvolutionProfile } from '../simulation/evolution/types'
import type { SpawnedSketchfabEntity } from '../renderer/SketchfabModelLayer'
import { generateWorld } from '../world/generator'
import type { World, WorldConfig } from '../world/types'
import { DEFAULT_WORLD_CONFIG } from '../world/types'
import { createSimulation } from '../simulation/engine'
import type { SimulationState } from '../simulation/types'

export interface PlayerIsland {
  id: string
  name: string
  config: WorldConfig
  world: World
  simulation: SimulationState
  evolution: IslandEvolutionProfile
  spawnedSketchfabEntities: SpawnedSketchfabEntity[]
  createdAt: number
  lastPlayedAt: number
}

const ISLANDS_STORAGE_KEY = 'aetheria_player_archipelago_v1'

export class IslandArchipelagoManager {
  private islands: Map<string, PlayerIsland> = new Map()
  private activeIslandId: string

  constructor() {
    this.activeIslandId = 'island-prime'
    this.initializeDefaultIslands()
  }

  private initializeDefaultIslands(): void {
    // Check if stored in localStorage
    try {
      const stored = localStorage.getItem(ISLANDS_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as { activeId: string; islands: PlayerIsland[] }
        if (parsed.islands && parsed.islands.length > 0) {
          this.activeIslandId = parsed.activeId
          parsed.islands.forEach((isl) => this.islands.set(isl.id, isl))
          return
        }
      }
    } catch {
      // Fallback
    }

    // Create default Prime Island
    const primeConfig: WorldConfig = { ...DEFAULT_WORLD_CONFIG, seed: 'aetheria-quần-đảo-chính' }
    const primeWorld = generateWorld(primeConfig, { pristine: true })
    const primeSim = createSimulation(primeWorld)
    const primeEvo = createIslandEvolutionProfile('island-prime', 'Đảo Khởi Nguyên Aetheria', primeConfig.seed, {
      waterRatio: primeConfig.water,
      forestRatio: 0.45,
      elevationAvg: 0.5,
      climate: primeConfig.climate,
    })

    const primeIsland: PlayerIsland = {
      id: 'island-prime',
      name: 'Đảo Khởi Nguyên Aetheria',
      config: primeConfig,
      world: primeWorld,
      simulation: primeSim,
      evolution: primeEvo,
      spawnedSketchfabEntities: [],
      createdAt: Date.now(),
      lastPlayedAt: Date.now(),
    }

    this.islands.set(primeIsland.id, primeIsland)
    this.activeIslandId = primeIsland.id
  }

  public getActiveIsland(): PlayerIsland {
    return this.islands.get(this.activeIslandId) ?? Array.from(this.islands.values())[0]!
  }

  public getAllIslands(): readonly PlayerIsland[] {
    return Array.from(this.islands.values())
  }

  public setActiveIsland(id: string): PlayerIsland | undefined {
    if (this.islands.has(id)) {
      this.activeIslandId = id
      this.persist()
      return this.getActiveIsland()
    }
    return undefined
  }

  public switchIsland(id: string): PlayerIsland {
    const target = this.islands.get(id)
    if (!target) throw new Error(`Không tìm thấy hòn đảo: ${id}`)
    target.lastPlayedAt = Date.now()
    this.activeIslandId = id
    this.persist()
    return target
  }

  public createIsland(name: string, config: WorldConfig): PlayerIsland {
    const id = `island-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const world = generateWorld(config, { pristine: true })
    const simulation = createSimulation(world)
    const evolution = createIslandEvolutionProfile(id, name, config.seed, {
      waterRatio: config.water,
      forestRatio: 0.5,
      elevationAvg: 0.5,
      climate: config.climate,
    })

    const newIsland: PlayerIsland = {
      id,
      name,
      config,
      world,
      simulation,
      evolution,
      spawnedSketchfabEntities: [],
      createdAt: Date.now(),
      lastPlayedAt: Date.now(),
    }

    this.islands.set(id, newIsland)
    this.activeIslandId = id
    this.checkAndApplyCrossIslandConvergences()
    this.persist()
    return newIsland
  }

  public updateActiveIslandState(
    world?: World,
    simulation?: SimulationState,
    evolution?: IslandEvolutionProfile,
    spawnedEntities?: SpawnedSketchfabEntity[],
  ): void {
    const current = this.getActiveIsland()
    if (world) current.world = world
    if (simulation) current.simulation = simulation
    if (evolution) current.evolution = evolution
    if (spawnedEntities) current.spawnedSketchfabEntities = spawnedEntities
    current.lastPlayedAt = Date.now()
    this.persist()
  }

  public unlockActiveIslandEvolutionNode(nodeId: string): { success: boolean; error?: string; evolution: IslandEvolutionProfile } {
    const current = this.getActiveIsland()
    const result = unlockEvolutionNode(current.evolution, nodeId)
    if (result.success) {
      current.evolution = result.profile
      this.persist()
    }
    return {
      success: result.success,
      ...(result.error !== undefined ? { error: result.error } : {}),
      evolution: current.evolution,
    }
  }

  public addActiveIslandEvolutionPoints(dna: number, biomass: number): IslandEvolutionProfile {
    const current = this.getActiveIsland()
    current.evolution = gainEvolutionPoints(current.evolution, dna, biomass)
    this.persist()
    return current.evolution
  }

  public addActiveIslandSketchfabEntity(entity: SpawnedSketchfabEntity): void {
    const current = this.getActiveIsland()
    current.spawnedSketchfabEntities.push(entity)
    this.persist()
  }

  public removeActiveIslandSketchfabEntity(id: string): void {
    const current = this.getActiveIsland()
    current.spawnedSketchfabEntities = current.spawnedSketchfabEntities.filter((e) => e.id !== id)
    this.persist()
  }

  public checkAndApplyCrossIslandConvergences(): ConvergenceEvent[] {
    const all = this.getAllIslands()
    const events: ConvergenceEvent[] = []

    for (let i = 0; i < all.length; i++) {
      const islandA = all[i]
      if (!islandA) continue
      for (let j = i + 1; j < all.length; j++) {
        const islandB = all[j]
        if (!islandB) continue
        const event = detectEvolutionConvergence(islandA.evolution, islandB.evolution)
        if (event) {
          events.push(event)
          // Add event to both profiles if not already recorded
          if (!islandA.evolution.convergenceEvents.some((e) => e.islandBId === islandB.id && e.keystoneTaxonId === event.keystoneTaxonId)) {
            islandA.evolution.convergenceEvents.push(event)
          }
          if (!islandB.evolution.convergenceEvents.some((e) => e.islandBId === islandA.id && e.keystoneTaxonId === event.keystoneTaxonId)) {
            islandB.evolution.convergenceEvents.push(event)
          }
        }
      }
    }

    return events
  }

  public getArchipelagoConvergenceStats() {
    const all = this.getAllIslands()
    const profiles = all.map((isl) => isl.evolution)
    return calculatePairwiseDuplicateRate(profiles)
  }

  private persist(): void {
    try {
      const data = {
        activeId: this.activeIslandId,
        islands: Array.from(this.islands.values()),
      }
      localStorage.setItem(ISLANDS_STORAGE_KEY, JSON.stringify(data))
    } catch {
      // Ignore in memory-only test environments
    }
  }
}

export const islandArchipelagoManager = new IslandArchipelagoManager()
