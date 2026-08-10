import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { SimulationState } from '../simulation/types'
import { villageToolTier } from '../simulation/progression'
import { happinessAtTile } from '../simulation/metrics'
import { createPrng, hash2d, seedToUint32 } from '../world/prng'
import { getWaterLevel } from '../world/generator'
import type { HeatmapMode, Tile, ToolId, World } from '../world/types'
import { ASSET_MANIFEST } from '../assets/manifest'
import { desktopPackRoot, loadDesktopPackManifest } from '../assets/desktopPackManifest'
import { desktopEnvironmentModelEntries } from '../assets/environmentModelManifest'
import { desktopTreeModelEntries } from '../assets/modelManifest'
import { desktopRockModelEntries } from '../assets/rockModelManifest'
import { desktopSettlementModelEntries } from '../assets/settlementModelManifest'
import { assetsForPack } from '../assets/registry'
import type { AssetManifestEntry, AssetMaterialSurface, AssetPackQuality } from '../assets/types'
import { AssetPackManager } from './AssetPackManager'
import type { AssetLoadProgress, AssetPackEntitlements, GameEdition, ResolvedAssetPack } from './AssetPackManager'
import { PolyHavenArtBundle, clearPolyHavenArt, createProceduralArtFallback, loadPolyHavenArt } from './PolyHavenArt'
import type { PolyHavenArtTargets } from './PolyHavenArt'
import { FaunaLayer } from './FaunaLayer'
import { SettlerLayer } from './SettlerLayer'
import type { SettlerPlacement } from './SettlerLayer'
import { AnimatedFaunaLayer, AnimatedSettlerLayer } from './AnimatedActorLayers'
import {
  InstancedModelLayer,
  canLoadTreeModel,
  coastRockModelAssetForPack,
  groundCoverModelAssetForPack,
  loadInstancedCoastRockModel,
  loadInstancedGroundCoverModel,
  loadInstancedRockModel,
  loadInstancedSettlementPropModel,
  loadInstancedTreeModel,
  rockModelAssetForPack,
  settlementLanternModelAssetForPack,
  settlementPropModelInstanceLimit,
  settlementStockpileModelAssetForPack,
  treeModelAssetForPack,
  groundCoverModelInstanceLimit,
  sparseEnvironmentModelInstanceLimit,
} from './TreeModelLayer'
import {
  canApplyAutoQualityChange,
  capQualityForMobile,
  createGraphicsQualityOverrides,
  effectiveQualityFor,
  GRAPHICS_QUALITY_COMPONENTS,
  qualityForProfileChange,
  qualitySettings,
  renderFrameIntervalMs,
  resolveGraphicsQuality,
  waterSegmentsFor,
} from './quality'
import type { EffectiveQuality, GraphicsQualityComponent, GraphicsQualityOverrides, QualityProfile } from './quality'

const TILE_SCALE = 0.72
const MAX_SETTLERS = 180
const MAX_HOUSES = 48
const MAX_FARMS = 64
const MAX_ROADS = 48
const MAX_LANTERNS = 48
const MAX_WORKSHOPS = 24
const MAX_FORGES = 24
const MAX_TOWN_HALLS = 12
const MAX_RAIN_DROPS = 360
/** Keeps photo mode below a predictable browser/GPU memory budget. */
export const MAX_PHOTO_PIXELS = 8_000_000
/** Extends the ocean beyond the simulation board so its edge never reads as a square playfield. */
const OCEAN_MARGIN_TILES = 160
const NIGHT_SKY = new THREE.Color(0x172842)
const DAY_SKY = new THREE.Color(0x9ccfe5)
const STORM_SKY = new THREE.Color(0x536b7f)
const SKY_ZENITH = new THREE.Color(0x2f78b7)
const SKY_HORIZON = new THREE.Color(0x72bee2)
const SKY_BASE = new THREE.Color(0x89c9e5)
const CLEAR_CLOUD = new THREE.Color(0xf4fbff)
const STORM_CLOUD = new THREE.Color(0x9eb5c4)
type TerrainSurface = 'terrainGrass' | 'terrainForest' | 'terrainRock' | 'terrainSand' | 'terrainSnow'

interface TerrainSurfaceMesh {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
  tileIndices: Int32Array
}

interface TreePlacement {
  id: number
  priority: number
  x: number
  y: number
  z: number
  canopyScaleX: number
  canopyScaleY: number
  canopyScaleZ: number
  trunkHeight: number
  canopyHeight: number
  rotation: number
  variation: number
}

interface RockPlacement {
  id: number
  priority: number
  x: number
  y: number
  z: number
  scaleX: number
  scaleY: number
  scaleZ: number
  rotationX: number
  rotationY: number
  variation: number
}

interface DetailPlacement {
  id: number
  priority: number
  x: number
  y: number
  z: number
  scale: number
  rotation: number
  color: number
}

interface WaterRipple {
  baseX: number
  baseZ: number
  scale: number
  rotation: number
  speed: number
  phase: number
}


/** One pack resource owns PBR maps plus optional instanced environment and settlement models. */
class WorldArtBundle {
  public constructor(
    private readonly materials: PolyHavenArtBundle,
    public readonly treeLayer: InstancedModelLayer | undefined,
    public readonly rockLayer: InstancedModelLayer | undefined,
    public readonly groundCoverLayer: InstancedModelLayer | undefined,
    public readonly coastRockLayer: InstancedModelLayer | undefined,
    public readonly lanternLayer: InstancedModelLayer | undefined,
    public readonly stockpileLayer: InstancedModelLayer | undefined,
    public readonly treeFallback: boolean,
    public readonly rockFallback: boolean,
    public readonly groundCoverFallback: boolean,
    public readonly coastRockFallback: boolean,
    public readonly lanternFallback: boolean,
    public readonly stockpileFallback: boolean,
  ) {}
  public apply(targets: PolyHavenArtTargets): void {
    this.materials.apply(targets)
  }
  public dispose(): void {
    this.treeLayer?.dispose()
    this.rockLayer?.dispose()
    this.groundCoverLayer?.dispose()
    this.coastRockLayer?.dispose()
    this.lanternLayer?.dispose()
    this.stockpileLayer?.dispose()
    this.materials.dispose()
  }
}

function createTerrainMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: false,
    roughness: 0.88,
    metalness: 0.015,
    normalScale: new THREE.Vector2(0.58, 0.58),
  })
}

/** Crossed blades give ground cover a readable silhouette without alpha textures or extra draw calls. */
function createGrassClumpGeometry(): THREE.BufferGeometry {
  const blades = [0, Math.PI / 3, (Math.PI * 2) / 3].map((angle) => {
    const blade = new THREE.PlaneGeometry(0.12, 0.32)
    blade.translate(0, 0.16, 0)
    blade.rotateY(angle)
    return blade
  })
  const merged = mergeGeometries(blades, false)
  for (const blade of blades) blade.dispose()
  if (!merged) throw new Error('Could not build the grass-clump geometry.')
  return merged
}

/** A clustered canopy keeps distant deterministic trees readable without a raw hero-mesh cost. */
function createStylizedCanopyGeometry(): THREE.BufferGeometry {
  const lobes = [
    [-0.17, -0.05, 0.04, 0.23],
    [0.17, -0.01, -0.04, 0.24],
    [0, 0.17, 0.02, 0.26],
    [0, -0.11, -0.15, 0.2],
  ] as const
  const geometries = lobes.map(([x, y, z, radius]) => {
    const geometry = new THREE.DodecahedronGeometry(radius, 0)
    geometry.translate(x, y, z)
    return geometry
  })
  const merged = mergeGeometries(geometries, false)
  for (const geometry of geometries) geometry.dispose()
  if (!merged) throw new Error('Could not build the clustered fallback canopy.')
  return merged
}

/** A compact cluster of pebbles and shell-like stones replaces grass-shaped cones on beaches. */
function createBeachDetailGeometry(): THREE.BufferGeometry {
  const pebbles = [
    new THREE.DodecahedronGeometry(0.13, 0),
    new THREE.DodecahedronGeometry(0.09, 0),
    new THREE.DodecahedronGeometry(0.06, 0),
  ]
  pebbles[0]?.scale(1, 0.2, 0.68)
  pebbles[0]?.translate(-0.075, 0.026, 0.035)
  pebbles[1]?.scale(0.72, 0.16, 0.52)
  pebbles[1]?.translate(0.09, 0.018, -0.055)
  pebbles[2]?.scale(0.55, 0.13, 0.46)
  pebbles[2]?.translate(0.025, 0.014, 0.1)
  const merged = mergeGeometries(pebbles, false)
  for (const pebble of pebbles) pebble.dispose()
  if (!merged) throw new Error('Could not build the beach detail geometry.')
  return merged
}

/** A compact generated normal map supplies readable procedural water motion. */
function createWaterNormalTexture(): THREE.DataTexture {
  const size = 128
  const data = new Uint8Array(size * size * 4)
  let cursor = 0

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size
      const v = y / size
      const slopeX = Math.cos((u * 4.2 + v * 1.7) * Math.PI * 2) * 0.24
        + Math.cos((u * 9.6 - v * 3.4) * Math.PI * 2) * 0.1
        + Math.sin((u * 2.1 + v * 7.8) * Math.PI * 2) * 0.06
      const slopeY = Math.sin((u * 4.2 + v * 1.7) * Math.PI * 2) * 0.24
        - Math.sin((u * 9.6 - v * 3.4) * Math.PI * 2) * 0.1
        + Math.cos((u * 2.1 + v * 7.8) * Math.PI * 2) * 0.06
      const normalLength = Math.hypot(slopeX, 1, slopeY)
      data[cursor] = Math.round(((-slopeX / normalLength) * 0.5 + 0.5) * 255)
      data[cursor + 1] = Math.round(((-slopeY / normalLength) * 0.5 + 0.5) * 255)
      data[cursor + 2] = Math.round((0.5 + 0.5 / normalLength) * 255)
      data[cursor + 3] = 255
      cursor += 4
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.colorSpace = THREE.NoColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1.25, 1.25)
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

/** Thin water-side strips break the hard land/water boundary with a low-cost foam line. */
function createCoastFoamGeometry(): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(TILE_SCALE * 0.94, 0.1)
  geometry.rotateX(-Math.PI / 2)
  return geometry
}

/** A short, curved crest reads as a wave from the isometric camera while remaining instanced in one draw call. */
function createWaterRippleGeometry(): THREE.TorusGeometry {
  const geometry = new THREE.TorusGeometry(0.32, 0.014, 5, 20, Math.PI * 0.72)
  geometry.rotateX(-Math.PI / 2)
  return geometry
}

/** A compact bundle of barrel primitives gives workshops supplies without a model file. */
function createWorkshopStockpileGeometry(): THREE.BufferGeometry {
  const placements = [
    [-0.11, 0.09, -0.035, 0.12],
    [0.11, 0.09, 0.035, -0.16],
    [0, 0.095, 0.1, 0.04],
    [0.01, 0.245, 0, 0.22],
  ] as const
  const barrels = placements.map(([x, y, z, rotation]) => {
    const barrel = new THREE.CylinderGeometry(0.085, 0.085, 0.24, 7)
    barrel.rotateZ(Math.PI / 2)
    barrel.rotateY(rotation)
    barrel.translate(x, y, z)
    return barrel
  })
  const merged = mergeGeometries(barrels, false)
  for (const barrel of barrels) barrel.dispose()
  if (!merged) throw new Error('Could not build the procedural workshop stockpile.')
  return merged
}

function waterPlaneSize(size: number): number {
  return Math.max(2, (size - 1 + OCEAN_MARGIN_TILES * 2) * TILE_SCALE)
}
function waterNormalRepeat(waterSize: number): number {
  return Math.min(5, Math.max(3, waterSize / (TILE_SCALE * 45)))
}

function oceanSegmentsFor(quality: EffectiveQuality, worldSize: number): number {
  const base = waterSegmentsFor(quality, worldSize)
  if (quality === 'ultra') return Math.max(base, 72)
  if (quality === 'high') return Math.max(base, 56)
  if (quality === 'medium') return Math.max(base, 40)
  return Math.max(base, 32)
}

function cloudPuffCount(quality: EffectiveQuality): number {
  if (quality === 'ultra') return 10
  if (quality === 'high') return 8
  if (quality === 'medium') return 6
  return 5
}

/** Use shared height samples so separately batched biome meshes still shade as one smooth landform. */
function terrainNormalAt(world: World, x: number, z: number, target: THREE.Vector3): THREE.Vector3 {
  const size = world.config.size
  const sampleHeight = (sampleX: number, sampleZ: number): number => {
    const clampedX = clamp(sampleX, 0, size - 1)
    const clampedZ = clamp(sampleZ, 0, size - 1)
    return world.tiles[clampedZ * size + clampedX]?.height ?? 0
  }
  const left = Math.max(0, x - 1)
  const right = Math.min(size - 1, x + 1)
  const north = Math.max(0, z - 1)
  const south = Math.min(size - 1, z + 1)
  const xSpan = Math.max(TILE_SCALE, (right - left) * TILE_SCALE)
  const zSpan = Math.max(TILE_SCALE, (south - north) * TILE_SCALE)
  const slopeX = (sampleHeight(right, z) - sampleHeight(left, z)) / xSpan
  const slopeZ = (sampleHeight(x, south) - sampleHeight(x, north)) / zSpan
  return target.set(-slopeX, 1, -slopeZ).normalize()
}

/** A light-weight horizon gradient gives the open world depth without a full-screen texture. */
function createSkyDome(): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
  const geometry = new THREE.SphereGeometry(1, 32, 16)
  const material = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: SKY_ZENITH.clone() },
      horizonColor: { value: SKY_HORIZON.clone() },
      bottomColor: { value: SKY_BASE.clone() },
    },
    vertexShader: `
      varying vec3 worldDirection;
      void main() {
        worldDirection = normalize((modelMatrix * vec4(position, 0.0)).xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 bottomColor;
      varying vec3 worldDirection;
      void main() {
        float height = clamp(worldDirection.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 color = mix(bottomColor, horizonColor, smoothstep(0.08, 0.48, height));
        color = mix(color, topColor, smoothstep(0.42, 1.0, height));
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  })
  return new THREE.Mesh(geometry, material)
}

/** Surface selection is deterministic and keeps biome readability independent from texture resolution. */
export function terrainSurfaceForBiome(biome: Tile['biome']): TerrainSurface | undefined {
  switch (biome) {
    case 'đồng cỏ': return 'terrainGrass'
    case 'rừng': return 'terrainForest'
    case 'đồi':
    case 'núi': return 'terrainRock'
    case 'bờ cát': return 'terrainSand'
    case 'tuyết': return 'terrainSnow'
    case 'biển': return undefined
  }
}

export interface HoveredTile {
  index: number
  tile: Tile
}

export interface RenderStats {
  fps: number
  drawCalls: number
  triangles: number
  textures: number
  assetLoadDurationMs: number
  assetPack: ResolvedAssetPack
  assetPackFallback: boolean
  assetPackReason: string
  assetLoadState: AssetLoadProgress['state']
}
export interface RendererCallbacks {
  onTileHover: (tile: HoveredTile | undefined) => void
  onTileActivate: (tileIndex: number) => void
  onStats: (stats: RenderStats) => void
  onWebGlError: (message: string) => void
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function terrainColor(tile: Tile, mode: HeatmapMode, simulation: SimulationState, world: World): THREE.Color {
  if (mode === 'tài nguyên') {
    return new THREE.Color().setHSL(0.08 + tile.resources * 0.28, 0.72, 0.28 + tile.resources * 0.3)
  }

  if (mode === 'hạnh phúc') {
    const happiness = happinessAtTile(tile, world, simulation)
    return new THREE.Color().setHSL(0.02 + happiness * 0.31, 0.78, 0.28 + happiness * 0.26)
  }

  const palette: Record<Tile['biome'], number> = {
    biển: 0x174e7a,
    'bờ cát': 0xd7bb79,
    'đồng cỏ': tile.soil === 'màu mỡ' ? 0x7ea84a : tile.soil === 'cằn cỗi' ? 0x8b794d : 0x67984a,
    rừng: 0x2e7045,
    đồi: 0x7d8155,
    núi: 0x73777e,
    tuyết: 0xe5edf1,
  }

  const variation = hash2d(seedToUint32(world.config.seed) ^ 0x4f1bbcdc, tile.x, tile.z)
  if (tile.biome === 'biển') {
    const depth = clamp((-tile.height + 0.03) / 0.62, 0, 1)
    return new THREE.Color(0x286f99).lerp(new THREE.Color(0x0c365d), depth).offsetHSL((variation - 0.5) * 0.018, 0, 0)
  }
  if (tile.biome === 'bờ cát') {
    return new THREE.Color(0xe1c47f).lerp(new THREE.Color(0x9d956d), clamp(tile.moisture * 0.22, 0, 0.22)).offsetHSL(0.008, 0, (variation - 0.5) * 0.06)
  }
  return new THREE.Color(palette[tile.biome]).offsetHSL((variation - 0.5) * 0.025, 0, (variation - 0.5) * 0.065)
}

export interface WebGlCanvasLike {
  getContext: (contextId: 'webgl2' | 'webgl') => RenderingContext | null
}

export function isPngDataUrl(value: string): boolean {
  return /^data:image\/png;base64,iVBORw0KGgo/u.test(value)
}

export function hasWebGlSupport(canvas: WebGlCanvasLike): boolean {
  return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
}

export function photoDimensionsFor(drawingWidth: number, drawingHeight: number): { width: number; height: number } {
  const sourceWidth = Math.max(1, Math.min(4096, Math.floor(Number.isFinite(drawingWidth) ? drawingWidth : 1)))
  const sourceHeight = Math.max(1, Math.min(4096, Math.floor(Number.isFinite(drawingHeight) ? drawingHeight : 1)))
  const requestedWidth = Math.max(1, Math.min(4096, Math.floor(sourceWidth * 1.5)))
  const requestedHeight = Math.max(1, Math.min(4096, Math.floor(sourceHeight * 1.5)))
  const requestedPixels = requestedWidth * requestedHeight
  if (requestedPixels <= MAX_PHOTO_PIXELS) return { width: requestedWidth, height: requestedHeight }

  const scale = Math.sqrt(MAX_PHOTO_PIXELS / requestedPixels)
  return {
    width: Math.max(1, Math.floor(requestedWidth * scale)),
    height: Math.max(1, Math.floor(requestedHeight * scale)),
  }
}

function toolColor(tool: ToolId): number {
  const colors: Record<ToolId, number> = {
    raise: 0xffd27a,
    lower: 0xd8a783,
    water: 0x67c8ff,
    forest: 0x78e08f,
    fertile: 0xf5d36b,
    barren: 0xce8d69,
    settler: 0xfff0b0,
    storm: 0xa7b8ff,
  }
  return colors[tool]
}

function isMobileViewport(): boolean {
  return window.matchMedia('(max-width: 768px)').matches
}

export class WorldRenderer {
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(50, 1, 0.1, 120)
  private readonly renderer: THREE.WebGLRenderer
  private readonly controls: OrbitControls
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private readonly resizeObserver: ResizeObserver
  private readonly assetPackManager = new AssetPackManager()
  private readonly terrainMaterials: Record<TerrainSurface, THREE.MeshStandardMaterial> = {
    terrainGrass: createTerrainMaterial(),
    terrainForest: createTerrainMaterial(),
    terrainRock: createTerrainMaterial(),
    terrainSand: createTerrainMaterial(),
    terrainSnow: createTerrainMaterial(),
  }
  private readonly terrainHitMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })
  private readonly waterNormalMap = createWaterNormalTexture()
  private readonly waterMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x1679ad,
    normalMap: this.waterNormalMap,
    normalScale: new THREE.Vector2(0.3, 0.24),
    emissive: 0x06263f,
    emissiveIntensity: 0.1,
    roughness: 0.15,
    metalness: 0.035,
    clearcoat: 0.9,
    clearcoatRoughness: 0.08,
  })
  private readonly treeGeometry = createStylizedCanopyGeometry()
  // Deterministic low-poly trees are generated and instanced directly in the renderer.
  private readonly treeMaterial = new THREE.MeshStandardMaterial({ color: 0x4d7c42, flatShading: true, roughness: 0.9 })
  private readonly trunkGeometry = new THREE.CylinderGeometry(0.045, 0.062, 0.42, 5)
  private readonly trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x62432c, flatShading: true, roughness: 0.94 })
  private readonly rockGeometry = new THREE.DodecahedronGeometry(0.18, 0)
  private readonly rockMaterial = new THREE.MeshStandardMaterial({ color: 0x87909a, flatShading: true, roughness: 0.84, metalness: 0.08 })
  private readonly resourceGeometry = new THREE.ConeGeometry(0.12, 0.45, 5)
  private readonly resourceMaterial = new THREE.MeshStandardMaterial({ color: 0xf4be64, flatShading: true, roughness: 0.47, metalness: 0.36 })
  private readonly groundDetailGeometry = createGrassClumpGeometry()
  private readonly groundDetailMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, side: THREE.DoubleSide })
  private readonly sandDetailGeometry = createBeachDetailGeometry()
  private readonly sandDetailMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.98 })
  private readonly coastFoamGeometry = createCoastFoamGeometry()
  private readonly coastFoamMaterial = new THREE.MeshBasicMaterial({ color: 0xd8f1f8, vertexColors: true, transparent: true, opacity: 0.34, depthWrite: false, blending: THREE.AdditiveBlending })
  private readonly waterRippleGeometry = createWaterRippleGeometry()
  private readonly waterRippleMaterial = new THREE.MeshBasicMaterial({ color: 0xc6ebf7, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
  private readonly houseGeometry = new THREE.BoxGeometry(0.38, 0.32, 0.36)
  private readonly houseMaterial = new THREE.MeshStandardMaterial({ color: 0xb8714e, flatShading: true, roughness: 0.82 })
  private readonly roofGeometry = new THREE.ConeGeometry(0.35, 0.34, 4)
  private readonly roofMaterial = new THREE.MeshStandardMaterial({ color: 0x5e3c34, flatShading: true, roughness: 0.9 })
  private readonly thatchRoofGeometry = new THREE.ConeGeometry(0.38, 0.38, 4)
  private readonly thatchRoofMaterial = new THREE.MeshStandardMaterial({ color: 0x9b7b42, flatShading: true, roughness: 0.98 })
  private readonly farmGeometry = new THREE.BoxGeometry(0.56, 0.026, 0.3)
  private readonly farmMaterial = new THREE.MeshStandardMaterial({ color: 0x9fb652, flatShading: true, roughness: 0.95 })
  private readonly roadGeometry = new THREE.BoxGeometry(0.16, 0.018, 0.78)
  private readonly roadMaterial = new THREE.MeshStandardMaterial({ color: 0x92795c, flatShading: true, roughness: 0.99 })
  private readonly workshopGeometry = new THREE.BoxGeometry(0.52, 0.34, 0.44)
  private readonly workshopMaterial = new THREE.MeshStandardMaterial({ color: 0x7a5138, flatShading: true, roughness: 0.88 })
  private readonly stockpileGeometry = createWorkshopStockpileGeometry()
  private readonly stockpileMaterial = new THREE.MeshStandardMaterial({ color: 0x8a5b32, flatShading: true, roughness: 0.92 })
  private readonly forgeGeometry = new THREE.CylinderGeometry(0.18, 0.23, 0.28, 6)
  private readonly forgeMaterial = new THREE.MeshStandardMaterial({ color: 0x6b6660, flatShading: true, roughness: 0.58, metalness: 0.38 })
  private readonly townHallGeometry = new THREE.BoxGeometry(0.74, 0.56, 0.64)
  private readonly townHallMaterial = new THREE.MeshStandardMaterial({ color: 0x858887, flatShading: true, roughness: 0.9 })
  private readonly lanternGeometry = new THREE.SphereGeometry(0.065, 6, 4)
  private readonly lanternMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc73, emissive: 0x8d4d16, emissiveIntensity: 0.55, flatShading: true, roughness: 0.6 })
  private readonly rainGeometry = new THREE.BufferGeometry()
  private readonly rainMaterial = new THREE.LineBasicMaterial({ color: 0xbdeaff, transparent: true, opacity: 0.84, depthWrite: false, depthTest: false })
  private readonly previewMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.68, side: THREE.DoubleSide })
  private readonly clouds: Array<{ baseX: number; baseZ: number; altitude: number; speed: number; variation: number }> = []
  private readonly waterRipples: WaterRipple[] = []
  private readonly sun = new THREE.DirectionalLight(0xfff0bc, 2.3)
  private readonly skyLight = new THREE.HemisphereLight(0x9bd8ff, 0x4d5539, 1.55)
  private readonly skyDome = createSkyDome()
  private readonly dummy = new THREE.Object3D()
  private readonly skyColor = new THREE.Color()
  private readonly skyHorizonColor = new THREE.Color()
  private polyHavenSkyTexture: THREE.Texture | undefined
  private readonly faunaLayer = new FaunaLayer(TILE_SCALE)
  private readonly settlerLayer = new SettlerLayer(TILE_SCALE, MAX_SETTLERS)
  private readonly animatedFaunaLayer = new AnimatedFaunaLayer(TILE_SCALE)
  private readonly animatedSettlerLayer = new AnimatedSettlerLayer(TILE_SCALE)
  /** Two vertices per drop make weather legible as rain streaks while retaining one draw call. */
  private readonly rainPositions = new Float32Array(MAX_RAIN_DROPS * 6)
  private terrainGroup!: THREE.Group
  private terrainHit!: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
  private terrainSurfaces: Partial<Record<TerrainSurface, TerrainSurfaceMesh>> = {}
  private water!: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshPhysicalMaterial>
  private coastFoam!: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  private waterRippleMesh!: THREE.InstancedMesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>
  private trees!: THREE.InstancedMesh
  private trunks!: THREE.InstancedMesh
  private treeModelLayer: InstancedModelLayer | undefined
  private rockModelLayer: InstancedModelLayer | undefined
  private groundCoverModelLayer: InstancedModelLayer | undefined
  private coastRockModelLayer: InstancedModelLayer | undefined
  private lanternModelLayer: InstancedModelLayer | undefined
  private stockpileModelLayer: InstancedModelLayer | undefined
  private rocks!: THREE.InstancedMesh
  private resources!: THREE.InstancedMesh
  private groundDetails!: THREE.InstancedMesh
  private sandDetails!: THREE.InstancedMesh
  private houses!: THREE.InstancedMesh
  private roofs!: THREE.InstancedMesh
  private thatchRoofs!: THREE.InstancedMesh
  private farms!: THREE.InstancedMesh
  private roads!: THREE.InstancedMesh
  private workshops!: THREE.InstancedMesh
  private stockpiles!: THREE.InstancedMesh
  private forges!: THREE.InstancedMesh
  private townHalls!: THREE.InstancedMesh
  private lanterns!: THREE.InstancedMesh
  private rain!: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>
  private preview!: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
  private cloudGeometry: THREE.IcosahedronGeometry | undefined
  private cloudMaterial: THREE.MeshPhysicalMaterial | undefined
  private cloudMesh: THREE.InstancedMesh<THREE.IcosahedronGeometry, THREE.MeshPhysicalMaterial> | undefined
  private cloudPuffsPerCloud = 0
  private world: World
  private simulation: SimulationState
  private heatmap: HeatmapMode = 'địa hình'
  private tool: ToolId = 'raise'
  private elapsed = 0
  /** Last fully rendered frame, distinct from browser callbacks skipped by the pacing budget. */
  private previousFrame = 0
  private previousBrowserFrame = 0
  private nextRenderAt = 0
  private lastActorMotionAt = Number.NEGATIVE_INFINITY
  private lastEnvironmentMotionAt = Number.NEGATIVE_INFINITY
  private nextShadowUpdateAt = 0
  private statsElapsed = 0
  private framesSinceStats = 0
  private browserStatsElapsed = 0
  private browserFramesSinceStats = 0
  private lastHoverTime = 0
  private lastHoveredIndex: number | undefined
  private pointerDown: { x: number; y: number; pointerId: number } | undefined
  private qualityProfile: QualityProfile = 'auto'
  private effectiveQuality: EffectiveQuality = 'medium'
  private graphicsOverrides: GraphicsQualityOverrides = createGraphicsQualityOverrides()
  private lastQualityChangeAt = 0
  private settlementVisualKey = ''
  private waterWaveFrame = 0
  private waterSegments = 0
  private requestedAssetPack: AssetPackQuality | undefined
  private assetPackEntitlements: AssetPackEntitlements
  private artLoadRevision = 0
  private evolutionArtRevision = 0
  private evolutionArtKey: string | undefined
  private evolutionArtBundle: PolyHavenArtBundle | undefined
  private activeAssetEntries: readonly AssetManifestEntry[] = ASSET_MANIFEST
  private resolvedAssetPack: AssetPackQuality | undefined
  private isDisposed = false
  private hasPolyHavenTerrainArt = false
  private treeModelFallback = false
  private rockModelFallback = false
  private groundCoverModelFallback = false
  private coastRockModelFallback = false
  private lanternModelFallback = false
  private stockpileModelFallback = false
  public constructor(
    private readonly host: HTMLElement,
    world: World,
    simulation: SimulationState,
    private readonly callbacks: RendererCallbacks,
    quality: QualityProfile = 'auto',
    private readonly edition: GameEdition = 'web-demo',
    graphicsOverrides: GraphicsQualityOverrides = createGraphicsQualityOverrides(),
    assetPackEntitlements: AssetPackEntitlements = { desktopGame: edition === 'desktop', cinema8k: false },
  ) {
    if (!WorldRenderer.supportsWebGl()) {
      throw new Error('Trình duyệt này không hỗ trợ WebGL.')
    }

    this.world = world
    this.simulation = simulation
    this.qualityProfile = quality
    this.effectiveQuality = this.capQualityForViewport(quality === 'auto' ? 'low' : quality)
    this.graphicsOverrides = createGraphicsQualityOverrides(graphicsOverrides)
    this.assetPackEntitlements = {
      desktopGame: edition === 'desktop',
      cinema8k: edition === 'desktop' && assetPackEntitlements.cinema8k,
    }
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.02
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.waterNormalMap.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy())
    this.renderer.domElement.className = 'world-canvas'
    this.renderer.domElement.tabIndex = 0
    this.renderer.domElement.setAttribute('aria-label', 'Bản đồ 3D Aetheria. Dùng chuột để xoay, kéo và phóng to; nhấp để áp dụng quyền năng.')
    this.host.appendChild(this.renderer.domElement)

    this.scene.background = new THREE.Color(0x9acde2)
    this.scene.fog = new THREE.Fog(0x9acde2, 28, 68)
    this.camera.position.set(14, 25, 17)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.target.set(0, 0, 0)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.minDistance = 11
    this.controls.maxDistance = 42
    this.controls.minPolarAngle = 0.35
    this.controls.maxPolarAngle = 1.22
    this.controls.panSpeed = 0.72
    this.controls.rotateSpeed = 0.62
    this.controls.zoomSpeed = 0.84

    this.sun.position.set(11, 17, 8)
    this.sun.castShadow = true
    this.sun.shadow.camera.near = 1
    this.sun.shadow.camera.far = 45
    this.sun.shadow.camera.left = -15
    this.sun.shadow.camera.right = 15
    this.sun.shadow.camera.top = 15
    this.sun.shadow.camera.bottom = -15
    this.sun.shadow.normalBias = 0.025
    this.skyDome.scale.setScalar(86)
    this.skyDome.frustumCulled = false
    this.frameWorld(world)
    this.applyQuality()
    this.scene.add(this.skyDome, this.skyLight, this.sun, this.sun.target)

    this.createWorldObjects(world)
    this.setAssetPack('web-1k')
    this.attachInteractions()
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(this.host)
    this.resize()
    this.renderer.setAnimationLoop(this.renderFrame)
  }

  public static supportsWebGl(): boolean {
    const canvas = document.createElement('canvas')
    return hasWebGlSupport(canvas)
  }

  public updateWorld(world: World): void {
    const sizeChanged = world.config.size !== this.world.config.size
    const seedChanged = world.config.seed !== this.world.config.seed
    this.world = world

    if (sizeChanged || seedChanged) {
      this.disposeWorldObjects()
      this.frameWorld(world)
      this.createWorldObjects(world)
      this.controls.target.set(0, 0, 0)
      return
    }

    this.writeTerrain()
    this.updateStaticInstances()
    this.updateSettlementInstances(true)
  }

  public updateSimulation(simulation: SimulationState): void {
    this.simulation = simulation
    this.updateSettlementInstances()
  }

  public setTool(tool: ToolId): void {
    this.tool = tool
    this.previewMaterial.color.setHex(toolColor(tool))
  }

  public setHeatmap(mode: HeatmapMode): void {
    this.heatmap = mode
    this.refreshTerrainMaterialColoring()
    this.writeTerrain()
  }

  public setQuality(profile: QualityProfile): void {
    const previousProfile = this.qualityProfile
    this.qualityProfile = profile
    this.effectiveQuality = this.capQualityForViewport(qualityForProfileChange(profile, previousProfile, this.effectiveQuality))
    // Auto begins at Low; the cooldown only governs later measured promotions or demotions.
    this.lastQualityChangeAt = profile === 'auto' ? 0 : performance.now()
    this.nextRenderAt = 0
    this.nextShadowUpdateAt = 0
    this.refreshQualityDependentScene()
  }

  /** Applies only presentation overrides; world generation and simulation stay deterministic. */
  public setGraphicsOverrides(overrides: GraphicsQualityOverrides): void {
    const next = createGraphicsQualityOverrides(overrides)
    const unchanged = GRAPHICS_QUALITY_COMPONENTS.every((component) => next[component] === this.graphicsOverrides[component])
    if (unchanged) return
    this.graphicsOverrides = next
    this.nextRenderAt = 0
    this.nextShadowUpdateAt = 0
    this.refreshQualityDependentScene()
  }

  /** A server-verified Cinema purchase may change during a desktop session. */
  public setAssetPackEntitlements(entitlements: AssetPackEntitlements): void {
    const next: AssetPackEntitlements = {
      desktopGame: this.edition === 'desktop',
      cinema8k: this.edition === 'desktop' && entitlements.cinema8k,
    }
    if (next.desktopGame === this.assetPackEntitlements.desktopGame && next.cinema8k === this.assetPackEntitlements.cinema8k) return
    this.assetPackEntitlements = next
    const requestedPack = this.requestedAssetPack ?? 'web-1k'
    this.requestedAssetPack = undefined
    this.setAssetPack(requestedPack)
  }

  /** Web stays on 1K; desktop resolves local 2K, 4K, and entitled 8K packs safely. */
  public setAssetPack(requestedPack: AssetPackQuality): void {
    if (this.requestedAssetPack === requestedPack) return
    this.requestedAssetPack = requestedPack
    if (this.edition === 'desktop' && requestedPack !== 'web-1k') {
      const requestedDesktopPacks = requestedPack === 'cinema-8k' && this.assetPackEntitlements.cinema8k
        ? ['cinema-8k', 'desktop-4k', 'desktop-2k'] as const
        : requestedPack === 'cinema-8k'
          ? ['desktop-4k', 'desktop-2k'] as const
          : requestedPack === 'desktop-4k'
            ? ['desktop-4k', 'desktop-2k'] as const
            : ['desktop-2k'] as const
      void Promise.allSettled(requestedDesktopPacks.map((pack) => loadDesktopPackManifest(pack))).then((results) => {
        if (this.isDisposed || this.requestedAssetPack !== requestedPack) return
        const desktopEntries = results.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
        const availableDesktopPacks = requestedDesktopPacks.filter((_, index) => results[index]?.status === 'fulfilled')
        const desktopModels = [
          ...desktopTreeModelEntries(desktopPackRoot()),
          ...desktopRockModelEntries(desktopPackRoot()),
          ...desktopEnvironmentModelEntries(desktopPackRoot()),
          ...desktopSettlementModelEntries(desktopPackRoot()),
        ].filter((entry) => availableDesktopPacks.some((pack) => pack === entry.pack))
        this.applyAssetPack(requestedPack, [...ASSET_MANIFEST, ...desktopEntries, ...desktopModels])
      })
      return
    }
    this.applyAssetPack(requestedPack, ASSET_MANIFEST)
  }

  private applyAssetPack(requestedPack: AssetPackQuality, entries: readonly AssetManifestEntry[]): void {
    const artLoadRevision = ++this.artLoadRevision
    this.activeAssetEntries = entries
    this.resolvedAssetPack = undefined
    this.clearEvolutionArt()
    this.detachTreeModelLayer()
    this.detachRockModelLayer()
    this.detachGroundCoverModelLayer()
    this.detachCoastRockModelLayer()
    this.detachLanternModelLayer()
    this.detachStockpileModelLayer()
    this.hasPolyHavenTerrainArt = false
    this.refreshTerrainMaterialColoring()
    clearPolyHavenArt(this.polyHavenArtTargets)
    const selection = this.assetPackManager.transition({
      edition: this.edition,
      requestedPack,
      capabilities: { maxTextureSize: this.renderer.capabilities.maxTextureSize },
      entitlements: this.assetPackEntitlements,
      availability: {
        'web-1k': assetsForPack(entries, 'web-1k').length > 0,
        'desktop-2k': assetsForPack(entries, 'desktop-2k').length > 0,
        'desktop-4k': assetsForPack(entries, 'desktop-4k').length > 0,
        'cinema-8k': assetsForPack(entries, 'cinema-8k').length > 0,
      },
    })
    const selectedPack = selection.selectedPack
    if (selectedPack === 'procedural') return

    void this.assetPackManager.loadWithFallback<WorldArtBundle>(
      {
        id: `polyhaven-${selectedPack}`,
        load: async () => {
          const canLoadModels = canLoadTreeModel(selection.textureSourceResolution)
          const treeAsset = canLoadModels ? treeModelAssetForPack(entries, selectedPack) : undefined
          const rockAsset = canLoadModels ? rockModelAssetForPack(entries, selectedPack) : undefined
          const groundCoverAsset = canLoadModels ? groundCoverModelAssetForPack(entries, selectedPack) : undefined
          const coastRockAsset = canLoadModels ? coastRockModelAssetForPack(entries, selectedPack) : undefined
          const lanternAsset = canLoadModels ? settlementLanternModelAssetForPack(entries, selectedPack) : undefined
          const stockpileAsset = canLoadModels ? settlementStockpileModelAssetForPack(entries, selectedPack) : undefined
          const [materials, treeResult, rockResult, groundCoverResult, coastRockResult, lanternResult, stockpileResult] = await Promise.all([
            loadPolyHavenArt(this.renderer, this.polyHavenArtTargets, entries, selectedPack),
            treeAsset ? loadInstancedTreeModel(treeAsset).then((layer) => ({ layer, fallback: false })).catch(() => ({ layer: undefined, fallback: true })) : Promise.resolve({ layer: undefined, fallback: true }),
            rockAsset ? loadInstancedRockModel(rockAsset).then((layer) => ({ layer, fallback: false })).catch(() => ({ layer: undefined, fallback: true })) : Promise.resolve({ layer: undefined, fallback: true }),
            groundCoverAsset ? loadInstancedGroundCoverModel(groundCoverAsset).then((layer) => ({ layer, fallback: false })).catch(() => ({ layer: undefined, fallback: true })) : Promise.resolve({ layer: undefined, fallback: true }),
            coastRockAsset ? loadInstancedCoastRockModel(coastRockAsset).then((layer) => ({ layer, fallback: false })).catch(() => ({ layer: undefined, fallback: true })) : Promise.resolve({ layer: undefined, fallback: true }),
            lanternAsset ? loadInstancedSettlementPropModel(lanternAsset).then((layer) => ({ layer, fallback: false })).catch(() => ({ layer: undefined, fallback: true })) : Promise.resolve({ layer: undefined, fallback: true }),
            stockpileAsset ? loadInstancedSettlementPropModel(stockpileAsset).then((layer) => ({ layer, fallback: false })).catch(() => ({ layer: undefined, fallback: true })) : Promise.resolve({ layer: undefined, fallback: true }),
          ])
          return new WorldArtBundle(materials, treeResult.layer, rockResult.layer, groundCoverResult.layer, coastRockResult.layer, lanternResult.layer, stockpileResult.layer, treeResult.fallback, rockResult.fallback, groundCoverResult.fallback, coastRockResult.fallback, lanternResult.fallback, stockpileResult.fallback)
        },
      },
      {
        id: 'procedural-art-fallback',
        load: async () => new WorldArtBundle(createProceduralArtFallback(), undefined, undefined, undefined, undefined, undefined, undefined, true, true, true, true, true, true),
      },
    ).then((result) => {
      if (this.isDisposed || artLoadRevision !== this.artLoadRevision) {
        result.value.dispose()
        return
      }
      result.value.apply(this.polyHavenArtTargets)
      this.resolvedAssetPack = selectedPack
      this.treeModelLayer = result.value.treeLayer
      this.rockModelLayer = result.value.rockLayer
      this.groundCoverModelLayer = result.value.groundCoverLayer
      this.coastRockModelLayer = result.value.coastRockLayer
      this.lanternModelLayer = result.value.lanternLayer
      this.stockpileModelLayer = result.value.stockpileLayer
      this.treeModelFallback = result.usedFallback || result.value.treeFallback
      this.rockModelFallback = result.usedFallback || result.value.rockFallback
      this.groundCoverModelFallback = result.usedFallback || result.value.groundCoverFallback
      this.coastRockModelFallback = result.usedFallback || result.value.coastRockFallback
      this.lanternModelFallback = result.usedFallback || result.value.lanternFallback
      this.stockpileModelFallback = result.usedFallback || result.value.stockpileFallback
      this.treeModelLayer?.attach(this.scene)
      this.rockModelLayer?.attach(this.scene)
      this.groundCoverModelLayer?.attach(this.scene)
      this.coastRockModelLayer?.attach(this.scene)
      this.lanternModelLayer?.attach(this.scene)
      this.stockpileModelLayer?.attach(this.scene)
      this.updateStaticInstances()
      this.updateSettlementInstances(true)
      this.hasPolyHavenTerrainArt = !result.usedFallback
      this.refreshTerrainMaterialColoring()
      this.refreshEvolutionArt()
    }).catch(() => {
      // The asset manager records the failure while procedural art remains playable.
    })
  }
  /** Loads deferred material maps only when the matching era geometry is visible. */
  private refreshEvolutionArt(): void {
    const selectedPack = this.resolvedAssetPack
    if (!selectedPack || this.isDisposed) return
    const highestToolTier = this.simulation.villages.reduce((highest, village) => Math.max(highest, villageToolTier(village.tools)), -1)
    const surfaces = new Set<AssetMaterialSurface>()
    if (highestToolTier >= 1) {
      surfaces.add('thatchRoof')
      surfaces.add('workshopWood')
    }
    if (highestToolTier >= 4) surfaces.add('metalwork')
    if (highestToolTier >= 6) surfaces.add('stonework')
    const entries = assetsForPack(this.activeAssetEntries, selectedPack).filter((entry) => (
      entry.runtime.kind === 'material'
      && entry.runtime.surface !== 'environment'
      && entry.runtimeBudget.preload === false
      && surfaces.has(entry.runtime.surface)
    ))
    const key = `${selectedPack}:${[...surfaces].join(',')}`
    if (key === this.evolutionArtKey) return
    this.evolutionArtKey = key
    const revision = ++this.evolutionArtRevision
    clearPolyHavenArt(this.evolutionArtTargets, { clearEnvironment: false })
    this.evolutionArtBundle?.dispose()
    this.evolutionArtBundle = undefined
    if (entries.length === 0) return
    void loadPolyHavenArt(this.renderer, this.evolutionArtTargets, entries, selectedPack, {
      includeDeferred: true,
      loadEnvironment: false,
    }).then((bundle) => {
      if (this.isDisposed || revision !== this.evolutionArtRevision) {
        bundle.dispose()
        return
      }
      bundle.apply(this.evolutionArtTargets)
      this.evolutionArtBundle = bundle
    }).catch(() => {
      // Optional era maps keep their compact procedural material when unavailable.
    })
  }

  private clearEvolutionArt(): void {
    this.evolutionArtRevision += 1
    this.evolutionArtKey = undefined
    clearPolyHavenArt(this.evolutionArtTargets, { clearEnvironment: false })
    this.evolutionArtBundle?.dispose()
    this.evolutionArtBundle = undefined
  }

  private detachTreeModelLayer(): void {
    this.treeModelLayer?.detach()
    this.treeModelLayer = undefined
    this.treeModelFallback = false
    if (this.trees && this.trunks) this.updateStaticInstances()
  }

  private detachRockModelLayer(): void {
    this.rockModelLayer?.detach()
    this.rockModelLayer = undefined
    this.rockModelFallback = false
    if (this.rocks) this.updateStaticInstances()
  }

  private detachGroundCoverModelLayer(): void {
    this.groundCoverModelLayer?.detach()
    this.groundCoverModelLayer = undefined
    this.groundCoverModelFallback = false
    if (this.groundDetails) this.updateStaticInstances()
  }

  private detachCoastRockModelLayer(): void {
    this.coastRockModelLayer?.detach()
    this.coastRockModelLayer = undefined
    this.coastRockModelFallback = false
    if (this.sandDetails) this.updateStaticInstances()
  }

  private detachLanternModelLayer(): void {
    this.lanternModelLayer?.detach()
    this.lanternModelLayer = undefined
    this.lanternModelFallback = false
    if (this.lanterns) this.updateSettlementInstances(true)
  }

  private detachStockpileModelLayer(): void {
    this.stockpileModelLayer?.detach()
    this.stockpileModelLayer = undefined
    this.stockpileModelFallback = false
    if (this.stockpiles) this.updateSettlementInstances(true)
  }

  private get polyHavenArtTargets(): PolyHavenArtTargets {
    return {
      scene: this.scene,
      setSkyTexture: (texture) => this.setPolyHavenSkyTexture(texture),
      materials: {
        terrainGrass: [this.terrainMaterials.terrainGrass],
        terrainForest: [this.terrainMaterials.terrainForest],
        terrainRock: [this.terrainMaterials.terrainRock, this.rockMaterial],
        terrainSand: [this.terrainMaterials.terrainSand],
        terrainSnow: [this.terrainMaterials.terrainSnow],
        trunk: [this.trunkMaterial],
        house: [this.houseMaterial],
        roof: [this.roofMaterial],
        farm: [this.farmMaterial],
        road: [this.roadMaterial],
      },
    }
  }

  private get evolutionArtTargets(): PolyHavenArtTargets {
    return {
      scene: this.scene,
      materials: {
        thatchRoof: [this.thatchRoofMaterial],
        workshopWood: [this.workshopMaterial],
        metalwork: [this.forgeMaterial],
        stonework: [this.townHallMaterial],
      },
    }
  }

  private setPolyHavenSkyTexture(texture: THREE.Texture | undefined): void {
    this.polyHavenSkyTexture = texture
    this.skyDome.visible = texture === undefined
    if (this.cloudMesh) this.cloudMesh.visible = texture === undefined
    this.scene.background = texture ?? this.skyColor
  }

  /** Terrain maps own the natural palette; heatmaps deliberately restore vertex colors. */
  private refreshTerrainMaterialColoring(): void {
    const useVertexColors = !this.hasPolyHavenTerrainArt || this.heatmap !== 'địa hình'
    for (const material of Object.values(this.terrainMaterials)) {
      if (material.vertexColors === useVertexColors) continue
      material.vertexColors = useVertexColors
      material.needsUpdate = true
    }
  }
  private capQualityForViewport(quality: EffectiveQuality): EffectiveQuality {
    return capQualityForMobile(quality, isMobileViewport())
  }

  private graphicsQuality(component: GraphicsQualityComponent): EffectiveQuality {
    return this.capQualityForViewport(resolveGraphicsQuality(this.graphicsOverrides[component], this.effectiveQuality))
  }

  /** Frames expanded worlds on creation without taking away the player's zoom range. */
  private frameWorld(world: World): void {
    const worldSpan = Math.max(1, (world.config.size - 1) * TILE_SCALE)
    const scale = Math.max(1, worldSpan / (35 * TILE_SCALE))
    this.camera.position.set(14 * scale, 25 * scale, 17 * scale)
    this.controls.minDistance = Math.max(11, 10 * scale)
    this.controls.maxDistance = Math.max(42, 42 * scale)

    const fog = this.scene.fog
    if (fog instanceof THREE.Fog) {
      fog.near = Math.max(28, worldSpan * 1.05)
      fog.far = Math.max(76, worldSpan * 2.4)
    }

    const extent = Math.min(22, Math.max(15, worldSpan * 0.46))
    const shadowCamera = this.sun.shadow.camera as THREE.OrthographicCamera
    shadowCamera.left = -extent
    shadowCamera.right = extent
    shadowCamera.top = extent
    shadowCamera.bottom = -extent
    shadowCamera.updateProjectionMatrix()
  }

  public capturePhoto(): string {
    const drawingBuffer = this.renderer.getDrawingBufferSize(new THREE.Vector2())
    const { width, height } = photoDimensionsFor(drawingBuffer.x, drawingBuffer.y)
    const target = new THREE.WebGLRenderTarget(width, height, { depthBuffer: true })
    target.texture.colorSpace = THREE.SRGBColorSpace
    const pixels = new Uint8Array(width * height * 4)
    const previousTarget = this.renderer.getRenderTarget()

    try {
      this.renderer.setRenderTarget(target)
      this.renderer.clear()
      this.renderer.render(this.scene, this.camera)
      this.renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Không thể tạo bề mặt ảnh PNG.')
      const flipped = new Uint8ClampedArray(pixels.length)
      const rowLength = width * 4
      for (let row = 0; row < height; row += 1) {
        const sourceOffset = row * rowLength
        const targetOffset = (height - row - 1) * rowLength
        flipped.set(pixels.subarray(sourceOffset, sourceOffset + rowLength), targetOffset)
      }
      context.putImageData(new ImageData(flipped, width, height), 0, 0)
      return canvas.toDataURL('image/png')
    } finally {
      this.renderer.setRenderTarget(previousTarget)
      target.dispose()
    }
  }

  public dispose(): void {
    this.isDisposed = true
    this.artLoadRevision += 1
    this.clearEvolutionArt()
    this.renderer.setAnimationLoop(null)
    this.resizeObserver.disconnect()
    this.detachInteractions()
    clearPolyHavenArt(this.polyHavenArtTargets)
    this.detachTreeModelLayer()
    this.detachRockModelLayer()
    this.detachGroundCoverModelLayer()
    this.detachCoastRockModelLayer()
    this.detachLanternModelLayer()
    this.detachStockpileModelLayer()
    this.assetPackManager.dispose()
    this.disposeWorldObjects()
    this.previewMaterial.dispose()
    this.terrainHitMaterial.dispose()
    for (const material of Object.values(this.terrainMaterials)) material.dispose()
    this.waterMaterial.dispose()
    this.waterNormalMap.dispose()
    this.rainGeometry.dispose()
    this.rainMaterial.dispose()
    this.treeGeometry.dispose()
    this.treeMaterial.dispose()
    this.trunkGeometry.dispose()
    this.trunkMaterial.dispose()
    this.rockGeometry.dispose()
    this.rockMaterial.dispose()
    this.resourceGeometry.dispose()
    this.resourceMaterial.dispose()
    this.groundDetailGeometry.dispose()
    this.groundDetailMaterial.dispose()
    this.sandDetailGeometry.dispose()
    this.sandDetailMaterial.dispose()
    this.coastFoamGeometry.dispose()
    this.coastFoamMaterial.dispose()
    this.waterRippleGeometry.dispose()
    this.waterRippleMaterial.dispose()
    this.faunaLayer.dispose()
    this.animatedFaunaLayer.dispose()
    this.houseGeometry.dispose()
    this.houseMaterial.dispose()
    this.roofGeometry.dispose()
    this.roofMaterial.dispose()
    this.thatchRoofGeometry.dispose()
    this.thatchRoofMaterial.dispose()
    this.farmGeometry.dispose()
    this.farmMaterial.dispose()
    this.roadGeometry.dispose()
    this.roadMaterial.dispose()
    this.workshopGeometry.dispose()
    this.stockpileGeometry.dispose()
    this.workshopMaterial.dispose()
    this.stockpileMaterial.dispose()
    this.forgeGeometry.dispose()
    this.forgeMaterial.dispose()
    this.townHallGeometry.dispose()
    this.townHallMaterial.dispose()
    this.lanternGeometry.dispose()
    this.lanternMaterial.dispose()
    this.settlerLayer.dispose()
    this.animatedSettlerLayer.dispose()
    this.skyDome.geometry.dispose()
    this.skyDome.material.dispose()
    this.controls.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.scene.clear()
    this.renderer.domElement.remove()
  }

  private createWorldObjects(world: World): void {
    this.createTerrainSurfaces(world)

    const size = world.config.size
    const capacity = size * size
    const waterSize = waterPlaneSize(size)
    const normalRepeat = waterNormalRepeat(waterSize)
    this.waterNormalMap.repeat.set(normalRepeat, normalRepeat)
    this.waterSegments = oceanSegmentsFor(this.graphicsQuality('water'), size)
    const waterGeometry = new THREE.PlaneGeometry(waterSize, waterSize, this.waterSegments, this.waterSegments)
    waterGeometry.rotateX(-Math.PI / 2)
    this.water = new THREE.Mesh(waterGeometry, this.waterMaterial)
    this.water.position.y = getWaterLevel(world.config) + 0.016
    this.scene.add(this.water)

    this.waterRippleMesh = new THREE.InstancedMesh(this.waterRippleGeometry, this.waterRippleMaterial, capacity)
    this.waterRippleMesh.count = 0
    this.waterRippleMesh.castShadow = false
    this.waterRippleMesh.receiveShadow = false
    this.waterRippleMesh.frustumCulled = false
    this.waterRippleMesh.renderOrder = 1
    this.scene.add(this.waterRippleMesh)

    this.coastFoam = new THREE.InstancedMesh(this.coastFoamGeometry, this.coastFoamMaterial, Math.max(32, capacity * 2))
    this.coastFoam.count = 0
    this.coastFoam.castShadow = false
    this.coastFoam.receiveShadow = false
    this.coastFoam.frustumCulled = false
    this.coastFoam.renderOrder = 1
    this.scene.add(this.coastFoam)

    this.trees = new THREE.InstancedMesh(this.treeGeometry, this.treeMaterial, capacity)
    this.trunks = new THREE.InstancedMesh(this.trunkGeometry, this.trunkMaterial, capacity)
    this.rocks = new THREE.InstancedMesh(this.rockGeometry, this.rockMaterial, capacity)
    this.resources = new THREE.InstancedMesh(this.resourceGeometry, this.resourceMaterial, capacity)
    this.groundDetails = new THREE.InstancedMesh(this.groundDetailGeometry, this.groundDetailMaterial, capacity)
    this.sandDetails = new THREE.InstancedMesh(this.sandDetailGeometry, this.sandDetailMaterial, capacity)
    this.houses = new THREE.InstancedMesh(this.houseGeometry, this.houseMaterial, MAX_HOUSES)
    this.roofs = new THREE.InstancedMesh(this.roofGeometry, this.roofMaterial, MAX_HOUSES)
    this.thatchRoofs = new THREE.InstancedMesh(this.thatchRoofGeometry, this.thatchRoofMaterial, MAX_HOUSES)
    this.farms = new THREE.InstancedMesh(this.farmGeometry, this.farmMaterial, MAX_FARMS)
    this.roads = new THREE.InstancedMesh(this.roadGeometry, this.roadMaterial, MAX_ROADS)
    this.workshops = new THREE.InstancedMesh(this.workshopGeometry, this.workshopMaterial, MAX_WORKSHOPS)
    this.stockpiles = new THREE.InstancedMesh(this.stockpileGeometry, this.stockpileMaterial, MAX_WORKSHOPS)
    this.forges = new THREE.InstancedMesh(this.forgeGeometry, this.forgeMaterial, MAX_FORGES)
    this.townHalls = new THREE.InstancedMesh(this.townHallGeometry, this.townHallMaterial, MAX_TOWN_HALLS)
    this.lanterns = new THREE.InstancedMesh(this.lanternGeometry, this.lanternMaterial, MAX_LANTERNS)

    for (const object of [this.trees, this.trunks, this.rocks, this.resources, this.groundDetails, this.sandDetails, this.houses, this.roofs, this.thatchRoofs, this.farms, this.roads, this.workshops, this.stockpiles, this.forges, this.townHalls, this.lanterns]) {
      object.castShadow = true
      object.receiveShadow = true
      object.frustumCulled = true
      this.scene.add(object)
    }
    this.settlerLayer.attach(this.scene)
    this.animatedSettlerLayer.attach(this.scene)
    this.sandDetails.castShadow = false
    this.faunaLayer.attach(this.scene)
    this.animatedFaunaLayer.attach(this.scene)

    this.rainGeometry.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3))
    this.rain = new THREE.LineSegments(this.rainGeometry, this.rainMaterial)
    this.rain.visible = false
    this.scene.add(this.rain)

    const previewGeometry = new THREE.RingGeometry(0.18, 0.34, 6)
    previewGeometry.rotateX(-Math.PI / 2)
    this.preview = new THREE.Mesh(previewGeometry, this.previewMaterial)
    this.preview.visible = false
    this.previewMaterial.color.setHex(toolColor(this.tool))
    this.scene.add(this.preview)

    this.createClouds()
    this.writeTerrain()
    this.updateStaticInstances()
    this.updateSettlementInstances(true)
  }

  /** Five fixed terrain batches preserve biome-specific PBR art without per-tile draw calls. */
  private createTerrainSurfaces(world: World): void {
    const size = world.config.size
    const hitGeometry = new THREE.BufferGeometry()
    const hitPositions = new Float32Array(size * size * 3)
    const hitIndices: number[] = []

    for (let z = 0; z < size - 1; z += 1) {
      for (let x = 0; x < size - 1; x += 1) {
        const first = z * size + x
        hitIndices.push(first, first + size, first + 1, first + 1, first + size, first + size + 1)
      }
    }

    hitGeometry.setIndex(hitIndices)
    hitGeometry.setAttribute('position', new THREE.BufferAttribute(hitPositions, 3))
    this.terrainGroup = new THREE.Group()
    this.terrainHit = new THREE.Mesh(hitGeometry, this.terrainHitMaterial)
    this.terrainHit.visible = false
    this.terrainGroup.add(this.terrainHit)
    this.scene.add(this.terrainGroup)

    const builders = new Map<TerrainSurface, { positions: number[]; normals: number[]; colors: number[]; uvs: number[]; indices: number[]; tileIndices: number[] }>()
    const builderFor = (surface: TerrainSurface): { positions: number[]; normals: number[]; colors: number[]; uvs: number[]; indices: number[]; tileIndices: number[] } => {
      const existing = builders.get(surface)
      if (existing) return existing
      const created = { positions: [], normals: [], colors: [], uvs: [], indices: [], tileIndices: [] }
      builders.set(surface, created)
      return created
    }
    const uvDenominator = Math.max(1, size - 1)
    const normal = new THREE.Vector3()

    for (let z = 0; z < size - 1; z += 1) {
      for (let x = 0; x < size - 1; x += 1) {
        const first = z * size + x
        const surface = terrainSurfaceForBiome(world.tiles[first]?.biome ?? 'biển')
        if (!surface) continue
        const builder = builderFor(surface)
        const corners = [first, first + size, first + 1, first + size + 1]
        const base = builder.tileIndices.length
        for (const tileIndex of corners) {
          const tile = world.tiles[tileIndex]
          if (!tile) continue
          const position = this.tilePosition(tile)
          const color = terrainColor(tile, this.heatmap, this.simulation, world)
          terrainNormalAt(world, tile.x, tile.z, normal)
          builder.positions.push(position.x, position.y, position.z)
          builder.normals.push(normal.x, normal.y, normal.z)
          builder.colors.push(color.r, color.g, color.b)
          builder.uvs.push(tile.x / uvDenominator, tile.z / uvDenominator)
          builder.tileIndices.push(tileIndex)
        }
        builder.indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3)
      }
    }

    this.terrainSurfaces = {}
    for (const [surface, builder] of builders) {
      const geometry = new THREE.BufferGeometry()
      geometry.setIndex(builder.indices)
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(builder.positions), 3))
      geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(builder.normals), 3))
      geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(builder.colors), 3))
      geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(builder.uvs), 2))
      const mesh = new THREE.Mesh(geometry, this.terrainMaterials[surface])
      mesh.receiveShadow = true
      this.terrainGroup.add(mesh)
      this.terrainSurfaces[surface] = { mesh, tileIndices: new Int32Array(builder.tileIndices) }
    }
  }

  private disposeWorldObjects(): void {
    if (this.terrainGroup) {
      this.scene.remove(this.terrainGroup)
      this.terrainHit?.geometry.dispose()
      for (const terrainSurface of Object.values(this.terrainSurfaces)) terrainSurface?.mesh.geometry.dispose()
      this.terrainSurfaces = {}
    }
    if (this.water) {
      this.scene.remove(this.water)
      this.water.geometry.dispose()
      this.waterSegments = 0
    }
    if (this.waterRippleMesh) this.scene.remove(this.waterRippleMesh)
    this.waterRipples.length = 0
    if (this.coastFoam) this.scene.remove(this.coastFoam)
    for (const object of [this.trees, this.trunks, this.rocks, this.resources, this.groundDetails, this.sandDetails, this.houses, this.roofs, this.thatchRoofs, this.farms, this.roads, this.workshops, this.stockpiles, this.forges, this.townHalls, this.lanterns]) {
      if (object) this.scene.remove(object)
    }
    this.faunaLayer.detach()
    this.animatedFaunaLayer.detach()
    this.settlerLayer.detach()
    this.animatedSettlerLayer.detach()
    if (this.rain) this.scene.remove(this.rain)
    if (this.preview) {
      this.scene.remove(this.preview)
      this.preview.geometry.dispose()
    }
    this.disposeClouds()
  }

  private writeTerrain(): void {
    const hitPositions = this.terrainHit.geometry.getAttribute('position') as THREE.BufferAttribute
    const half = (this.world.config.size - 1) / 2
    for (const tile of this.world.tiles) hitPositions.setXYZ(tile.index, (tile.x - half) * TILE_SCALE, tile.height, (tile.z - half) * TILE_SCALE)
    hitPositions.needsUpdate = true
    this.terrainHit.geometry.computeVertexNormals()
    this.terrainHit.geometry.computeBoundingSphere()

    for (const terrainSurface of Object.values(this.terrainSurfaces)) {
      if (!terrainSurface) continue
      const geometry = terrainSurface.mesh.geometry
      const positions = geometry.getAttribute('position') as THREE.BufferAttribute
      const normals = geometry.getAttribute('normal') as THREE.BufferAttribute
      const colors = geometry.getAttribute('color') as THREE.BufferAttribute
      const normal = new THREE.Vector3()
      for (let index = 0; index < terrainSurface.tileIndices.length; index += 1) {
        const tile = this.world.tiles[terrainSurface.tileIndices[index] ?? 0]
        if (!tile) continue
        const color = terrainColor(tile, this.heatmap, this.simulation, this.world)
        terrainNormalAt(this.world, tile.x, tile.z, normal)
        positions.setXYZ(index, (tile.x - half) * TILE_SCALE, tile.height, (tile.z - half) * TILE_SCALE)
        normals.setXYZ(index, normal.x, normal.y, normal.z)
        colors.setXYZ(index, color.r, color.g, color.b)
      }
      positions.needsUpdate = true
      normals.needsUpdate = true
      colors.needsUpdate = true
      geometry.computeBoundingSphere()
    }
    this.water.position.y = getWaterLevel(this.world.config) + 0.016
    this.updateCoastFoam()
    this.rebuildWaterRipples()
  }

  /** Picks a deterministic, quality-bounded set of open-water crest markers. */
  private rebuildWaterRipples(): void {
    if (!this.waterRippleMesh) return
    const waterQuality = this.graphicsQuality('water')
    const rippleLimit = waterQuality === 'low' ? 24 : waterQuality === 'medium' ? 52 : waterQuality === 'high' ? 84 : 116
    const seed = seedToUint32(`${this.world.config.seed}-water-ripples`)
    const candidates = this.world.tiles
      .filter((tile) => terrainSurfaceForBiome(tile.biome) === undefined)
      .map((tile) => ({ tile, priority: hash2d(seed, tile.x, tile.z) }))
      .sort((left, right) => left.priority - right.priority)

    this.waterRipples.length = 0
    for (const candidate of candidates.slice(0, rippleLimit)) {
      const position = this.tilePosition(candidate.tile)
      const variation = hash2d(seed ^ 0x4c7e19, candidate.tile.z, candidate.tile.x)
      this.waterRipples.push({
        baseX: position.x,
        baseZ: position.z,
        scale: 0.72 + variation * 1.18,
        rotation: variation * Math.PI * 2,
        speed: 0.34 + hash2d(seed ^ 0x1b91c3, candidate.tile.x, candidate.tile.z) * 0.48,
        phase: hash2d(seed ^ 0x7af312, candidate.tile.z, candidate.tile.x) * Math.PI * 2,
      })
    }
    this.waterRippleMesh.count = this.waterRipples.length
    this.updateWaterRipples(false)
    this.waterRippleMesh.computeBoundingSphere()
  }

  /** One instanced layer supplies small moving crests without adding simulation state or physics. */
  private updateWaterRipples(animate = true): void {
    if (!this.waterRippleMesh) return
    const waterLevel = getWaterLevel(this.world.config) + 0.07
    for (let index = 0; index < this.waterRipples.length; index += 1) {
      const ripple = this.waterRipples[index]
      if (!ripple) continue
      const drift = animate ? Math.sin(this.elapsed * ripple.speed + ripple.phase) * 0.14 : 0
      this.dummy.position.set(
        ripple.baseX + Math.cos(ripple.rotation) * drift,
        waterLevel,
        ripple.baseZ + Math.sin(ripple.rotation) * drift,
      )
      this.dummy.rotation.set(0, ripple.rotation + (animate ? Math.sin(this.elapsed * ripple.speed * 0.7 + ripple.phase) * 0.12 : 0), 0)
      const aspect = 0.7 + (ripple.phase / (Math.PI * 2)) * 0.34
      this.dummy.scale.set(ripple.scale * (1.05 + aspect * 0.18), 1, ripple.scale * aspect)
      this.dummy.updateMatrix()
      this.waterRippleMesh.setMatrixAt(index, this.dummy.matrix)
    }
    this.waterRippleMesh.instanceMatrix.needsUpdate = true
  }

  /** Places a single instanced foam strip at every deterministic land-to-water edge. */
  private updateCoastFoam(): void {
    if (!this.coastFoam) return
    const size = this.world.config.size
    const waterLevel = getWaterLevel(this.world.config)
    const seed = seedToUint32(`${this.world.config.seed}-foam`)
    const isWater = (x: number, z: number): boolean => {
      if (x < 0 || z < 0 || x >= size || z >= size) return false
      return this.world.tiles[z * size + x]?.biome === 'biển'
    }
    const directions = [
      [0, -1, 0],
      [1, 0, Math.PI / 2],
      [0, 1, 0],
      [-1, 0, Math.PI / 2],
    ] as const
    let count = 0

    for (const tile of this.world.tiles) {
      if (tile.biome === 'biển' || count >= this.coastFoam.instanceMatrix.count) continue
      const position = this.tilePosition(tile)
      for (const [directionX, directionZ, rotationY] of directions) {
        if (!isWater(tile.x + directionX, tile.z + directionZ) || count >= this.coastFoam.instanceMatrix.count) continue
        const variation = hash2d(seed, tile.x * 7 + directionX, tile.z * 11 + directionZ)
        this.dummy.position.set(
          position.x + directionX * TILE_SCALE * 0.47,
          waterLevel + 0.03,
          position.z + directionZ * TILE_SCALE * 0.47,
        )
        this.dummy.rotation.set(0, rotationY, 0)
        this.dummy.scale.set(0.64 + variation * 0.38, 1, 0.72 + (1 - variation) * 0.32)
        this.dummy.updateMatrix()
        this.coastFoam.setMatrixAt(count, this.dummy.matrix)
        this.coastFoam.setColorAt(count, new THREE.Color(variation > 0.5 ? 0xe8f8ff : 0xb9e3f5))
        count += 1
      }
    }

    this.coastFoam.count = count
    this.coastFoam.instanceMatrix.needsUpdate = true
    if (this.coastFoam.instanceColor) this.coastFoam.instanceColor.needsUpdate = true
    this.coastFoam.computeBoundingSphere()
  }

  private updateStaticInstances(): void {
    const seed = seedToUint32(this.world.config.seed)
    const natureQuality = this.graphicsQuality('nature')
    const settings = qualitySettings(natureQuality)
    const treeCandidates: TreePlacement[] = []
    const rockCandidates: RockPlacement[] = []
    const groundDetailCandidates: DetailPlacement[] = []
    const sandDetailCandidates: DetailPlacement[] = []
    let resourceCount = 0
    const sandDetailLimit = natureQuality === 'low' ? 0 : natureQuality === 'medium' ? 72 : natureQuality === 'high' ? 150 : 240

    for (const tile of this.world.tiles) {
      const { x, y, z } = this.tilePosition(tile)
      const variation = hash2d(seed, tile.x, tile.z)

      if (tile.forest && hash2d(seed ^ 0x15ac3d, tile.x, tile.z) < settings.vegetationDensity) {
        const treeScaleX = 0.66 + variation * 0.42
        const treeScaleY = 0.72 + hash2d(seed ^ 0x2d3d4f, tile.x, tile.z) * 0.8
        const treeScaleZ = 0.66 + hash2d(seed ^ 0x7a1e3b, tile.z, tile.x) * 0.42
        const treeHeight = 0.92 * treeScaleY
        const trunkHeight = 0.28 + treeScaleY * 0.18
        const rotation = variation * Math.PI * 2
        treeCandidates.push({
          id: treeCandidates.length,
          priority: x * x + z * z + hash2d(seed ^ 0x4c2fe3, tile.x, tile.z) * 0.2,
          x,
          y,
          z,
          canopyScaleX: treeScaleX,
          canopyScaleY: treeScaleY,
          canopyScaleZ: treeScaleZ,
          trunkHeight,
          canopyHeight: treeHeight,
          rotation,
          variation,
        })
      }

      if ((tile.biome === 'đồi' || tile.biome === 'núi' || tile.biome === 'tuyết') && variation > 0.47 && hash2d(seed ^ 0x91f07c, tile.z, tile.x) < settings.rockDensity && rockCandidates.length < this.rocks.instanceMatrix.count) {
        rockCandidates.push({
          id: rockCandidates.length,
          priority: x * x + z * z + hash2d(seed ^ 0x91f07c, tile.z, tile.x) * 0.2,
          x,
          y,
          z,
          scaleX: 0.64 + variation * 0.72,
          scaleY: 0.6 + hash2d(seed ^ 0x66dd11, tile.z, tile.x) * 0.78,
          scaleZ: 0.64 + hash2d(seed ^ 0x9016a4, tile.x, tile.z) * 0.72,
          rotationX: variation,
          rotationY: variation * 4,
          variation,
        })
      }

      if (tile.resources > 0.73 && tile.biome !== 'biển' && hash2d(seed ^ 0x6e2a59, tile.x, tile.z) < settings.resourceDensity && resourceCount < this.resources.instanceMatrix.count) {
        this.dummy.position.set(x + 0.16, y + 0.2, z - 0.1)
        this.dummy.rotation.set(0, variation * 2, 0)
        this.dummy.scale.setScalar(0.66 + tile.resources * 0.46)
        this.dummy.updateMatrix()
        this.resources.setMatrixAt(resourceCount, this.dummy.matrix)
        resourceCount += 1
      }

      const supportsVegetationDetail = tile.biome === 'đồng cỏ' || tile.biome === 'rừng' || tile.biome === 'tuyết'
      if (supportsVegetationDetail && settings.groundDetailDensity > 0 && hash2d(seed ^ 0x1c53d7, tile.z, tile.x) < settings.groundDetailDensity && variation > 0.32 && groundDetailCandidates.length < this.groundDetails.instanceMatrix.count) {
        const offsetX = (hash2d(seed ^ 0x37d8af, tile.z, tile.x) - 0.5) * 0.34
        const offsetZ = (hash2d(seed ^ 0xae21d9, tile.x, tile.z) - 0.5) * 0.34
        const detailScale = tile.biome === 'rừng' ? 1.28 : tile.biome === 'đồng cỏ' ? 0.72 + tile.moisture * 0.56 : 0.5 + variation * 0.36
        const detailColor = tile.biome === 'rừng'
          ? 0x3d7b46
          : tile.biome === 'đồng cỏ'
            ? variation > 0.82 ? 0xe8c86c : 0x88ae54
            : tile.biome === 'bờ cát'
              ? 0xd9c483
              : 0xeaf5fa
        groundDetailCandidates.push({
          id: groundDetailCandidates.length,
          priority: x * x + z * z + hash2d(seed ^ 0x1c53d7, tile.x, tile.z) * 0.2,
          x: x + offsetX,
          y,
          z: z + offsetZ,
          scale: detailScale * (0.75 + tile.moisture * 0.35),
          rotation: variation * Math.PI * 2,
          color: detailColor,
        })
      }

      if (tile.biome === 'bờ cát' && settings.groundDetailDensity > 0 && hash2d(seed ^ 0xbe17a9, tile.x, tile.z) < Math.min(0.62, settings.groundDetailDensity * 0.5) && sandDetailCandidates.length < sandDetailLimit) {
        const offsetX = (hash2d(seed ^ 0x5ca93e, tile.z, tile.x) - 0.5) * 0.46
        const offsetZ = (hash2d(seed ^ 0xe11c72, tile.x, tile.z) - 0.5) * 0.46
        const sandScale = 0.7 + variation * 0.7
        sandDetailCandidates.push({
          id: sandDetailCandidates.length,
          priority: x * x + z * z + hash2d(seed ^ 0xbe17a9, tile.z, tile.x) * 0.2,
          x: x + offsetX,
          y,
          z: z + offsetZ,
          scale: sandScale * (0.76 + tile.moisture * 0.22),
          rotation: variation * Math.PI * 2,
          color: variation > 0.72 ? 0xb8aa84 : variation > 0.38 ? 0xd7bd7c : 0x8f8872,
        })
      }
    }

    const modeledTreeIds = new Set<number>()
    const modelMatrices: THREE.Matrix4[] = []
    if (this.treeModelLayer) {
      const modelLimit = sparseEnvironmentModelInstanceLimit(natureQuality, this.treeModelLayer.maximumInstances)
      const qualityMinimumSpacing = natureQuality === 'low' ? 1.55 : natureQuality === 'medium' ? 1.35 : 1.15
      const minimumModelSpacing = Math.max(qualityMinimumSpacing, this.treeModelLayer.minimumSpacing)
      const minimumModelSpacingSquared = minimumModelSpacing * minimumModelSpacing
      const modelCandidates: TreePlacement[] = []
      for (const candidate of [...treeCandidates].sort((left, right) => left.priority - right.priority || left.id - right.id)) {
        if (modelCandidates.length >= modelLimit) break
        const overlapsSelectedTree = modelCandidates.some((selected) => {
          const dx = candidate.x - selected.x
          const dz = candidate.z - selected.z
          return dx * dx + dz * dz < minimumModelSpacingSquared
        })
        if (!overlapsSelectedTree) modelCandidates.push(candidate)
      }
      for (const tree of modelCandidates) {
        const modelScale = this.treeModelLayer.worldScale * (0.84 + tree.canopyScaleY * 0.16)
        this.dummy.position.set(tree.x, tree.y + 0.006, tree.z)
        this.dummy.rotation.set(0, tree.rotation, 0)
        this.dummy.scale.setScalar(modelScale)
        this.dummy.updateMatrix()
        modelMatrices.push(this.dummy.matrix.clone())
        modeledTreeIds.add(tree.id)
      }
      this.treeModelLayer.setMatrices(modelMatrices, modelLimit)
    }

    const modeledRockIds = new Set<number>()
    const rockModelMatrices: THREE.Matrix4[] = []
    if (this.rockModelLayer) {
      const modelLimit = sparseEnvironmentModelInstanceLimit(natureQuality, this.rockModelLayer.maximumInstances)
      const minimumModelSpacing = Math.max(0.45, this.rockModelLayer.minimumSpacing)
      const minimumModelSpacingSquared = minimumModelSpacing * minimumModelSpacing
      const modelCandidates: RockPlacement[] = []
      for (const candidate of [...rockCandidates].sort((left, right) => left.priority - right.priority || left.id - right.id)) {
        if (modelCandidates.length >= modelLimit) break
        const overlapsSelectedRock = modelCandidates.some((selected) => {
          const dx = candidate.x - selected.x
          const dz = candidate.z - selected.z
          return dx * dx + dz * dz < minimumModelSpacingSquared
        })
        if (!overlapsSelectedRock) modelCandidates.push(candidate)
      }
      for (const rock of modelCandidates) {
        const modelScale = this.rockModelLayer.worldScale * (0.82 + rock.variation * 0.3)
        this.dummy.position.set(rock.x, rock.y + 0.008, rock.z)
        this.dummy.rotation.set(0, rock.rotationY, 0)
        this.dummy.scale.setScalar(modelScale)
        this.dummy.updateMatrix()
        rockModelMatrices.push(this.dummy.matrix.clone())
        modeledRockIds.add(rock.id)
      }
      this.rockModelLayer.setMatrices(rockModelMatrices, modelLimit)
    }

    const modeledGroundDetailIds = new Set<number>()
    if (this.groundCoverModelLayer) {
      const modelLimit = groundCoverModelInstanceLimit(natureQuality, this.groundCoverModelLayer.maximumInstances)
      const minimumSpacingSquared = this.groundCoverModelLayer.minimumSpacing * this.groundCoverModelLayer.minimumSpacing
      const modelCandidates: DetailPlacement[] = []
      for (const candidate of [...groundDetailCandidates].sort((left, right) => left.priority - right.priority || left.id - right.id)) {
        if (candidate.color !== 0x3d7b46 || modelCandidates.length >= modelLimit) continue
        const overlaps = modelCandidates.some((selected) => {
          const dx = candidate.x - selected.x
          const dz = candidate.z - selected.z
          return dx * dx + dz * dz < minimumSpacingSquared
        })
        if (!overlaps) modelCandidates.push(candidate)
      }
      const matrices: THREE.Matrix4[] = []
      for (const detail of modelCandidates) {
        this.dummy.position.set(detail.x, detail.y + 0.012, detail.z)
        this.dummy.rotation.set(0, detail.rotation, 0)
        this.dummy.scale.setScalar(this.groundCoverModelLayer.worldScale * detail.scale)
        this.dummy.updateMatrix()
        matrices.push(this.dummy.matrix.clone())
        modeledGroundDetailIds.add(detail.id)
      }
      this.groundCoverModelLayer.setMatrices(matrices, modelLimit)
    }

    const modeledSandDetailIds = new Set<number>()
    if (this.coastRockModelLayer) {
      const modelLimit = sparseEnvironmentModelInstanceLimit(natureQuality, this.coastRockModelLayer.maximumInstances)
      const minimumSpacingSquared = this.coastRockModelLayer.minimumSpacing * this.coastRockModelLayer.minimumSpacing
      const modelCandidates: DetailPlacement[] = []
      for (const candidate of [...sandDetailCandidates].sort((left, right) => left.priority - right.priority || left.id - right.id)) {
        if (modelCandidates.length >= modelLimit) break
        const overlaps = modelCandidates.some((selected) => {
          const dx = candidate.x - selected.x
          const dz = candidate.z - selected.z
          return dx * dx + dz * dz < minimumSpacingSquared
        })
        if (!overlaps) modelCandidates.push(candidate)
      }
      const matrices: THREE.Matrix4[] = []
      for (const detail of modelCandidates) {
        this.dummy.position.set(detail.x, detail.y + 0.064, detail.z)
        this.dummy.rotation.set(0, detail.rotation, 0)
        this.dummy.scale.setScalar(this.coastRockModelLayer.worldScale * detail.scale)
        this.dummy.updateMatrix()
        matrices.push(this.dummy.matrix.clone())
        modeledSandDetailIds.add(detail.id)
      }
      this.coastRockModelLayer.setMatrices(matrices, modelLimit)
    }
    let rockCount = 0
    for (const rock of rockCandidates) {
      if (modeledRockIds.has(rock.id) || rockCount >= this.rocks.instanceMatrix.count) continue
      this.dummy.position.set(rock.x, rock.y + 0.08, rock.z)
      this.dummy.rotation.set(rock.rotationX, rock.rotationY, 0)
      this.dummy.scale.set(rock.scaleX, rock.scaleY, rock.scaleZ)
      this.dummy.updateMatrix()
      this.rocks.setMatrixAt(rockCount, this.dummy.matrix)
      rockCount += 1
    }

    let treeCount = 0
    for (const tree of treeCandidates) {
      if (modeledTreeIds.has(tree.id) || treeCount >= this.trees.instanceMatrix.count) continue
      this.dummy.position.set(tree.x, tree.y + tree.trunkHeight / 2, tree.z)
      this.dummy.rotation.set(0, tree.rotation, 0)
      this.dummy.scale.set(tree.canopyScaleX * 0.42, tree.trunkHeight / 0.42, tree.canopyScaleZ * 0.42)
      this.dummy.updateMatrix()
      this.trunks.setMatrixAt(treeCount, this.dummy.matrix)

      const fallbackCanopyHeight = 0.72 * tree.canopyScaleY * 0.95
      this.dummy.position.set(tree.x, tree.y + tree.trunkHeight * 0.78 + fallbackCanopyHeight / 2, tree.z)
      this.dummy.rotation.set(0, tree.rotation, 0)
      this.dummy.scale.set(tree.canopyScaleX * 1.25, tree.canopyScaleY * 0.95, tree.canopyScaleZ * 1.25)
      this.dummy.updateMatrix()
      this.trees.setMatrixAt(treeCount, this.dummy.matrix)
      this.trees.setColorAt(treeCount, new THREE.Color(0x2d683d).lerp(new THREE.Color(0x66934b), tree.variation))
      treeCount += 1
    }

    let detailCount = 0
    for (const detail of groundDetailCandidates) {
      if (modeledGroundDetailIds.has(detail.id) || detailCount >= this.groundDetails.instanceMatrix.count) continue
      this.dummy.position.set(detail.x, detail.y + 0.11, detail.z)
      this.dummy.rotation.set(0, detail.rotation, 0)
      this.dummy.scale.setScalar(detail.scale)
      this.dummy.updateMatrix()
      this.groundDetails.setMatrixAt(detailCount, this.dummy.matrix)
      this.groundDetails.setColorAt(detailCount, new THREE.Color(detail.color))
      detailCount += 1
    }

    let sandDetailCount = 0
    for (const detail of sandDetailCandidates) {
      if (modeledSandDetailIds.has(detail.id) || sandDetailCount >= this.sandDetails.instanceMatrix.count) continue
      this.dummy.position.set(detail.x, detail.y + 0.028, detail.z)
      this.dummy.rotation.set(0, detail.rotation, 0)
      this.dummy.scale.setScalar(detail.scale)
      this.dummy.updateMatrix()
      this.sandDetails.setMatrixAt(sandDetailCount, this.dummy.matrix)
      this.sandDetails.setColorAt(sandDetailCount, new THREE.Color(detail.color))
      sandDetailCount += 1
    }

    this.trees.count = treeCount
    this.trunks.count = treeCount
    this.rocks.count = rockCount
    this.resources.count = resourceCount
    this.groundDetails.count = detailCount
    this.sandDetails.count = sandDetailCount
    this.trees.instanceMatrix.needsUpdate = true
    this.trunks.instanceMatrix.needsUpdate = true
    this.rocks.instanceMatrix.needsUpdate = true
    this.resources.instanceMatrix.needsUpdate = true
    this.groundDetails.instanceMatrix.needsUpdate = true
    this.sandDetails.instanceMatrix.needsUpdate = true
    if (this.trees.instanceColor) this.trees.instanceColor.needsUpdate = true
    if (this.groundDetails.instanceColor) this.groundDetails.instanceColor.needsUpdate = true
    if (this.sandDetails.instanceColor) this.sandDetails.instanceColor.needsUpdate = true
    this.trees.computeBoundingSphere()
    this.trunks.computeBoundingSphere()
    this.rocks.computeBoundingSphere()
    this.resources.computeBoundingSphere()
    this.groundDetails.computeBoundingSphere()
    this.sandDetails.computeBoundingSphere()
    this.faunaLayer.setWorld(this.world, natureQuality)
    this.animatedFaunaLayer.setWorld(this.world, natureQuality)
  }

  private settlementVisualStateKey(natureQuality: EffectiveQuality): string {
    return [
      this.world.config.seed,
      this.world.config.size,
      natureQuality,
      ...this.simulation.villages.map((village) => [
        village.id,
        village.tileIndex,
        village.population,
        village.homes,
        village.tools.join(','),
      ].join(':')),
    ].join('|')
  }

  private updateSettlementInstances(force = false): void {
    const natureQuality = this.graphicsQuality('nature')
    const visualStateKey = this.settlementVisualStateKey(natureQuality)
    if (!force && visualStateKey === this.settlementVisualKey) return
    this.settlementVisualKey = visualStateKey

    let houseCount = 0
    let roofCount = 0
    let thatchRoofCount = 0
    let farmCount = 0
    let roadCount = 0
    let workshopCount = 0
    let stockpileCount = 0
    let forgeCount = 0
    let townHallCount = 0
    let lanternCount = 0
    const settlerPlacements: SettlerPlacement[] = []
    const seed = seedToUint32(this.world.config.seed)
    const settings = qualitySettings(natureQuality)
    const stockpileModelLimit = this.stockpileModelLayer ? settlementPropModelInstanceLimit(natureQuality, this.stockpileModelLayer.maximumInstances) : 0
    const lanternModelLimit = this.lanternModelLayer ? settlementPropModelInstanceLimit(natureQuality, this.lanternModelLayer.maximumInstances) : 0
    const stockpileModelMatrices: THREE.Matrix4[] = []
    const lanternModelMatrices: THREE.Matrix4[] = []
    for (const village of this.simulation.villages) {
      const home = this.world.tiles[village.tileIndex]
      if (!home) continue
      const base = this.tilePosition(home)
      const localSeed = seed ^ seedToUint32(village.id)
      const toolTier = villageToolTier(village.tools)
      const hasFarming = toolTier >= 2
      const hasMetalwork = toolTier >= 4
      const hasTownHall = toolTier >= 6

      const visibleHomes = Math.ceil(village.homes * settings.settlementDensity)
      for (let index = 0; index < visibleHomes && houseCount < MAX_HOUSES; index += 1) {
        const angle = hash2d(localSeed, index, 1) * Math.PI * 2
        const radius = 0.38 + (index % 3) * 0.19
        const x = base.x + Math.cos(angle) * radius
        const z = base.z + Math.sin(angle) * radius
        const height = base.y + 0.17

        this.dummy.position.set(x, height, z)
        this.dummy.rotation.set(0, angle + Math.PI / 4, 0)
        const houseVariation = hash2d(localSeed, index, 7)
        this.dummy.scale.set(0.72 + houseVariation * 0.24, 0.8 + houseVariation * 0.34, 0.74 + (1 - houseVariation) * 0.22)
        this.dummy.updateMatrix()
        this.houses.setMatrixAt(houseCount, this.dummy.matrix)

        this.dummy.position.set(x, height + 0.33, z)
        this.dummy.rotation.set(0, angle + Math.PI / 4, 0)
        this.dummy.scale.set(0.78 + houseVariation * 0.25, 0.82 + houseVariation * 0.3, 0.8 + (1 - houseVariation) * 0.23)
        this.dummy.updateMatrix()
        if (hasMetalwork) {
          this.roofs.setMatrixAt(roofCount, this.dummy.matrix)
          roofCount += 1
        } else {
          this.thatchRoofs.setMatrixAt(thatchRoofCount, this.dummy.matrix)
          thatchRoofCount += 1
        }
        houseCount += 1
      }

      if (hasFarming) {
        const farmSlots = Math.min(8, Math.max(1, Math.floor((village.population + 5) / 8)))
        const visibleFarmSlots = Math.ceil(farmSlots * settings.settlementDensity)
        for (let index = 0; index < visibleFarmSlots && farmCount < MAX_FARMS; index += 1) {
          const angle = hash2d(localSeed, index, 41) * Math.PI * 2
          const radius = 0.92 + (index % 3) * 0.28
          this.dummy.position.set(base.x + Math.cos(angle) * radius, base.y + 0.025, base.z + Math.sin(angle) * radius)
          this.dummy.rotation.set(0, angle + Math.PI / 2, 0)
          const fertility = 0.76 + hash2d(localSeed, index, 43) * 0.42
          this.dummy.scale.set(fertility, 1, 0.82 + (index % 2) * 0.12)
          this.dummy.updateMatrix()
          this.farms.setMatrixAt(farmCount, this.dummy.matrix)
          farmCount += 1
        }
      }

      if (toolTier >= 1) {
        const workshopsForVillage = Math.min(2, Math.max(1, Math.floor((village.population + 14) / 26)))
        const visibleWorkshops = Math.ceil(workshopsForVillage * settings.settlementDensity)
        for (let index = 0; index < visibleWorkshops && workshopCount < MAX_WORKSHOPS; index += 1) {
          const angle = hash2d(localSeed, index, 59) * Math.PI * 2
          const radius = 0.47 + index * 0.26
          this.dummy.position.set(base.x + Math.cos(angle) * radius, base.y + 0.18, base.z + Math.sin(angle) * radius)
          this.dummy.rotation.set(0, angle, 0)
          this.dummy.scale.set(0.9 + index * 0.12, 0.9, 0.9 + (index % 2) * 0.12)
          this.dummy.updateMatrix()
          this.workshops.setMatrixAt(workshopCount, this.dummy.matrix)
          workshopCount += 1
        }

        {
          const angle = hash2d(localSeed, 83, 89) * Math.PI * 2
          const radius = 0.76 + hash2d(localSeed, 97, 101) * 0.16
          this.dummy.position.set(base.x + Math.cos(angle) * radius, base.y + 0.08, base.z + Math.sin(angle) * radius)
          this.dummy.rotation.set(0, angle + Math.PI / 2, 0)
          this.dummy.scale.setScalar(0.9 + hash2d(localSeed, 103, 107) * 0.16)
          this.dummy.updateMatrix()
          if (stockpileModelMatrices.length < stockpileModelLimit) {
            stockpileModelMatrices.push(this.dummy.matrix.clone())
          } else if (stockpileCount < this.stockpiles.instanceMatrix.count) {
            this.stockpiles.setMatrixAt(stockpileCount, this.dummy.matrix)
            stockpileCount += 1
          }
        }
      }

      if (hasMetalwork) {
        const forgesForVillage = Math.min(2, Math.max(1, Math.floor((village.population + 22) / 38)))
        const visibleForges = Math.ceil(forgesForVillage * settings.settlementDensity)
        for (let index = 0; index < visibleForges && forgeCount < MAX_FORGES; index += 1) {
          const angle = hash2d(localSeed, index, 67) * Math.PI * 2
          const radius = 0.66 + index * 0.2
          this.dummy.position.set(base.x + Math.cos(angle) * radius, base.y + 0.14, base.z + Math.sin(angle) * radius)
          this.dummy.rotation.set(0, angle, 0)
          this.dummy.scale.setScalar(0.9 + index * 0.12)
          this.dummy.updateMatrix()
          this.forges.setMatrixAt(forgeCount, this.dummy.matrix)
          forgeCount += 1
        }
      }

      if (hasTownHall && townHallCount < MAX_TOWN_HALLS) {
        this.dummy.position.set(base.x, base.y + 0.28, base.z)
        this.dummy.rotation.set(0, hash2d(localSeed, 71, 73) * Math.PI * 2, 0)
        this.dummy.scale.setScalar(0.92 + Math.min(0.26, village.population / 240))
        this.dummy.updateMatrix()
        this.townHalls.setMatrixAt(townHallCount, this.dummy.matrix)
        townHallCount += 1
      }

      if (toolTier >= 1) {
        const roadSegments = Math.min(6, Math.max(0, village.homes - 1))
        const visibleRoadSegments = Math.ceil(roadSegments * settings.settlementDensity)
        for (let index = 0; index < visibleRoadSegments && roadCount < MAX_ROADS; index += 1) {
          const angle = hash2d(localSeed, index, 47) * Math.PI * 2
          const radius = 0.28 + (index % 3) * 0.2
          this.dummy.position.set(base.x + Math.cos(angle) * radius, base.y + 0.018, base.z + Math.sin(angle) * radius)
          this.dummy.rotation.set(0, angle, 0)
          this.dummy.scale.set(0.78 + (index % 2) * 0.18, 1, 0.72 + (index % 3) * 0.12)
          this.dummy.updateMatrix()
          this.roads.setMatrixAt(roadCount, this.dummy.matrix)
          roadCount += 1
        }
      }

      if (hasMetalwork && village.population >= 12) {
        const lanternsForVillage = Math.min(4, Math.floor(village.population / 18) + 1)
        const visibleLanterns = Math.ceil(lanternsForVillage * settings.settlementDensity)
        for (let index = 0; index < visibleLanterns && lanternCount < MAX_LANTERNS; index += 1) {
          const angle = hash2d(localSeed, index, 53) * Math.PI * 2
          const radius = 0.42 + (index % 2) * 0.42
          this.dummy.position.set(base.x + Math.cos(angle) * radius, base.y + 0.51, base.z + Math.sin(angle) * radius)
          this.dummy.rotation.set(0, 0, 0)
          this.dummy.scale.setScalar(0.9 + (index % 2) * 0.18)
          this.dummy.updateMatrix()
          if (lanternModelMatrices.length < lanternModelLimit) {
            lanternModelMatrices.push(this.dummy.matrix.clone())
          } else if (lanternCount < this.lanterns.instanceMatrix.count) {
            this.lanterns.setMatrixAt(lanternCount, this.dummy.matrix)
            lanternCount += 1
          }
        }
      }
      const visibleResidents = Math.min(village.population, settings.maxSettlers)
      for (let index = 0; index < visibleResidents && settlerPlacements.length < MAX_SETTLERS; index += 1) {
        const tool = village.tools[(index + Math.floor(hash2d(localSeed, index, 79) * village.tools.length)) % village.tools.length] ?? 'stone-handaxe'
        settlerPlacements.push({
          id: `${village.id}-settler-${index}`,
          anchorTileX: home.x,
          anchorTileZ: home.z,
          phase: hash2d(localSeed, index, 2) * Math.PI * 2,
          radius: 0.2 + (index % 6) * 0.095,
          scale: 0.9 + (index % 3) * 0.12,
          clothingColor: index % 2 === 0 ? 0x8eb5d1 : 0xb87858,
          skinColor: index % 3 === 0 ? 0xc98d65 : 0xf4d6a4,
          tool,
        })
      }
    }

    this.stockpileModelLayer?.setMatrices(stockpileModelMatrices, stockpileModelLimit)
    this.lanternModelLayer?.setMatrices(lanternModelMatrices, lanternModelLimit)
    this.houses.count = houseCount
    this.roofs.count = roofCount
    this.thatchRoofs.count = thatchRoofCount
    this.farms.count = farmCount
    this.roads.count = roadCount
    this.workshops.count = workshopCount
    this.stockpiles.count = stockpileCount
    this.forges.count = forgeCount
    this.townHalls.count = townHallCount
    this.lanterns.count = lanternCount
    this.houses.instanceMatrix.needsUpdate = true
    this.roofs.instanceMatrix.needsUpdate = true
    this.thatchRoofs.instanceMatrix.needsUpdate = true
    this.farms.instanceMatrix.needsUpdate = true
    this.roads.instanceMatrix.needsUpdate = true
    this.workshops.instanceMatrix.needsUpdate = true
    this.stockpiles.instanceMatrix.needsUpdate = true
    this.forges.instanceMatrix.needsUpdate = true
    this.townHalls.instanceMatrix.needsUpdate = true
    this.lanterns.instanceMatrix.needsUpdate = true
    this.houses.computeBoundingSphere()
    this.roofs.computeBoundingSphere()
    this.thatchRoofs.computeBoundingSphere()
    this.farms.computeBoundingSphere()
    this.roads.computeBoundingSphere()
    this.workshops.computeBoundingSphere()
    this.stockpiles.computeBoundingSphere()
    this.forges.computeBoundingSphere()
    this.townHalls.computeBoundingSphere()
    this.lanterns.computeBoundingSphere()
    this.settlerLayer.setSettlers(this.world, settlerPlacements)
    this.animatedSettlerLayer.setSettlers(this.world, settlerPlacements, natureQuality)
  }

  private createClouds(): void {
    const random = createPrng(`${this.world.config.seed}-clouds`)
    const effectsQuality = this.graphicsQuality('effects')
    const cloudCount = qualitySettings(effectsQuality).cloudCount
    const worldWidth = this.world.config.size * TILE_SCALE
    this.cloudPuffsPerCloud = cloudPuffCount(effectsQuality)
    this.cloudGeometry = new THREE.IcosahedronGeometry(0.72, effectsQuality === 'low' ? 1 : 2)
    this.cloudMaterial = new THREE.MeshPhysicalMaterial({
      color: CLEAR_CLOUD,
      emissive: 0x7890a0,
      emissiveIntensity: 0.08,
      transparent: true,
      opacity: 0.74,
      roughness: 0.84,
      metalness: 0,
      clearcoat: 0.03,
      clearcoatRoughness: 0.72,
      depthWrite: false,
      dithering: true,
    })
    this.cloudMesh = new THREE.InstancedMesh(this.cloudGeometry, this.cloudMaterial, cloudCount * this.cloudPuffsPerCloud)
    this.cloudMesh.count = cloudCount * this.cloudPuffsPerCloud
    // The cloud mesh moves as a single batch, so culling a stale instance bound would pop it in and out of view.
    this.cloudMesh.frustumCulled = false
    this.cloudMesh.visible = this.polyHavenSkyTexture === undefined
    for (let index = 0; index < cloudCount; index += 1) {
      const baseX = random.range(-worldWidth / 2 - 8, worldWidth / 2 + 8)
      const baseZ = random.range(-worldWidth / 2 - 6, worldWidth / 2 + 6)
      this.clouds.push({ baseX, baseZ, altitude: random.range(10.4, 15.4), speed: random.range(0.035, 0.09), variation: random.next() })
    }

    this.updateCloudMatrices(false)
    this.scene.add(this.cloudMesh)
  }

  private disposeClouds(): void {
    if (this.cloudMesh) this.scene.remove(this.cloudMesh)
    this.clouds.length = 0
    this.cloudGeometry?.dispose()
    this.cloudMaterial?.dispose()
    this.cloudGeometry = undefined
    this.cloudMaterial = undefined
    this.cloudMesh = undefined
    this.cloudPuffsPerCloud = 0
  }

  /** Packs every cloud puff into one instanced draw call while keeping seed-stable variation. */
  private updateCloudMatrices(animate = true): void {
    const cloudMesh = this.cloudMesh
    if (!cloudMesh) return
    const worldWidth = this.world.config.size * TILE_SCALE
    const travelWidth = worldWidth + 18

    this.clouds.forEach((cloud, cloudIndex) => {
      const x = animate
        ? ((cloud.baseX + this.elapsed * cloud.speed * 2 + travelWidth / 2) % travelWidth) - travelWidth / 2
        : cloud.baseX
      const z = animate ? cloud.baseZ + Math.sin(this.elapsed * cloud.speed * 0.7) * 0.42 : cloud.baseZ

      for (let puff = 0; puff < this.cloudPuffsPerCloud; puff += 1) {
        const offset = (cloud.variation + puff * 0.37) % 1
        const ringAngle = puff * 2.399963229728653 + cloud.variation * Math.PI * 2
        const radius = puff === 0 ? 0.08 : 0.46 + offset * 0.78
        const height = (puff % 3 - 1) * 0.16 + (puff >= this.cloudPuffsPerCloud * 0.55 ? 0.32 : 0)
        const width = 1.14 + offset * 0.78
        this.dummy.position.set(
          x + Math.cos(ringAngle) * radius,
          cloud.altitude + height,
          z + Math.sin(ringAngle) * radius * 0.72,
        )
        this.dummy.rotation.set(0, ringAngle * 0.16, 0)
        this.dummy.scale.set(width, 0.62 + offset * 0.4, width * (0.78 + (1 - offset) * 0.18))
        this.dummy.updateMatrix()
        cloudMesh.setMatrixAt(cloudIndex * this.cloudPuffsPerCloud + puff, this.dummy.matrix)
      }
    })

    cloudMesh.instanceMatrix.needsUpdate = true
  }

  private tilePosition(tile: Tile): { x: number; y: number; z: number } {
    const half = (this.world.config.size - 1) / 2
    return { x: (tile.x - half) * TILE_SCALE, y: tile.height, z: (tile.z - half) * TILE_SCALE }
  }

  private updateSky(delta: number, reducedMotion: boolean, updateDynamicMotion: boolean): void {
    const phase = (this.simulation.tick % 96) / 96
    const sunArc = Math.sin(phase * Math.PI * 2)
    const daylight = clamp(sunArc * 0.8 + 0.45, 0.14, 1)
    const storm = this.simulation.activeStorm
    const stormStrength = storm ? clamp(storm.intensity / 2.2, 0, 0.78) : 0
    const sky = this.skyColor.copy(NIGHT_SKY).lerp(DAY_SKY, daylight)
    if (stormStrength > 0) sky.lerp(STORM_SKY, 0.46 * stormStrength)
    const fog = this.scene.fog
    if (!this.polyHavenSkyTexture) this.scene.background = sky
    this.skyLight.intensity = (0.42 + daylight * 1.15) * (1 - stormStrength * 0.26)
    this.skyLight.color.setHSL(0.58, 0.5, 0.3 + daylight * 0.42)
    this.sun.intensity = (0.3 + daylight * 2.1) * (1 - stormStrength * 0.44)
    this.sun.color.setHSL(0.1, 0.65, 0.55 + daylight * 0.25)
    this.sun.position.set(Math.cos(phase * Math.PI * 2) * 13, 6 + daylight * 15, Math.sin(phase * Math.PI * 2) * 12)
    this.skyDome.material.uniforms.topColor!.value.copy(sky).lerp(SKY_ZENITH, 0.62 + daylight * 0.2)
    this.skyHorizonColor.copy(sky).lerp(SKY_HORIZON, 0.58 + daylight * 0.18)
    this.skyDome.material.uniforms.horizonColor!.value.copy(this.skyHorizonColor)
    this.skyDome.material.uniforms.bottomColor!.value.copy(this.skyHorizonColor).lerp(SKY_BASE, 0.24)
    if (fog) fog.color.copy(this.skyHorizonColor)
    this.waterMaterial.color.setHSL(0.55, 0.74 - stormStrength * 0.16, 0.18 + daylight * 0.08)
    this.waterMaterial.emissive.setHSL(0.56, 0.54, 0.018 + daylight * 0.026)
    this.waterMaterial.roughness = 0.11 + stormStrength * 0.22
    this.waterMaterial.clearcoat = 0.92 - stormStrength * 0.32
    this.waterMaterial.clearcoatRoughness = 0.04 + stormStrength * 0.22
    this.waterMaterial.normalScale.set(0.14 + stormStrength * 0.16, 0.11 + stormStrength * 0.12)
    if (this.cloudMaterial) {
      this.cloudMaterial.color.copy(stormStrength > 0 ? STORM_CLOUD : CLEAR_CLOUD)
      this.cloudMaterial.emissive.setHSL(0.58, 0.24, 0.08 + daylight * 0.08)
      this.cloudMaterial.emissiveIntensity = 0.06 + daylight * 0.08
      this.cloudMaterial.opacity = 0.74 + daylight * 0.1 + stormStrength * 0.04
    }
    this.coastFoamMaterial.opacity = 0.24 + daylight * 0.08 + stormStrength * 0.12
    this.waterRippleMaterial.opacity = 0.17 + daylight * 0.09 + stormStrength * 0.11
    this.water.position.y = getWaterLevel(this.world.config) + 0.016
    if (!reducedMotion && updateDynamicMotion) {
      this.waterWaveFrame += 1
      this.waterNormalMap.offset.set((this.elapsed * 0.008) % 1, (this.elapsed * 0.005) % 1)
      if (this.waterWaveFrame % qualitySettings(this.graphicsQuality('water')).waterWaveInterval === 0) this.updateWaterSurface()
      this.updateWaterRipples()
      this.updateCloudMatrices()
    }

    this.rain.visible = Boolean(storm) && !reducedMotion
    if (!storm || reducedMotion || !updateDynamicMotion) return
    const waterHeight = getWaterLevel(this.world.config)
    const rainDropCount = Math.floor(this.rainGeometry.drawRange.count / 2)
    for (let index = 0; index < rainDropCount; index += 1) {
      const position = index * 6
      const yIndex = position + 1
      const currentY = this.rainPositions[yIndex] ?? 0
      const nextY = currentY - delta * (4.8 + (index % 5) * 0.34)
      const head = nextY < waterHeight - 0.7 ? 7.2 + (index % 6) * 0.2 : nextY
      this.rainPositions[yIndex] = head
      this.rainPositions[position + 4] = head - 0.34
    }
    const attribute = this.rainGeometry.getAttribute('position') as THREE.BufferAttribute
    attribute.needsUpdate = true
  }

  /** Layered swells give the PBR surface a readable sea state while normal-map ripples retain close-up detail. */
  private updateWaterSurface(): void {
    const positions = this.water.geometry.getAttribute('position') as THREE.BufferAttribute
    const stormStrength = this.simulation.activeStorm ? clamp(this.simulation.activeStorm.intensity / 2.2, 0, 0.78) : 0
    const swellAmplitude = 0.008 + stormStrength * 0.032

    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index)
      const z = positions.getZ(index)
      const broadSwell = Math.sin(x * 0.38 + z * 0.16 + this.elapsed * 0.92)
        + Math.cos(z * 0.46 - x * 0.11 - this.elapsed * 0.68) * 0.64
      const crossSwell = Math.sin((x + z) * 0.72 - this.elapsed * 1.24) * 0.28
      positions.setY(index, broadSwell * swellAmplitude + crossSwell * swellAmplitude)
    }

    positions.needsUpdate = true
    if (this.waterWaveFrame % qualitySettings(this.graphicsQuality('water')).waterNormalInterval === 0) this.water.geometry.computeVertexNormals()
  }

  private seedRain(): void {
    const random = createPrng(`${this.world.config.seed}-rain`)
    const width = this.world.config.size * TILE_SCALE
    for (let index = 0; index < MAX_RAIN_DROPS; index += 1) {
      const position = index * 6
      this.rainPositions[position] = random.range(-width / 2, width / 2)
      this.rainPositions[position + 1] = random.range(0, 7.5)
      this.rainPositions[position + 2] = random.range(-width / 2, width / 2)
      this.rainPositions[position + 3] = this.rainPositions[position] ?? 0
      this.rainPositions[position + 4] = (this.rainPositions[position + 1] ?? 0) - 0.34
      this.rainPositions[position + 5] = this.rainPositions[position + 2] ?? 0
    }
    this.rainGeometry.computeBoundingSphere()
  }

  private attachInteractions(): void {
    const canvas = this.renderer.domElement
    canvas.addEventListener('pointermove', this.handlePointerMove)
    canvas.addEventListener('pointerdown', this.handlePointerDown)
    canvas.addEventListener('pointerup', this.handlePointerUp)
    canvas.addEventListener('pointercancel', this.handlePointerCancel)
    canvas.addEventListener('pointerleave', this.handlePointerLeave)
    canvas.addEventListener('webglcontextlost', this.handleContextLost)
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
    window.addEventListener('resize', this.resize)
    this.seedRain()
  }

  private detachInteractions(): void {
    const canvas = this.renderer.domElement
    canvas.removeEventListener('pointermove', this.handlePointerMove)
    canvas.removeEventListener('pointerdown', this.handlePointerDown)
    canvas.removeEventListener('pointerup', this.handlePointerUp)
    canvas.removeEventListener('pointercancel', this.handlePointerCancel)
    canvas.removeEventListener('pointerleave', this.handlePointerLeave)
    canvas.removeEventListener('webglcontextlost', this.handleContextLost)
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    window.removeEventListener('resize', this.resize)
  }

  private readonly resize = (): void => {
    const { width, height } = this.host.getBoundingClientRect()
    if (width === 0 || height === 0) return
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    const settings = qualitySettings(this.graphicsQuality('scene'))
    const mobileCap = isMobileViewport() ? Math.min(settings.maxDpr, 1.5) : settings.maxDpr
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobileCap))
    this.renderer.setSize(width, height, false)
  }

  private refreshWaterGeometryForQuality(): void {
    const nextSegments = oceanSegmentsFor(this.graphicsQuality('water'), this.world.config.size)
    if (nextSegments === this.waterSegments) return

    const waterSize = waterPlaneSize(this.world.config.size)
    const normalRepeat = waterNormalRepeat(waterSize)
    this.waterNormalMap.repeat.set(normalRepeat, normalRepeat)
    const nextGeometry = new THREE.PlaneGeometry(waterSize, waterSize, nextSegments, nextSegments)
    nextGeometry.rotateX(-Math.PI / 2)
    const previousGeometry = this.water.geometry
    this.water.geometry = nextGeometry
    previousGeometry.dispose()
    this.waterSegments = nextSegments
    this.waterWaveFrame = 0
  }

  /** Rebuilds only profile-controlled presentation; world and simulation data stay untouched. */
  private refreshQualityDependentScene(): void {
    this.applyQuality()
    this.resize()
    this.refreshWaterGeometryForQuality()
    this.rebuildWaterRipples()
    this.refreshCloudQuality()
    this.updateStaticInstances()
    this.updateSettlementInstances(true)
  }

  private applyQuality(): void {
    const shadowSettings = qualitySettings(this.graphicsQuality('shadows'))
    const effectSettings = qualitySettings(this.graphicsQuality('effects'))
    const waterSettings = qualitySettings(this.graphicsQuality('water'))
    this.renderer.shadowMap.enabled = shadowSettings.shadows
    this.renderer.shadowMap.autoUpdate = false
    this.sun.castShadow = shadowSettings.shadows
    this.sun.shadow.mapSize.set(shadowSettings.shadowMapSize, shadowSettings.shadowMapSize)
    this.nextShadowUpdateAt = 0
    this.renderer.shadowMap.needsUpdate = shadowSettings.shadows
    this.rainGeometry.setDrawRange(0, effectSettings.rainDropCount * 2)
    this.waterMaterial.normalScale.setScalar(waterSettings.shadows ? 0.28 : 0.14)
  }

  private refreshCloudQuality(): void {
    if (!this.cloudGeometry) return
    this.disposeClouds()
    this.createClouds()
  }

  private pickTile(event: PointerEvent): HoveredTile | undefined {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hit = this.raycaster.intersectObject(this.terrainHit, false)[0]
    if (!hit) return undefined
    const half = (this.world.config.size - 1) / 2
    const x = Math.round(hit.point.x / TILE_SCALE + half)
    const z = Math.round(hit.point.z / TILE_SCALE + half)
    if (x < 0 || z < 0 || x >= this.world.config.size || z >= this.world.config.size) return undefined
    const tile = this.world.tiles[z * this.world.config.size + x]
    if (!tile) return undefined
    return { index: tile.index, tile }
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const now = performance.now()
    if (now - this.lastHoverTime < 45) return
    this.lastHoverTime = now
    const hovered = this.pickTile(event)
    if (!hovered) {
      this.preview.visible = false
      if (this.lastHoveredIndex !== undefined) this.callbacks.onTileHover(undefined)
      this.lastHoveredIndex = undefined
      return
    }
    const position = this.tilePosition(hovered.tile)
    this.preview.visible = true
    this.preview.position.set(position.x, position.y + 0.035, position.z)
    if (this.lastHoveredIndex !== hovered.index) this.callbacks.onTileHover(hovered)
    this.lastHoveredIndex = hovered.index
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || !event.isPrimary) return
    this.pointerDown = { x: event.clientX, y: event.clientY, pointerId: event.pointerId }
  }

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (event.button !== 0 || !event.isPrimary) return
    const down = this.pointerDown
    this.pointerDown = undefined
    if (!down || down.pointerId !== event.pointerId || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 7) return
    const hovered = this.pickTile(event)
    if (hovered) this.callbacks.onTileActivate(hovered.index)
  }

  private readonly handlePointerCancel = (event: PointerEvent): void => {
    if (this.pointerDown?.pointerId === event.pointerId) this.pointerDown = undefined
  }

  private readonly handlePointerLeave = (): void => {
    this.pointerDown = undefined
    this.preview.visible = false
    if (this.lastHoveredIndex !== undefined) this.callbacks.onTileHover(undefined)
    this.lastHoveredIndex = undefined
  }

  private readonly handleVisibilityChange = (): void => {
    this.previousFrame = 0
    this.previousBrowserFrame = 0
    this.nextRenderAt = 0
    this.lastActorMotionAt = Number.NEGATIVE_INFINITY
    this.lastEnvironmentMotionAt = Number.NEGATIVE_INFINITY
    this.statsElapsed = 0
    this.framesSinceStats = 0
    this.browserStatsElapsed = 0
    this.browserFramesSinceStats = 0
    this.renderer.setAnimationLoop(document.hidden ? null : this.renderFrame)
  }

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault()
    this.renderer.setAnimationLoop(null)
    this.callbacks.onWebGlError('Đồ họa 3D đã mất kết nối. Hãy dùng nút “Thử lại đồ họa 3D” để dựng lại bản đồ.')
  }

  private shouldRenderAt(timestamp: number): boolean {
    const interval = renderFrameIntervalMs(this.qualityProfile, this.graphicsQuality('scene'))
    if (this.nextRenderAt === 0) {
      this.nextRenderAt = timestamp + interval
      return true
    }
    if (timestamp + 0.2 < this.nextRenderAt) return false
    this.nextRenderAt = timestamp - this.nextRenderAt > interval
      ? timestamp + interval
      : this.nextRenderAt + interval
    return true
  }

  private takeActorMotionDelta(timestamp: number): number | undefined {
    const interval = qualitySettings(this.graphicsQuality('nature')).motionUpdateIntervalMs
    if (timestamp - this.lastActorMotionAt < interval) return undefined
    const delta = Number.isFinite(this.lastActorMotionAt)
      ? Math.min((timestamp - this.lastActorMotionAt) / 1000, 0.1)
      : 0
    this.lastActorMotionAt = timestamp
    return delta
  }

  private takeEnvironmentMotionDelta(timestamp: number): number | undefined {
    const interval = qualitySettings(this.graphicsQuality('effects')).motionUpdateIntervalMs
    if (timestamp - this.lastEnvironmentMotionAt < interval) return undefined
    const delta = Number.isFinite(this.lastEnvironmentMotionAt)
      ? Math.min((timestamp - this.lastEnvironmentMotionAt) / 1000, 0.1)
      : 0
    this.lastEnvironmentMotionAt = timestamp
    return delta
  }

  private scheduleShadowUpdate(timestamp: number): void {
    const settings = qualitySettings(this.graphicsQuality('shadows'))
    if (!settings.shadows || timestamp < this.nextShadowUpdateAt) return
    this.renderer.shadowMap.needsUpdate = true
    this.nextShadowUpdateAt = timestamp + settings.shadowUpdateIntervalMs
  }

  private reportStats(timestamp: number): void {
    if (this.statsElapsed < 0.9) return
    const info = this.renderer.info
    const fps = Math.round(this.framesSinceStats / this.statsElapsed)
    const availableFps = this.browserStatsElapsed > 0
      ? Math.round(this.browserFramesSinceStats / this.browserStatsElapsed)
      : fps
    const nextQuality = this.capQualityForViewport(effectiveQualityFor(this.qualityProfile, availableFps, this.effectiveQuality))
    if (nextQuality !== this.effectiveQuality && canApplyAutoQualityChange(timestamp, this.lastQualityChangeAt)) {
      this.effectiveQuality = nextQuality
      this.lastQualityChangeAt = timestamp
      this.refreshQualityDependentScene()
    }
    const assetSelection = this.assetPackManager.currentSelection
    this.callbacks.onStats({
      fps,
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      textures: info.memory.textures,
      assetLoadDurationMs: Math.round(this.assetPackManager.loadDurationMs),
      assetPack: assetSelection?.selectedPack ?? 'procedural',
      assetPackFallback: this.assetPackManager.loadUsedFallback || assetSelection?.usedFallback === true || !assetSelection || this.treeModelFallback || this.rockModelFallback || this.groundCoverModelFallback || this.coastRockModelFallback || this.lanternModelFallback || this.stockpileModelFallback,
      assetPackReason: assetSelection?.reason ?? 'Äang chá» gÃ³i Ä‘á»“ há»a.',
      assetLoadState: this.assetPackManager.loadProgress.state,
    })
    this.statsElapsed = 0
    this.framesSinceStats = 0
    this.browserStatsElapsed = 0
    this.browserFramesSinceStats = 0
  }

  private readonly renderFrame = (timestamp: number): void => {
    if (this.previousBrowserFrame) {
      const browserDelta = Math.min((timestamp - this.previousBrowserFrame) / 1000, 0.25)
      this.statsElapsed += browserDelta
      this.browserStatsElapsed += browserDelta
      this.browserFramesSinceStats += 1
    }
    this.previousBrowserFrame = timestamp
    if (!this.shouldRenderAt(timestamp)) return

    const delta = this.previousFrame
      ? Math.min((timestamp - this.previousFrame) / 1000, 0.1)
      : 0
    this.previousFrame = timestamp
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const motionDelta = reducedMotion ? 0 : delta
    this.elapsed += motionDelta
    this.framesSinceStats += 1

    const actorMotionDelta = this.takeActorMotionDelta(timestamp)
    const environmentMotionDelta = this.takeEnvironmentMotionDelta(timestamp)
    this.updateSky(environmentMotionDelta ?? 0, reducedMotion, environmentMotionDelta !== undefined)
    if (actorMotionDelta !== undefined) {
      this.faunaLayer.update(this.elapsed, reducedMotion)
      this.settlerLayer.update(this.elapsed, reducedMotion)
      this.animatedFaunaLayer.update(actorMotionDelta, this.elapsed, reducedMotion)
      this.animatedSettlerLayer.update(actorMotionDelta, this.elapsed, reducedMotion)
    }
    if (environmentMotionDelta !== undefined) {
      this.treeModelLayer?.animate(this.elapsed, reducedMotion)
      this.rockModelLayer?.animate(this.elapsed, reducedMotion)
      this.groundCoverModelLayer?.animate(this.elapsed, reducedMotion)
      this.coastRockModelLayer?.animate(this.elapsed, reducedMotion)
      this.lanternModelLayer?.animate(this.elapsed, reducedMotion)
      this.stockpileModelLayer?.animate(this.elapsed, reducedMotion)
    }
    this.controls.update()
    this.scheduleShadowUpdate(timestamp)
    this.renderer.render(this.scene, this.camera)
    this.reportStats(timestamp)
  }
}
