import { hash2d, seedToUint32 } from './prng'
import type { Tile, World } from './types'

export const FAUNA_SPECIES = ['hươu-rừng', 'lợn-rừng', 'sơn-dương', 'hồn-cát', 'thạch-thú'] as const

export type FaunaSpecies = (typeof FAUNA_SPECIES)[number]
export type FaunaCategory = 'animal' | 'monster'

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
}

export interface FaunaPopulation {
  total: number
  animals: number
  monsters: number
  species: readonly {
    id: FaunaSpecies
    label: string
    category: FaunaCategory
    count: number
  }[]
}

const FAUNA_LABELS: Record<FaunaSpecies, string> = {
  'hươu-rừng': 'Hươu rừng',
  'lợn-rừng': 'Lợn rừng',
  'sơn-dương': 'Sơn dương',
  'hồn-cát': 'Hồn cát',
  'thạch-thú': 'Thạch thú',
}

function categoryFor(species: FaunaSpecies): FaunaCategory {
  return species === 'hồn-cát' || species === 'thạch-thú' ? 'monster' : 'animal'
}

function speciesForTile(tile: Tile, seed: number): FaunaSpecies | undefined {
  if (tile.biome === 'biển') return undefined
  if (tile.biome === 'bờ cát') return 'hồn-cát'
  if (tile.biome === 'đồi' || tile.biome === 'núi') return hash2d(seed ^ 0x5d2af1, tile.x, tile.z) > 0.7 ? 'thạch-thú' : 'sơn-dương'
  if (tile.biome === 'tuyết') return hash2d(seed ^ 0x8bc34a, tile.x, tile.z) > 0.78 ? 'thạch-thú' : 'sơn-dương'
  if (tile.biome === 'rừng') return hash2d(seed ^ 0xa10f55, tile.x, tile.z) > 0.52 ? 'lợn-rừng' : 'hươu-rừng'
  if (tile.resources > 0.87 && hash2d(seed ^ 0x33a17c, tile.x, tile.z) > 0.9) return 'thạch-thú'
  return 'hươu-rừng'
}

function spawnChance(species: FaunaSpecies): number {
  switch (species) {
    case 'hươu-rừng': return 0.042
    case 'lợn-rừng': return 0.038
    case 'sơn-dương': return 0.031
    case 'hồn-cát': return 0.026
    case 'thạch-thú': return 0.018
  }
}

function scaleFor(species: FaunaSpecies, variation: number): number {
  const base = species === 'thạch-thú' ? 1.12 : species === 'hồn-cát' ? 0.94 : species === 'sơn-dương' ? 0.9 : 0.82
  return base + variation * 0.24
}

function createSpawn(tile: Tile, species: FaunaSpecies, seed: number): FaunaSpawn {
  const variation = hash2d(seed ^ 0x79d8a3, tile.x, tile.z)
  const offsetX = (hash2d(seed ^ 0x3b94d1, tile.z, tile.x) - 0.5) * 0.5
  const offsetZ = (hash2d(seed ^ 0xd3128f, tile.x, tile.z) - 0.5) * 0.5
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
  }
}

function fallbackSpawn(candidates: readonly FaunaSpawn[], category: FaunaCategory): FaunaSpawn | undefined {
  return candidates
    .filter((candidate) => candidate.category === category)
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

  for (const tile of world.tiles) {
    const species = speciesForTile(tile, seed)
    if (!species) continue
    const spawn = createSpawn(tile, species, seed)
    candidates.push(spawn)
    if (hash2d(seed ^ 0x0f48d2, tile.x, tile.z) < spawnChance(species)) spawns.push(spawn)
  }

  if (!spawns.some((spawn) => spawn.category === 'animal')) {
    const fallback = fallbackSpawn(candidates, 'animal')
    if (fallback) spawns.push(fallback)
  }
  if (!spawns.some((spawn) => spawn.category === 'monster')) {
    const fallback = fallbackSpawn(candidates, 'monster')
    if (fallback) spawns.push(fallback)
  }

  return spawns.sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id))
}

export function summarizeFauna(world: World): FaunaPopulation {
  const spawns = generateFauna(world)
  const counts = new Map<FaunaSpecies, number>()
  let animals = 0
  let monsters = 0

  for (const spawn of spawns) {
    counts.set(spawn.species, (counts.get(spawn.species) ?? 0) + 1)
    if (spawn.category === 'animal') animals += 1
    else monsters += 1
  }

  return {
    total: spawns.length,
    animals,
    monsters,
    species: FAUNA_SPECIES.flatMap((species) => {
      const count = counts.get(species) ?? 0
      return count > 0 ? [{ id: species, label: FAUNA_LABELS[species], category: categoryFor(species), count }] : []
    }),
  }
}
