import { hash2d, seedToUint32 } from './prng'
import type { Tile, World } from './types'

export const FAUNA_SPECIES = [
  'hươu-rừng',
  'lợn-rừng',
  'sơn-dương',
  'sói-hoang',
  'cự-tượng',
  'hồn-cát',
  'thạch-thú',
  'mộc-quái',
  'dực-long',
  'lang-tộc',
  'dực-điểu',
] as const

export type FaunaSpecies = (typeof FAUNA_SPECIES)[number]
export type FaunaCategory = 'animal' | 'monster'

export interface FaunaCombatStats {
  health: number
  attack: number
  bountyFood: number
  bountyResearch: number
  threatLevel: number
}

export interface FaunaSpawn {
  id: string
  category: FaunaCategory
  species: FaunaSpecies
  tileIndex: number
  /** Tile-space coordinates keep the world data independent from renderer scale. */
  x: number
  z: number
  elevation: number
  rotation: number
  scale: number
  pace: number
  phase: number
  priority: number
  stats: FaunaCombatStats
}

export interface FaunaPopulation {
  total: number
  animals: number
  monsters: number
  threatLevel: number
  species: readonly {
    id: FaunaSpecies
    label: string
    category: FaunaCategory
    count: number
  }[]
}

const FAUNA_LABELS: Record<FaunaSpecies, string> = {
  'hươu-rừng': 'Hươu rừng',
  'lợn-rừng': 'Gấu rừng cổ đại',
  'sơn-dương': 'Chiến mã hoang dã',
  'sói-hoang': 'Sói tuyết săn mồi',
  'cự-tượng': 'Voi chiến khổng lồ',
  'hồn-cát': 'Chiến binh vong hồn',
  'thạch-thú': 'Người đá dung nham',
  'mộc-quái': 'Mộc tinh cổ thụ',
  'dực-long': 'Dực long băng sơn',
  'lang-tộc': 'Quái thú người sói',
  'dực-điểu': 'Dực điểu thần thoại',
}

export const FAUNA_COMBAT_STATS: Record<FaunaSpecies, FaunaCombatStats> = {
  'hươu-rừng': { health: 40, attack: 5, bountyFood: 12, bountyResearch: 2, threatLevel: 1 },
  'lợn-rừng': { health: 75, attack: 14, bountyFood: 22, bountyResearch: 4, threatLevel: 2 },
  'sơn-dương': { health: 60, attack: 8, bountyFood: 16, bountyResearch: 3, threatLevel: 1 },
  'sói-hoang': { health: 55, attack: 12, bountyFood: 15, bountyResearch: 4, threatLevel: 2 },
  'cự-tượng': { health: 160, attack: 24, bountyFood: 45, bountyResearch: 10, threatLevel: 4 },
  'hồn-cát': { health: 90, attack: 18, bountyFood: 25, bountyResearch: 8, threatLevel: 3 },
  'thạch-thú': { health: 140, attack: 26, bountyFood: 35, bountyResearch: 15, threatLevel: 4 },
  'mộc-quái': { health: 180, attack: 32, bountyFood: 45, bountyResearch: 22, threatLevel: 5 },
  'dực-long': { health: 260, attack: 45, bountyFood: 70, bountyResearch: 40, threatLevel: 6 },
  'lang-tộc': { health: 130, attack: 28, bountyFood: 30, bountyResearch: 18, threatLevel: 4 },
  'dực-điểu': { health: 200, attack: 38, bountyFood: 55, bountyResearch: 30, threatLevel: 5 },
}

function categoryFor(species: FaunaSpecies): FaunaCategory {
  return species === 'hươu-rừng' || species === 'lợn-rừng' || species === 'sơn-dương' || species === 'sói-hoang' || species === 'cự-tượng' ? 'animal' : 'monster'
}

function speciesForTile(tile: Tile, seed: number): FaunaSpecies | undefined {
  if (tile.biome === 'biển' || tile.height < 0.15) return undefined
  if (tile.biome === 'bờ cát') return undefined
  if (tile.biome === 'tuyết') {
    const roll = hash2d(seed ^ 0x8bc34a, tile.x, tile.z)
    if (roll > 0.85) return 'dực-long'
    if (roll > 0.68) return 'sói-hoang'
    if (roll > 0.5) return 'thạch-thú'
    return 'sơn-dương'
  }
  if (tile.biome === 'đồi' || tile.biome === 'núi') {
    const roll = hash2d(seed ^ 0x5d2af1, tile.x, tile.z)
    if (roll > 0.88 && tile.height > 0.7) return 'dực-điểu'
    if (roll > 0.72) return 'thạch-thú'
    if (roll > 0.5) return 'lang-tộc'
    return 'sơn-dương'
  }
  if (tile.biome === 'rừng') {
    const roll = hash2d(seed ^ 0xa10f55, tile.x, tile.z)
    if (roll > 0.86) return 'mộc-quái'
    if (roll > 0.68) return 'lang-tộc'
    if (roll > 0.48) return 'lợn-rừng'
    return 'hươu-rừng'
  }
  if (tile.resources > 0.82) {
    const roll = hash2d(seed ^ 0x33a17c, tile.x, tile.z)
    if (roll > 0.7) return 'cự-tượng'
    if (roll > 0.4) return 'hồn-cát'
  }
  return 'hươu-rừng'
}

function spawnChance(species: FaunaSpecies): number {
  switch (species) {
    case 'hươu-rừng': return 0.038
    case 'lợn-rừng': return 0.032
    case 'sơn-dương': return 0.028
    case 'sói-hoang': return 0.025
    case 'cự-tượng': return 0.015
    case 'hồn-cát': return 0.024
    case 'thạch-thú': return 0.018
    case 'mộc-quái': return 0.014
    case 'dực-long': return 0.01
    case 'lang-tộc': return 0.016
    case 'dực-điểu': return 0.012
  }
}

function scaleFor(species: FaunaSpecies, variation: number): number {
  const base = species === 'dực-long' || species === 'dực-điểu'
    ? 1.45
    : species === 'mộc-quái' || species === 'cự-tượng'
    ? 1.35
    : species === 'thạch-thú' || species === 'lang-tộc'
    ? 1.15
    : species === 'hồn-cát' || species === 'lợn-rừng'
    ? 0.98
    : species === 'sơn-dương' || species === 'sói-hoang'
    ? 0.92
    : 0.82
  return base + variation * 0.24
}

function createSpawn(tile: Tile, species: FaunaSpecies, seed: number): FaunaSpawn {
  const variation = hash2d(seed ^ 0x79d8a3, tile.x, tile.z)
  const offsetX = (hash2d(seed ^ 0x3b94d1, tile.z, tile.x) - 0.5) * 0.4
  const offsetZ = (hash2d(seed ^ 0xd3128f, tile.x, tile.z) - 0.5) * 0.4
  const category = categoryFor(species)
  return {
    id: `${species}-${tile.index}`,
    category,
    species,
    tileIndex: tile.index,
    x: tile.x + offsetX,
    z: tile.z + offsetZ,
    elevation: tile.height,
    rotation: hash2d(seed ^ 0x124cf7, tile.x, tile.z) * Math.PI * 2,
    scale: scaleFor(species, variation),
    pace: 0.34 + hash2d(seed ^ 0x6efb29, tile.x, tile.z) * 0.32,
    phase: hash2d(seed ^ 0x7816d5, tile.z, tile.x) * Math.PI * 2,
    priority: hash2d(seed ^ 0xf41e63, tile.x, tile.z),
    stats: FAUNA_COMBAT_STATS[species],
  }
}

function fallbackSpawn(candidates: readonly FaunaSpawn[], category: FaunaCategory, excludedTiles: Set<number>): FaunaSpawn | undefined {
  return candidates
    .filter((candidate) => candidate.category === category && !excludedTiles.has(candidate.tileIndex))
    .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id))[0]
}

/**
 * Creates an authored, deterministic wildlife layer without storing transient
 * creatures in saves. Every seed gets an ecosystem, while the renderer applies
 * its own quality cap before drawing it.
 */
export function generateFauna(world: World): readonly FaunaSpawn[] {
  const seed = seedToUint32(world.config.seed)
  const candidates: FaunaSpawn[] = []
  const spawns: FaunaSpawn[] = []
  const usedTiles = new Set<number>()

  for (const tile of world.tiles) {
    if (tile.biome === 'biển' || tile.height < 0.15) continue
    const species = speciesForTile(tile, seed)
    if (!species) continue
    const spawn = createSpawn(tile, species, seed)
    candidates.push(spawn)
    if (!usedTiles.has(tile.index) && hash2d(seed ^ 0x0f48d2, tile.x, tile.z) < spawnChance(species)) {
      spawns.push(spawn)
      usedTiles.add(tile.index)
    }
  }

  if (!spawns.some((spawn) => spawn.category === 'animal')) {
    const fallback = fallbackSpawn(candidates, 'animal', usedTiles)
    if (fallback) {
      spawns.push(fallback)
      usedTiles.add(fallback.tileIndex)
    }
  }
  if (!spawns.some((spawn) => spawn.category === 'monster')) {
    const fallback = fallbackSpawn(candidates, 'monster', usedTiles)
    if (fallback) {
      spawns.push(fallback)
      usedTiles.add(fallback.tileIndex)
    }
  }

  return spawns.sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id))
}

export function summarizeFauna(world: World): FaunaPopulation {
  const spawns = generateFauna(world)
  const counts = new Map<FaunaSpecies, number>()
  let animals = 0
  let monsters = 0
  let threatLevel = 0

  for (const spawn of spawns) {
    counts.set(spawn.species, (counts.get(spawn.species) ?? 0) + 1)
    if (spawn.category === 'animal') animals += 1
    else {
      monsters += 1
      threatLevel += spawn.stats.threatLevel
    }
  }

  return {
    total: spawns.length,
    animals,
    monsters,
    threatLevel,
    species: FAUNA_SPECIES.flatMap((species) => {
      const count = counts.get(species) ?? 0
      return count > 0 ? [{ id: species, label: FAUNA_LABELS[species], category: categoryFor(species), count }] : []
    }),
  }
}
