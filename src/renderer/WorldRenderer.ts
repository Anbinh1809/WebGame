import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { SimulationState } from '../simulation/types'
import { happinessAtTile } from '../simulation/metrics'
import { createPrng, hash2d, seedToUint32 } from '../world/prng'
import { getWaterLevel } from '../world/generator'
import type { HeatmapMode, Tile, ToolId, World } from '../world/types'
import { ASSET_MANIFEST } from '../assets/manifest'
import { desktopPackRoot, loadDesktopPackManifest } from '../assets/desktopPackManifest'
import { desktopTreeModelEntries } from '../assets/modelManifest'
import { assetsForPack } from '../assets/registry'
import type { AssetManifestEntry, AssetPackQuality } from '../assets/types'
import { AssetPackManager } from './AssetPackManager'
import type { AssetLoadProgress, GameEdition, ResolvedAssetPack } from './AssetPackManager'
import { PolyHavenArtBundle, clearPolyHavenArt, createProceduralArtFallback, loadPolyHavenArt } from './PolyHavenArt'
import type { PolyHavenArtTargets } from './PolyHavenArt'
import { InstancedTreeModelLayer, canLoadTreeModel, loadInstancedTreeModel, treeModelAssetForPack, treeModelInstanceLimit } from './TreeModelLayer'
import { canApplyAutoQualityChange, capQualityForMobile, effectiveQualityFor, qualityForProfileChange, qualitySettings, waterSegmentsFor } from './quality'
import type { EffectiveQuality, QualityProfile } from './quality'

const TILE_SCALE = 0.72
const MAX_SETTLERS = 180
const MAX_HOUSES = 48
const MAX_FARMS = 64
const MAX_ROADS = 48
const MAX_LANTERNS = 48
const MAX_RAIN_DROPS = 360
/** Keeps photo mode below a predictable browser/GPU memory budget. */
export const MAX_PHOTO_PIXELS = 8_000_000
const NIGHT_SKY = new THREE.Color(0x172842)
const DAY_SKY = new THREE.Color(0x9ccfe5)
const STORM_SKY = new THREE.Color(0x536b7f)
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

/** One pack resource owns both PBR maps and an optional instanced tree model. */
class WorldArtBundle {
  public constructor(
    private readonly materials: PolyHavenArtBundle,
    public readonly treeLayer: InstancedTreeModelLayer | undefined,
    public readonly treeFallback: boolean,
  ) {}

  public apply(targets: PolyHavenArtTargets): void {
    this.materials.apply(targets)
  }

  public dispose(): void {
    this.treeLayer?.dispose()
    this.materials.dispose()
  }
}

function createTerrainMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0.02 })
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
    return new THREE.Color(0xd9c47f).lerp(new THREE.Color(0x9fb58a), clamp(tile.moisture * 0.34, 0, 0.34)).offsetHSL(0, 0, (variation - 0.5) * 0.05)
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
  private readonly waterMaterial = new THREE.MeshStandardMaterial({
    color: 0x287dae,
    transparent: true,
    opacity: 0.74,
    roughness: 0.24,
    metalness: 0.12,
    emissive: 0x0c3555,
    emissiveIntensity: 0.12,
    side: THREE.DoubleSide,
  })
  private readonly treeGeometry = createStylizedCanopyGeometry()
  // Distant canopies preserve the game's readable stylized silhouette while
  // nearby, selected trees use the curated Poly Haven mesh.
  private readonly treeMaterial = new THREE.MeshStandardMaterial({ color: 0x4d7c42, flatShading: true, roughness: 0.9 })
  private readonly trunkGeometry = new THREE.CylinderGeometry(0.045, 0.062, 0.42, 5)
  private readonly trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x62432c, flatShading: true, roughness: 0.94 })
  private readonly rockGeometry = new THREE.DodecahedronGeometry(0.18, 0)
  private readonly rockMaterial = new THREE.MeshStandardMaterial({ color: 0x87909a, flatShading: true, roughness: 0.84, metalness: 0.08 })
  private readonly resourceGeometry = new THREE.ConeGeometry(0.12, 0.45, 5)
  private readonly resourceMaterial = new THREE.MeshStandardMaterial({ color: 0xf4be64, flatShading: true, roughness: 0.47, metalness: 0.36 })
  private readonly groundDetailGeometry = new THREE.ConeGeometry(0.075, 0.28, 4)
  private readonly groundDetailMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.96 })
  private readonly houseGeometry = new THREE.BoxGeometry(0.38, 0.32, 0.36)
  private readonly houseMaterial = new THREE.MeshStandardMaterial({ color: 0xb8714e, flatShading: true, roughness: 0.82 })
  private readonly roofGeometry = new THREE.ConeGeometry(0.35, 0.34, 4)
  private readonly roofMaterial = new THREE.MeshStandardMaterial({ color: 0x5e3c34, flatShading: true, roughness: 0.9 })
  private readonly farmGeometry = new THREE.BoxGeometry(0.56, 0.026, 0.3)
  private readonly farmMaterial = new THREE.MeshStandardMaterial({ color: 0x9fb652, flatShading: true, roughness: 0.95 })
  private readonly roadGeometry = new THREE.BoxGeometry(0.16, 0.018, 0.78)
  private readonly roadMaterial = new THREE.MeshStandardMaterial({ color: 0x92795c, flatShading: true, roughness: 0.99 })
  private readonly lanternGeometry = new THREE.SphereGeometry(0.065, 6, 4)
  private readonly lanternMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc73, emissive: 0x8d4d16, emissiveIntensity: 0.55, flatShading: true, roughness: 0.6 })
  private readonly settlerGeometry = new THREE.SphereGeometry(0.09, 7, 5)
  private readonly settlerMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.72 })
  private readonly rainGeometry = new THREE.BufferGeometry()
  private readonly rainMaterial = new THREE.LineBasicMaterial({ color: 0xbdeaff, transparent: true, opacity: 0.84, depthWrite: false, depthTest: false })
  private readonly previewMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.68, side: THREE.DoubleSide })
  private readonly clouds: Array<{ baseX: number; baseZ: number; altitude: number; speed: number; variation: number }> = []
  private readonly sun = new THREE.DirectionalLight(0xfff0bc, 2.3)
  private readonly skyLight = new THREE.HemisphereLight(0x9bd8ff, 0x4d5539, 1.55)
  private readonly dummy = new THREE.Object3D()
  private readonly skyColor = new THREE.Color()
  /** Two vertices per drop make weather legible as rain streaks while retaining one draw call. */
  private readonly rainPositions = new Float32Array(MAX_RAIN_DROPS * 6)
  private terrainGroup!: THREE.Group
  private terrainHit!: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
  private terrainSurfaces: Partial<Record<TerrainSurface, TerrainSurfaceMesh>> = {}
  private water!: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>
  private trees!: THREE.InstancedMesh
  private trunks!: THREE.InstancedMesh
  private treeModelLayer: InstancedTreeModelLayer | undefined
  private rocks!: THREE.InstancedMesh
  private resources!: THREE.InstancedMesh
  private groundDetails!: THREE.InstancedMesh
  private houses!: THREE.InstancedMesh
  private roofs!: THREE.InstancedMesh
  private farms!: THREE.InstancedMesh
  private roads!: THREE.InstancedMesh
  private lanterns!: THREE.InstancedMesh
  private settlers!: THREE.InstancedMesh
  private rain!: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>
  private preview!: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
  private cloudGeometry: THREE.DodecahedronGeometry | undefined
  private cloudMaterial: THREE.MeshStandardMaterial | undefined
  private cloudMesh: THREE.InstancedMesh | undefined
  private world: World
  private simulation: SimulationState
  private heatmap: HeatmapMode = 'địa hình'
  private tool: ToolId = 'raise'
  private elapsed = 0
  private previousFrame = 0
  private statsElapsed = 0
  private framesSinceStats = 0
  private lastHoverTime = 0
  private lastHoveredIndex: number | undefined
  private pointerDown: { x: number; y: number; pointerId: number } | undefined
  private qualityProfile: QualityProfile = 'auto'
  private effectiveQuality: EffectiveQuality = 'medium'
  private lastQualityChangeAt = 0
  private waterWaveFrame = 0
  private waterSegments = 0
  private requestedAssetPack: AssetPackQuality | undefined
  private artLoadRevision = 0
  private isDisposed = false
  private hasPolyHavenTerrainArt = false
  private treeModelFallback = false

  public constructor(
    private readonly host: HTMLElement,
    world: World,
    simulation: SimulationState,
    private readonly callbacks: RendererCallbacks,
    quality: QualityProfile = 'auto',
    private readonly edition: GameEdition = 'web-demo',
  ) {
    if (!WorldRenderer.supportsWebGl()) {
      throw new Error('Trình duyệt này không hỗ trợ WebGL.')
    }

    this.world = world
    this.simulation = simulation
    this.qualityProfile = quality
    this.effectiveQuality = this.capQualityForViewport(quality === 'auto' ? 'low' : quality)
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.15
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.domElement.className = 'world-canvas'
    this.renderer.domElement.tabIndex = 0
    this.renderer.domElement.setAttribute('aria-label', 'Bản đồ 3D Aetheria. Dùng chuột để xoay, kéo và phóng to; nhấp để áp dụng quyền năng.')
    this.host.appendChild(this.renderer.domElement)

    this.scene.background = new THREE.Color(0x9acde2)
    this.scene.fog = new THREE.Fog(0x9acde2, 20, 52)
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
    this.applyQuality()
    this.scene.add(this.skyLight, this.sun, this.sun.target)

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
      this.createWorldObjects(world)
      this.controls.target.set(0, 0, 0)
      return
    }

    this.writeTerrain()
    this.updateStaticInstances()
    this.updateSettlementInstances()
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
    this.refreshQualityDependentScene()
  }

  /** Web is hard-limited to 1K; desktop resolves local 2K/4K manifests and safe fallbacks. */
  public setAssetPack(requestedPack: AssetPackQuality): void {
    if (this.requestedAssetPack === requestedPack) return
    this.requestedAssetPack = requestedPack
    if (this.edition === 'desktop' && (requestedPack === 'desktop-2k' || requestedPack === 'desktop-4k')) {
      const requestedDesktopPacks = requestedPack === 'desktop-4k' ? ['desktop-4k', 'desktop-2k'] as const : ['desktop-2k'] as const
      void Promise.allSettled(requestedDesktopPacks.map((pack) => loadDesktopPackManifest(pack))).then((results) => {
        if (this.isDisposed || this.requestedAssetPack !== requestedPack) return
        const desktopEntries = results.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
        const availableDesktopPacks = requestedDesktopPacks.filter((_, index) => results[index]?.status === 'fulfilled')
        const desktopModels = desktopTreeModelEntries(desktopPackRoot())
          .filter((entry) => availableDesktopPacks.some((pack) => pack === entry.pack))
        this.applyAssetPack(requestedPack, [...ASSET_MANIFEST, ...desktopEntries, ...desktopModels])
      })
      return
    }
    this.applyAssetPack(requestedPack, ASSET_MANIFEST)
  }

  private applyAssetPack(requestedPack: AssetPackQuality, entries: readonly AssetManifestEntry[]): void {
    const artLoadRevision = ++this.artLoadRevision
    this.detachTreeModelLayer()
    this.hasPolyHavenTerrainArt = false
    this.refreshTerrainMaterialColoring()
    clearPolyHavenArt(this.polyHavenArtTargets)
    const selection = this.assetPackManager.transition({
      edition: this.edition,
      requestedPack,
      capabilities: { maxTextureSize: this.renderer.capabilities.maxTextureSize },
      entitlements: { desktopGame: this.edition === 'desktop', cinema8k: false },
      availability: {
        'web-1k': assetsForPack(entries, 'web-1k').length > 0,
        'desktop-2k': assetsForPack(entries, 'desktop-2k').length > 0,
        'desktop-4k': assetsForPack(entries, 'desktop-4k').length > 0,
        'cinema-8k': false,
      },
    })
    const selectedPack = selection.selectedPack
    if (selectedPack === 'procedural') return

    void this.assetPackManager.loadWithFallback<WorldArtBundle>(
      {
        id: `polyhaven-${selectedPack}`,
        load: async () => {
          const treeAsset = canLoadTreeModel(selection.textureSourceResolution)
            ? treeModelAssetForPack(entries, selectedPack)
            : undefined
          const [materials, treeResult] = await Promise.all([
            loadPolyHavenArt(this.renderer, this.polyHavenArtTargets, entries, selectedPack),
            treeAsset
              ? loadInstancedTreeModel(treeAsset)
                .then((layer) => ({ layer, fallback: false }))
                .catch(() => ({ layer: undefined, fallback: true }))
              : Promise.resolve({ layer: undefined, fallback: true }),
          ])
          return new WorldArtBundle(materials, treeResult.layer, treeResult.fallback)
        },
      },
      { id: 'procedural-art-fallback', load: async () => new WorldArtBundle(createProceduralArtFallback(), undefined, true) },
    ).then((result) => {
      if (this.isDisposed || artLoadRevision !== this.artLoadRevision) {
        result.value.dispose()
        return
      }
      result.value.apply(this.polyHavenArtTargets)
      this.treeModelLayer = result.value.treeLayer
      this.treeModelFallback = result.usedFallback || result.value.treeFallback
      this.treeModelLayer?.attach(this.scene)
      this.updateStaticInstances()
      this.hasPolyHavenTerrainArt = !result.usedFallback
      this.refreshTerrainMaterialColoring()
    }).catch(() => {
      // The asset manager records an error state; the procedural materials stay playable.
    })
  }

  /** The asset scope owns disposal; the renderer only detaches stale geometry. */
  private detachTreeModelLayer(): void {
    this.treeModelLayer?.detach()
    this.treeModelLayer = undefined
    this.treeModelFallback = false
    if (this.trees && this.trunks) this.updateStaticInstances()
  }

  private get polyHavenArtTargets(): PolyHavenArtTargets {
    return {
      scene: this.scene,
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

  /** Terrain maps own the natural biome palette; heatmaps deliberately restore vertex-color overlays. */
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
    this.renderer.setAnimationLoop(null)
    this.resizeObserver.disconnect()
    this.detachInteractions()
    clearPolyHavenArt(this.polyHavenArtTargets)
    this.detachTreeModelLayer()
    this.assetPackManager.dispose()
    this.disposeWorldObjects()
    this.previewMaterial.dispose()
    this.terrainHitMaterial.dispose()
    for (const material of Object.values(this.terrainMaterials)) material.dispose()
    this.waterMaterial.dispose()
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
    this.houseGeometry.dispose()
    this.houseMaterial.dispose()
    this.roofGeometry.dispose()
    this.roofMaterial.dispose()
    this.farmGeometry.dispose()
    this.farmMaterial.dispose()
    this.roadGeometry.dispose()
    this.roadMaterial.dispose()
    this.lanternGeometry.dispose()
    this.lanternMaterial.dispose()
    this.settlerGeometry.dispose()
    this.settlerMaterial.dispose()
    this.controls.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.scene.clear()
    this.renderer.domElement.remove()
  }

  private createWorldObjects(world: World): void {
    this.createTerrainSurfaces(world)

    const size = world.config.size
    const waterSize = Math.max(2, (size - 1) * TILE_SCALE)
    this.waterSegments = waterSegmentsFor(this.effectiveQuality, size)
    const waterGeometry = new THREE.PlaneGeometry(waterSize, waterSize, this.waterSegments, this.waterSegments)
    waterGeometry.rotateX(-Math.PI / 2)
    this.water = new THREE.Mesh(waterGeometry, this.waterMaterial)
    this.water.position.y = getWaterLevel(world.config) + 0.016
    this.scene.add(this.water)

    const capacity = size * size
    this.trees = new THREE.InstancedMesh(this.treeGeometry, this.treeMaterial, capacity)
    this.trunks = new THREE.InstancedMesh(this.trunkGeometry, this.trunkMaterial, capacity)
    this.rocks = new THREE.InstancedMesh(this.rockGeometry, this.rockMaterial, capacity)
    this.resources = new THREE.InstancedMesh(this.resourceGeometry, this.resourceMaterial, capacity)
    this.groundDetails = new THREE.InstancedMesh(this.groundDetailGeometry, this.groundDetailMaterial, capacity)
    this.houses = new THREE.InstancedMesh(this.houseGeometry, this.houseMaterial, MAX_HOUSES)
    this.roofs = new THREE.InstancedMesh(this.roofGeometry, this.roofMaterial, MAX_HOUSES)
    this.farms = new THREE.InstancedMesh(this.farmGeometry, this.farmMaterial, MAX_FARMS)
    this.roads = new THREE.InstancedMesh(this.roadGeometry, this.roadMaterial, MAX_ROADS)
    this.lanterns = new THREE.InstancedMesh(this.lanternGeometry, this.lanternMaterial, MAX_LANTERNS)
    this.settlers = new THREE.InstancedMesh(this.settlerGeometry, this.settlerMaterial, MAX_SETTLERS)

    for (const object of [this.trees, this.trunks, this.rocks, this.resources, this.groundDetails, this.houses, this.roofs, this.farms, this.roads, this.lanterns, this.settlers]) {
      object.castShadow = true
      object.receiveShadow = true
      object.frustumCulled = true
      this.scene.add(object)
    }

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
    this.updateSettlementInstances()
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

    const builders = new Map<TerrainSurface, { positions: number[]; colors: number[]; uvs: number[]; indices: number[]; tileIndices: number[] }>()
    const builderFor = (surface: TerrainSurface): { positions: number[]; colors: number[]; uvs: number[]; indices: number[]; tileIndices: number[] } => {
      const existing = builders.get(surface)
      if (existing) return existing
      const created = { positions: [], colors: [], uvs: [], indices: [], tileIndices: [] }
      builders.set(surface, created)
      return created
    }
    const uvDenominator = Math.max(1, size - 1)

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
          builder.positions.push(position.x, position.y, position.z)
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
    for (const object of [this.trees, this.trunks, this.rocks, this.resources, this.groundDetails, this.houses, this.roofs, this.farms, this.roads, this.lanterns, this.settlers]) {
      if (object) this.scene.remove(object)
    }
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
      const colors = geometry.getAttribute('color') as THREE.BufferAttribute
      for (let index = 0; index < terrainSurface.tileIndices.length; index += 1) {
        const tile = this.world.tiles[terrainSurface.tileIndices[index] ?? 0]
        if (!tile) continue
        const color = terrainColor(tile, this.heatmap, this.simulation, this.world)
        positions.setXYZ(index, (tile.x - half) * TILE_SCALE, tile.height, (tile.z - half) * TILE_SCALE)
        colors.setXYZ(index, color.r, color.g, color.b)
      }
      positions.needsUpdate = true
      colors.needsUpdate = true
      geometry.computeVertexNormals()
      geometry.computeBoundingSphere()
    }
    this.water.position.y = getWaterLevel(this.world.config) + 0.016
  }

  private updateStaticInstances(): void {
    const seed = seedToUint32(this.world.config.seed)
    const settings = qualitySettings(this.effectiveQuality)
    const treeCandidates: TreePlacement[] = []
    let rockCount = 0
    let resourceCount = 0
    let detailCount = 0

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

      if ((tile.biome === 'đồi' || tile.biome === 'núi' || tile.biome === 'tuyết') && variation > 0.47 && hash2d(seed ^ 0x91f07c, tile.z, tile.x) < settings.rockDensity && rockCount < this.rocks.instanceMatrix.count) {
        this.dummy.position.set(x, y + 0.08, z)
        this.dummy.rotation.set(variation, variation * 4, 0)
        this.dummy.scale.set(0.64 + variation * 0.72, 0.6 + hash2d(seed ^ 0x66dd11, tile.z, tile.x) * 0.78, 0.64 + hash2d(seed ^ 0x9016a4, tile.x, tile.z) * 0.72)
        this.dummy.updateMatrix()
        this.rocks.setMatrixAt(rockCount, this.dummy.matrix)
        rockCount += 1
      }

      if (tile.resources > 0.73 && tile.biome !== 'biển' && hash2d(seed ^ 0x6e2a59, tile.x, tile.z) < settings.resourceDensity && resourceCount < this.resources.instanceMatrix.count) {
        this.dummy.position.set(x + 0.16, y + 0.2, z - 0.1)
        this.dummy.rotation.set(0, variation * 2, 0)
        this.dummy.scale.setScalar(0.66 + tile.resources * 0.46)
        this.dummy.updateMatrix()
        this.resources.setMatrixAt(resourceCount, this.dummy.matrix)
        resourceCount += 1
      }

      const supportsDetail = tile.biome === 'đồng cỏ' || tile.biome === 'rừng' || tile.biome === 'bờ cát' || tile.biome === 'tuyết'
      if (supportsDetail && settings.groundDetailDensity > 0 && hash2d(seed ^ 0x1c53d7, tile.z, tile.x) < settings.groundDetailDensity && variation > 0.32 && detailCount < this.groundDetails.instanceMatrix.count) {
        const offsetX = (hash2d(seed ^ 0x37d8af, tile.z, tile.x) - 0.5) * 0.34
        const offsetZ = (hash2d(seed ^ 0xae21d9, tile.x, tile.z) - 0.5) * 0.34
        this.dummy.position.set(x + offsetX, y + 0.11, z + offsetZ)
        this.dummy.rotation.set(0, variation * Math.PI * 2, 0)
        const detailScale = tile.biome === 'rừng' ? 1.28 : tile.biome === 'đồng cỏ' ? 0.72 + tile.moisture * 0.56 : 0.5 + variation * 0.36
        this.dummy.scale.set(detailScale, detailScale * (0.75 + tile.moisture * 0.35), detailScale)
        this.dummy.updateMatrix()
        this.groundDetails.setMatrixAt(detailCount, this.dummy.matrix)
        const detailColor = tile.biome === 'rừng'
          ? new THREE.Color(0x3d7b46)
          : tile.biome === 'đồng cỏ'
            ? new THREE.Color(variation > 0.82 ? 0xe8c86c : 0x88ae54)
            : tile.biome === 'bờ cát'
              ? new THREE.Color(0xd9c483)
              : new THREE.Color(0xeaf5fa)
        this.groundDetails.setColorAt(detailCount, detailColor)
        detailCount += 1
      }
    }

    const modeledTreeIds = new Set<number>()
    const modelMatrices: THREE.Matrix4[] = []
    if (this.treeModelLayer) {
      const modelLimit = treeModelInstanceLimit(this.effectiveQuality, this.treeModelLayer.maximumInstances)
      const modelCandidates: TreePlacement[] = []
      const qualityMinimumSpacing = this.effectiveQuality === 'low' ? 1.55 : this.effectiveQuality === 'medium' ? 1.35 : 1.15
      const minimumModelSpacing = Math.max(qualityMinimumSpacing, this.treeModelLayer.minimumSpacing)
      const minimumModelSpacingSquared = minimumModelSpacing * minimumModelSpacing
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

    this.trees.count = treeCount
    this.trunks.count = treeCount
    this.rocks.count = rockCount
    this.resources.count = resourceCount
    this.groundDetails.count = detailCount
    this.trees.instanceMatrix.needsUpdate = true
    this.trunks.instanceMatrix.needsUpdate = true
    this.rocks.instanceMatrix.needsUpdate = true
    this.resources.instanceMatrix.needsUpdate = true
    this.groundDetails.instanceMatrix.needsUpdate = true
    if (this.trees.instanceColor) this.trees.instanceColor.needsUpdate = true
    if (this.groundDetails.instanceColor) this.groundDetails.instanceColor.needsUpdate = true
    this.trees.computeBoundingSphere()
    this.trunks.computeBoundingSphere()
    this.rocks.computeBoundingSphere()
    this.resources.computeBoundingSphere()
    this.groundDetails.computeBoundingSphere()
  }

  private updateSettlementInstances(): void {
    let houseCount = 0
    let farmCount = 0
    let roadCount = 0
    let lanternCount = 0
    let settlerCount = 0
    const seed = seedToUint32(this.world.config.seed)
    const settings = qualitySettings(this.effectiveQuality)

    for (const village of this.simulation.villages) {
      const home = this.world.tiles[village.tileIndex]
      if (!home) continue
      const base = this.tilePosition(home)
      const localSeed = seed ^ seedToUint32(village.id)

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
        this.roofs.setMatrixAt(houseCount, this.dummy.matrix)
        houseCount += 1
      }

      if (village.era !== 'Mầm lửa') {
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

      if (village.era !== 'Mầm lửa' && village.population >= 12) {
        const lanternsForVillage = Math.min(4, Math.floor(village.population / 18) + 1)
        const visibleLanterns = Math.ceil(lanternsForVillage * settings.settlementDensity)
        for (let index = 0; index < visibleLanterns && lanternCount < MAX_LANTERNS; index += 1) {
          const angle = hash2d(localSeed, index, 53) * Math.PI * 2
          const radius = 0.42 + (index % 2) * 0.42
          this.dummy.position.set(base.x + Math.cos(angle) * radius, base.y + 0.51, base.z + Math.sin(angle) * radius)
          this.dummy.rotation.set(0, 0, 0)
          this.dummy.scale.setScalar(0.9 + (index % 2) * 0.18)
          this.dummy.updateMatrix()
          this.lanterns.setMatrixAt(lanternCount, this.dummy.matrix)
          lanternCount += 1
        }
      }

      const visibleResidents = Math.min(village.population, settings.maxSettlers)
      for (let index = 0; index < visibleResidents && settlerCount < MAX_SETTLERS; index += 1) {
        const orbit = ((this.simulation.tick * 0.045 + hash2d(localSeed, index, 2)) % 1) * Math.PI * 2
        const radius = 0.2 + (index % 6) * 0.095
        this.dummy.position.set(base.x + Math.cos(orbit) * radius, base.y + 0.13, base.z + Math.sin(orbit) * radius)
        this.dummy.rotation.set(0, orbit, 0)
        this.dummy.scale.setScalar(0.9 + (index % 3) * 0.12)
        this.dummy.updateMatrix()
        this.settlers.setMatrixAt(settlerCount, this.dummy.matrix)
        this.settlers.setColorAt(settlerCount, new THREE.Color(index % 2 === 0 ? 0xf4d6a4 : 0x8eb5d1))
        settlerCount += 1
      }
    }

    this.houses.count = houseCount
    this.roofs.count = houseCount
    this.farms.count = farmCount
    this.roads.count = roadCount
    this.lanterns.count = lanternCount
    this.settlers.count = settlerCount
    this.houses.instanceMatrix.needsUpdate = true
    this.roofs.instanceMatrix.needsUpdate = true
    this.farms.instanceMatrix.needsUpdate = true
    this.roads.instanceMatrix.needsUpdate = true
    this.lanterns.instanceMatrix.needsUpdate = true
    this.settlers.instanceMatrix.needsUpdate = true
    if (this.settlers.instanceColor) this.settlers.instanceColor.needsUpdate = true
    this.houses.computeBoundingSphere()
    this.roofs.computeBoundingSphere()
    this.farms.computeBoundingSphere()
    this.roads.computeBoundingSphere()
    this.lanterns.computeBoundingSphere()
    this.settlers.computeBoundingSphere()
  }

  private createClouds(): void {
    const random = createPrng(`${this.world.config.seed}-clouds`)
    const cloudCount = qualitySettings(this.effectiveQuality).cloudCount
    this.cloudGeometry = new THREE.DodecahedronGeometry(0.58, 1)
    this.cloudMaterial = new THREE.MeshStandardMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.26, flatShading: true, roughness: 0.92, depthWrite: false })
    this.cloudMesh = new THREE.InstancedMesh(this.cloudGeometry, this.cloudMaterial, cloudCount * 3)
    this.cloudMesh.count = cloudCount * 3
    // The cloud mesh moves as a single batch, so culling a stale instance bound would pop it in and out of view.
    this.cloudMesh.frustumCulled = false

    for (let index = 0; index < cloudCount; index += 1) {
      const baseX = random.range(-11, 11)
      const baseZ = random.range(-9, 9)
      this.clouds.push({ baseX, baseZ, altitude: random.range(4.8, 7.2), speed: random.range(0.06, 0.14), variation: random.next() })
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
  }

  /** Packs every cloud puff into one instanced draw call while keeping seed-stable variation. */
  private updateCloudMatrices(animate = true): void {
    const cloudMesh = this.cloudMesh
    if (!cloudMesh) return
    const worldWidth = this.world.config.size * TILE_SCALE

    this.clouds.forEach((cloud, cloudIndex) => {
      const x = animate
        ? ((cloud.baseX + this.elapsed * cloud.speed * 2 + worldWidth / 2) % (worldWidth + 8)) - worldWidth / 2 - 4
        : cloud.baseX
      const z = animate ? cloud.baseZ + Math.sin(this.elapsed * cloud.speed) * 0.24 : cloud.baseZ

      for (let puff = 0; puff < 3; puff += 1) {
        const offset = (cloud.variation + puff * 0.31) % 1
        const depthOffset = (cloud.variation + puff * 0.53) % 1
        const heightOffset = (cloud.variation + puff * 0.17) % 1
        this.dummy.position.set(x + (puff - 1) * 0.36, cloud.altitude + (offset - 0.5) * 0.26, z + (depthOffset - 0.5) * 0.16)
        this.dummy.rotation.set(0, 0, 0)
        this.dummy.scale.set(0.95 + offset * 0.5, 0.45 + heightOffset * 0.22, 0.72 + depthOffset * 0.3)
        this.dummy.updateMatrix()
        cloudMesh.setMatrixAt(cloudIndex * 3 + puff, this.dummy.matrix)
      }
    })

    cloudMesh.instanceMatrix.needsUpdate = true
  }

  private tilePosition(tile: Tile): { x: number; y: number; z: number } {
    const half = (this.world.config.size - 1) / 2
    return { x: (tile.x - half) * TILE_SCALE, y: tile.height, z: (tile.z - half) * TILE_SCALE }
  }

  private updateSky(delta: number, reducedMotion: boolean): void {
    const phase = (this.simulation.tick % 96) / 96
    const sunArc = Math.sin(phase * Math.PI * 2)
    const daylight = clamp(sunArc * 0.8 + 0.45, 0.14, 1)
    const storm = this.simulation.activeStorm
    const stormStrength = storm ? clamp(storm.intensity / 2.2, 0, 0.78) : 0
    const sky = this.skyColor.copy(NIGHT_SKY).lerp(DAY_SKY, daylight)
    if (stormStrength > 0) sky.lerp(STORM_SKY, 0.46 * stormStrength)
    const fog = this.scene.fog
    this.scene.background = sky
    if (fog) fog.color.copy(sky)
    this.skyLight.intensity = (0.42 + daylight * 1.15) * (1 - stormStrength * 0.26)
    this.skyLight.color.setHSL(0.58, 0.5, 0.3 + daylight * 0.42)
    this.sun.intensity = (0.3 + daylight * 2.1) * (1 - stormStrength * 0.44)
    this.sun.color.setHSL(0.1, 0.65, 0.55 + daylight * 0.25)
    this.sun.position.set(Math.cos(phase * Math.PI * 2) * 13, 6 + daylight * 15, Math.sin(phase * Math.PI * 2) * 12)
    this.waterMaterial.opacity = 0.52 + daylight * 0.24
    this.cloudMaterial?.color.copy(stormStrength > 0 ? STORM_CLOUD : CLEAR_CLOUD)
    this.water.position.y = getWaterLevel(this.world.config) + 0.016 + Math.sin(this.elapsed * 1.5) * 0.006
    if (!reducedMotion) {
      this.waterWaveFrame += 1
      if (this.waterWaveFrame % qualitySettings(this.effectiveQuality).waterWaveInterval === 0) this.updateWaterSurface()
      this.updateCloudMatrices()
    }

    this.rain.visible = Boolean(storm) && !reducedMotion
    if (!storm || reducedMotion) return
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

  /** A subtle, deterministic low-poly ripple gives the water a living surface without a texture download. */
  private updateWaterSurface(): void {
    const positions = this.water.geometry.getAttribute('position') as THREE.BufferAttribute
    const amplitude = this.simulation.activeStorm ? 0.042 : 0.012

    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index)
      const z = positions.getZ(index)
      const ripple = Math.sin(x * 2.4 + this.elapsed * 1.75) + Math.cos(z * 2.8 - this.elapsed * 1.25)
      positions.setY(index, ripple * amplitude)
    }

    positions.needsUpdate = true
    if (this.waterWaveFrame % qualitySettings(this.effectiveQuality).waterNormalInterval === 0) this.water.geometry.computeVertexNormals()
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
    const settings = qualitySettings(this.effectiveQuality)
    const mobileCap = isMobileViewport() ? Math.min(settings.maxDpr, 1.5) : settings.maxDpr
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobileCap))
    this.renderer.setSize(width, height, false)
  }

  private refreshWaterGeometryForQuality(): void {
    const nextSegments = waterSegmentsFor(this.effectiveQuality, this.world.config.size)
    if (nextSegments === this.waterSegments) return

    const waterSize = Math.max(2, (this.world.config.size - 1) * TILE_SCALE)
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
    this.refreshCloudQuality()
    this.updateStaticInstances()
    this.updateSettlementInstances()
  }

  private applyQuality(): void {
    const settings = qualitySettings(this.effectiveQuality)
    this.renderer.shadowMap.enabled = settings.shadows
    this.sun.castShadow = settings.shadows
    this.sun.shadow.mapSize.set(settings.shadowMapSize, settings.shadowMapSize)
    this.renderer.shadowMap.needsUpdate = true
    this.rainGeometry.setDrawRange(0, settings.rainDropCount * 2)
    this.waterMaterial.roughness = settings.shadows ? 0.24 : 0.34
    this.waterMaterial.metalness = settings.shadows ? 0.12 : 0.05
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
    this.renderer.setAnimationLoop(document.hidden ? null : this.renderFrame)
  }

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault()
    this.renderer.setAnimationLoop(null)
    this.callbacks.onWebGlError('Đồ họa 3D đã mất kết nối. Hãy dùng nút “Thử lại đồ họa 3D” để dựng lại bản đồ.')
  }

  private readonly renderFrame = (timestamp: number): void => {
    if (!this.previousFrame) this.previousFrame = timestamp
    const delta = Math.min((timestamp - this.previousFrame) / 1000, 0.1)
    this.previousFrame = timestamp
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const motionDelta = reducedMotion ? 0 : delta
    this.elapsed += motionDelta
    this.statsElapsed += delta
    this.framesSinceStats += 1
    this.updateSky(motionDelta, reducedMotion)
    this.controls.update()
    this.renderer.render(this.scene, this.camera)

    if (this.statsElapsed >= 0.9) {
      const info = this.renderer.info
      const fps = Math.round(this.framesSinceStats / this.statsElapsed)
      const nextQuality = this.capQualityForViewport(effectiveQualityFor(this.qualityProfile, fps, this.effectiveQuality))
      if (nextQuality !== this.effectiveQuality && canApplyAutoQualityChange(timestamp, this.lastQualityChangeAt)) {
        this.effectiveQuality = nextQuality
        this.lastQualityChangeAt = timestamp
        this.refreshQualityDependentScene()
      }
      this.callbacks.onStats({
        fps,
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        textures: info.memory.textures,
        assetLoadDurationMs: Math.round(this.assetPackManager.loadDurationMs),
        assetPack: this.assetPackManager.currentSelection?.selectedPack ?? 'procedural',
        assetPackFallback: (this.assetPackManager.currentSelection?.usedFallback ?? true) || this.assetPackManager.loadUsedFallback || this.treeModelFallback,
        assetPackReason: this.assetPackManager.loadUsedFallback
          ? 'The selected Poly Haven pack could not load; procedural materials are active.'
          : this.treeModelFallback
            ? 'Poly Haven materials are active; the tree model could not load, so procedural trees remain visible.'
          : this.assetPackManager.currentSelection?.reason ?? 'No asset pack is active.',
        assetLoadState: this.assetPackManager.loadProgress.state,
      })
      this.statsElapsed = 0
      this.framesSinceStats = 0
    }
  }
}
