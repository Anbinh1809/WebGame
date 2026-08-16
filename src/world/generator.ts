import { hash2d, seedToUint32, smoothstep } from './prng'
import type { Climate, TerrainKind, Tile, VillageSite, World, WorldConfig } from './types'

const VILLAGE_NAMES = ['Lưu Vân', 'Mộc Tinh', 'Nham Hải', 'Sương Cốc', 'Lam Viên']

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function interpolate(first: number, second: number, amount: number): number {
  return first + (second - first) * amount
}

function valueNoise(seed: number, x: number, z: number, scale: number): number {
  const sampleX = x / scale
  const sampleZ = z / scale
  const x0 = Math.floor(sampleX)
  const z0 = Math.floor(sampleZ)
  const xBlend = smoothstep(sampleX - x0)
  const zBlend = smoothstep(sampleZ - z0)
  const top = interpolate(hash2d(seed, x0, z0), hash2d(seed, x0 + 1, z0), xBlend)
  const bottom = interpolate(hash2d(seed, x0, z0 + 1), hash2d(seed, x0 + 1, z0 + 1), xBlend)

  return interpolate(top, bottom, zBlend)
}

function fractalNoise(seed: number, x: number, z: number): number {
  const layers = [
    [16, 0.5],
    [8, 0.28],
    [4, 0.14],
    [2, 0.08],
  ] as const
  let result = 0

  for (const [scale, weight] of layers) {
    result += valueNoise(seed, x, z, scale) * weight
  }

  return result
}

function climateOffset(climate: Climate): number {
  if (climate === 'ấm') return 0.2
  if (climate === 'lạnh') return -0.22
  return 0
}

export function getWaterLevel(config: WorldConfig): number {
  return 0.04 + (config.water - 0.5) * 0.6
}

export function classifyBiome(tile: Tile, config: WorldConfig): TerrainKind {
  const waterLevel = getWaterLevel(config)

  if (tile.height <= waterLevel) {
    if (tile.height > waterLevel - 0.05 && tile.temperature > 0.62 && tile.resources > 0.52) {
      return 'san hô'
    }
    return 'biển'
  }
  if (tile.height <= waterLevel + 0.08) return 'bờ cát'
  if (tile.temperature < 0.18 && tile.height > waterLevel + 0.05) return 'sông băng'
  if (tile.height > 1.05 || (tile.temperature < 0.28 && tile.height > waterLevel + 0.1)) return 'tuyết'
  if (tile.height > 0.88 && tile.temperature > 0.62 && tile.resources > 0.68) return 'núi lửa'
  if (tile.height > 0.84) return 'núi'
  if (tile.height > 0.58) {
    if (tile.moisture < 0.26 && tile.temperature > 0.54) return 'hẻm núi'
    return 'đồi'
  }
  if (tile.soil === 'màu mỡ' && tile.moisture > 0.58 && tile.temperature >= 0.42 && tile.temperature <= 0.7 && tile.height > waterLevel + 0.12 && tile.height < 0.72) {
    return 'hoa anh đào'
  }
  if (tile.moisture < 0.32 && tile.temperature > 0.54) return 'sa mạc'
  if (tile.moisture > 0.72 && tile.temperature > 0.52) return 'rừng nhiệt đới'
  if (tile.moisture > 0.76 && tile.height <= waterLevel + 0.25) return 'đầm lầy'
  if (tile.forest || tile.moisture > 0.44) return 'rừng'
  return 'đồng cỏ'
}

function createTile(config: WorldConfig, seed: number, x: number, z: number): Tile {
  const center = (config.size - 1) / 2
  const distFromCenter = Math.hypot(x - center, z - center)
  const normalizedDistance = distFromCenter / (center * 1.42)
  const continental = fractalNoise(seed, x, z) - 0.45
  const ridge = Math.abs(fractalNoise(seed ^ 0x9e3779b9, x + 31, z - 19) - 0.5)

  // Gentle plain expansion around the continent center to give players abundant buildable room
  const centralFlatness = smoothstep(clamp(1.0 - (distFromCenter / (center * 0.72)), 0, 1))
  const rawHeight = continental * 2.1 + ridge * (0.55 * (1 - centralFlatness * 0.35)) - normalizedDistance * 0.28
  const height = clamp(rawHeight + centralFlatness * 0.12, -0.62, 1.52)
  const moisture = clamp(fractalNoise(seed ^ 0x7f4a7c15, x - 17, z + 23) * 0.92 + 0.08, 0, 1)
  const latitudeCold = Math.abs(z - center) / Math.max(center, 1) * 0.32
  const temperature = clamp(
    0.71 + climateOffset(config.climate) - latitudeCold - height * 0.3 + hash2d(seed, x, z) * 0.08,
    0,
    1,
  )
  const soil = (moisture > 0.62 && height > getWaterLevel(config) + 0.12) || (temperature > 0.5 && moisture > 0.65)
    ? 'màu mỡ'
    : (moisture < 0.3 && temperature > 0.55)
      ? 'cằn cỗi'
      : 'thường'
  const resources = clamp(
    (0.2 + ridge * 0.82 + moisture * 0.16 + hash2d(seed ^ 0x2c1b3c6d, x, z) * 0.26) * config.resources,
    0,
    1,
  )
  const tile: Tile = {
    index: z * config.size + x,
    x,
    z,
    height,
    moisture,
    temperature,
    biome: 'đồng cỏ',
    soil,
    forest: false,
    resources,
  }

  return tile
}

function normalizeElevation(tiles: Tile[], config: WorldConfig, seed: number): Tile[] {
  let minimum = Number.POSITIVE_INFINITY
  let maximum = Number.NEGATIVE_INFINITY

  for (let i = 0; i < tiles.length; i += 1) {
    const h = tiles[i]!.height
    if (h < minimum) minimum = h
    if (h > maximum) maximum = h
  }

  const range = Math.max(maximum - minimum, 0.001)
  const waterLevel = getWaterLevel(config)

  return tiles.map((tile) => {
    const normalized = (tile.height - minimum) / range
    const height = clamp(-0.55 + normalized * 1.85, -0.55, 1.3)
    const forest =
      height > waterLevel + 0.08 &&
      height < 0.82 &&
      tile.moisture > 0.42 &&
      tile.temperature > 0.24 &&
      hash2d(seed ^ 0x4cf5ad43, tile.x, tile.z) > 0.28
    const elevatedTile = { ...tile, height, forest }

    // Generation must establish the same ecology invariant used by terrain
    // tools and save validation: ocean tiles cannot keep mineable resources.
    return refreshTileBiome(elevatedTile, config)
  })
}

export function chooseVillageSite(tiles: Tile[], config: WorldConfig, seed: number): VillageSite {
  const center = (config.size - 1) / 2
  const candidates = tiles
    .filter((tile) => tile.biome === 'đồng cỏ' || tile.biome === 'rừng' || tile.biome === 'rừng nhiệt đới' || tile.biome === 'hoa anh đào')
    .map((tile) => {
      const distancePenalty = Math.hypot(tile.x - center, tile.z - center) * 0.03
      const score = tile.moisture * 0.7 + tile.resources * 0.45 - distancePenalty + hash2d(seed, tile.x, tile.z) * 0.08
      return { tile, score }
    })
    .sort((first, second) => second.score - first.score)
  const fallback = tiles[Math.floor(tiles.length / 2)]
  const chosen = candidates[0]?.tile ?? fallback

  if (!chosen) {
    throw new Error('Không thể tạo một ô đất cho làng khởi đầu.')
  }

  return {
    id: 'village-first-light',
    name: VILLAGE_NAMES[seed % VILLAGE_NAMES.length] ?? 'Lưu Vân',
    tileIndex: chosen.index,
  }
}

export function normalizeWorldConfig(config: WorldConfig): WorldConfig {
  const cleanSeed = config.seed.trim().slice(0, 64) || 'aetheria-bình-minh'
  const cleanSize = Math.round(clamp(config.size, 18, 64))

  return {
    ...config,
    seed: cleanSeed,
    size: cleanSize,
    water: clamp(config.water, 0.2, 0.82),
    resources: clamp(config.resources, 0.2, 1),
  }
}

export interface WorldGenerationOptions {
  pristine?: boolean
}

export function generateWorld(input: WorldConfig, options?: WorldGenerationOptions): World {
  const config = normalizeWorldConfig(input)
  const seed = seedToUint32(config.seed)
  const rawTiles: Tile[] = []

  for (let z = 0; z < config.size; z += 1) {
    for (let x = 0; x < config.size; x += 1) {
      rawTiles.push(createTile(config, seed, x, z))
    }
  }
  const tiles = normalizeElevation(rawTiles, config, seed)
  const villages = options?.pristine ? [] : [chooseVillageSite(tiles, config, seed)]

  return {
    config,
    tiles,
    villages,
    revision: 0,
  }
}

export function getTile(world: World, tileIndex: number): Tile | undefined {
  return world.tiles[tileIndex]
}

export function refreshTileBiome(tile: Tile, config: WorldConfig): Tile {
  const waterLevel = getWaterLevel(config)
  const supportsForest = tile.height > waterLevel + 0.08
    && tile.height < 0.85
    && tile.moisture > 0.38
    && tile.temperature > 0.22
  const isCoral = tile.height <= waterLevel && tile.height > waterLevel - 0.05 && tile.temperature > 0.62 && tile.resources > 0.52
  const withEcologyRules = tile.height <= waterLevel
    ? (isCoral ? { ...tile, forest: false } : { ...tile, forest: false, resources: 0 })
    : { ...tile, forest: tile.forest && supportsForest }
  return { ...withEcologyRules, biome: classifyBiome(withEcologyRules, config) }
}
