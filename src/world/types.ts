export const WORLD_SIZES = [28, 36, 48, 60] as const

export type Climate = 'ôn hòa' | 'ấm' | 'lạnh'
export type TerrainKind = 'biển' | 'bờ cát' | 'đồng cỏ' | 'rừng' | 'đồi' | 'núi' | 'tuyết'
export type SoilKind = 'thường' | 'màu mỡ' | 'cằn cỗi'
export type TerrainTool = 'raise' | 'lower' | 'water' | 'forest' | 'fertile' | 'barren'
export type ToolId = TerrainTool | 'settler' | 'storm'
export type HeatmapMode = 'địa hình' | 'tài nguyên' | 'hạnh phúc'

export interface WorldConfig {
  seed: string
  size: number
  climate: Climate
  water: number
  resources: number
}

export interface Tile {
  index: number
  x: number
  z: number
  height: number
  moisture: number
  temperature: number
  biome: TerrainKind
  soil: SoilKind
  forest: boolean
  resources: number
}

export interface VillageSite {
  id: string
  name: string
  tileIndex: number
}

export interface World {
  config: WorldConfig
  tiles: Tile[]
  villages: VillageSite[]
  revision: number
}

export interface TileMutationCommand {
  kind: 'tile'
  label: string
  tileIndex: number
  worldSignature: string
  worldRevisionBefore: number
  worldRevisionAfter: number
  before: Tile
  after: Tile
}

export const DEFAULT_WORLD_CONFIG: WorldConfig = {
  seed: 'aetheria-bình-minh',
  size: 48,
  climate: 'ôn hòa',
  water: 0.54,
  resources: 0.62,
}

export const TERRAIN_TOOL_LABELS: Record<TerrainTool, string> = {
  raise: 'Nâng địa hình',
  lower: 'Hạ địa hình',
  water: 'Gọi nước',
  forest: 'Gieo rừng',
  fertile: 'Làm đất màu mỡ',
  barren: 'Làm đất cằn cỗi',
}
