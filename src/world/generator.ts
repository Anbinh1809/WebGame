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

  if (tile.height <= waterLevel) return 'biển'
  if (tile.height <= waterLevel + 0.1) return 'bờ cát'
  if (tile.height > 1.06 && tile.temperature < 0.43) return 'tuyết'
  if (tile.height > 0.87) return 'núi'
  if (tile.height > 0.62) return 'đồi'
  if (tile.forest) return 'rừng'
  return 'đồng cỏ'
}

function createTile(config: WorldConfig, seed: number, x: number, z: number): Tile {
  const center = (config.size - 1) / 2
  const normalizedDistance = Math.hypot(x - center, z - center) / (center * 1.42)
  const continental = fractalNoise(seed, x, z) - 0.47
  const ridge = Math.abs(fractalNoise(seed ^ 0x9e3779b9, x + 31, z - 19) - 0.5)
  const height = clamp(continental * 2.2 + ridge * 0.55 - normalizedDistance * 0.27, -0.62, 1.52)
  const moisture = clamp(fractalNoise(seed ^ 0x7f4a7c15, x - 17, z + 23) * 0.92 + 0.08, 0, 1)
  const latitudeCold = Math.abs(z - center) / Math.max(center, 1) * 0.32
  const temperature = clamp(
    0.71 + climateOffset(config.climate) - latitudeCold - height * 0.3 + hash2d(seed, x, z) * 0.08,
    0,
    1,
  )
  const soil = moisture > 0.62 && height > getWaterLevel(config) + 0.12 ? 'màu mỡ' : 'thường'
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
  const rawHeights = tiles.map((tile) => tile.height)
  const minimum = Math.min(...rawHeights)
  const maximum = Math.max(...rawHeights)
  const range = Math.max(maximum - minimum, 0.001)
  const waterLevel = getWaterLevel(config)

  return tiles.map((tile) => {
    const normalized = (tile.height - minimum) / range
    const height = clamp(-0.55 + normalized * 1.85, -0.55, 1.3)
    const forest =
      height > waterLevel + 0.1 &&
      height < 0.72 &&
      tile.moisture > 0.49 &&
      tile.temperature > 0.22 &&
      hash2d(seed ^ 0x4cf5ad43, tile.x, tile.z) > 0.43
    const elevatedTile = { ...tile, height, forest }

    return { ...elevatedTile, biome: classifyBiome(elevatedTile, config) }
  })
}

function chooseVillageSite(tiles: Tile[], config: WorldConfig, seed: number): VillageSite {
  const center = (config.size - 1) / 2
  const candidates = tiles
    .filter((tile) => tile.biome === 'đồng cỏ' || tile.biome === 'rừng')
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
  const cleanSize = Math.round(clamp(config.size, 18, 52))

  return {
    ...config,
    seed: cleanSeed,
    size: cleanSize,
    water: clamp(config.water, 0.2, 0.82),
    resources: clamp(config.resources, 0.2, 1),
  }
}

export function generateWorld(input: WorldConfig): World {
  const config = normalizeWorldConfig(input)
  const seed = seedToUint32(config.seed)
  const rawTiles: Tile[] = []

  for (let z = 0; z < config.size; z += 1) {
    for (let x = 0; x < config.size; x += 1) {
      rawTiles.push(createTile(config, seed, x, z))
    }
  }
  const tiles = normalizeElevation(rawTiles, config, seed)

  return {
    config,
    tiles,
    villages: [chooseVillageSite(tiles, config, seed)],
    revision: 0,
  }
}

export function getTile(world: World, tileIndex: number): Tile | undefined {
  return world.tiles[tileIndex]
}

export function refreshTileBiome(tile: Tile, config: WorldConfig): Tile {
  const waterLevel = getWaterLevel(config)
  const supportsForest = tile.height > waterLevel + 0.1
    && tile.height < 0.72
    && tile.moisture > 0.42
    && tile.temperature > 0.18
  const withEcologyRules = tile.height <= waterLevel
    ? { ...tile, forest: false, resources: 0 }
    : { ...tile, forest: tile.forest && supportsForest }
  return { ...withEcologyRules, biome: classifyBiome(withEcologyRules, config) }
}
