import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { SimulationState } from '../simulation/types'
import { happinessAtTile } from '../simulation/metrics'
import { createPrng, hash2d, seedToUint32 } from '../world/prng'
import { getWaterLevel } from '../world/generator'
import type { HeatmapMode, Tile, ToolId, World } from '../world/types'
import { effectiveQualityFor, qualitySettings } from './quality'
import type { EffectiveQuality, QualityProfile } from './quality'

const TILE_SCALE = 0.72
const MAX_SETTLERS = 180
const MAX_HOUSES = 48
const MAX_RAIN_DROPS = 360
/** Keeps photo mode below a predictable browser/GPU memory budget. */
export const MAX_PHOTO_PIXELS = 8_000_000
const NIGHT_SKY = new THREE.Color(0x172842)
const DAY_SKY = new THREE.Color(0x9ccfe5)
const STORM_SKY = new THREE.Color(0x536b7f)
const CLEAR_CLOUD = new THREE.Color(0xf4fbff)
const STORM_CLOUD = new THREE.Color(0x9eb5c4)

export interface HoveredTile {
  index: number
  tile: Tile
}

export interface RenderStats {
  fps: number
  drawCalls: number
  triangles: number
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
  private readonly terrainMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0.02 })
  private readonly waterMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x287dae,
    transparent: true,
    opacity: 0.74,
    roughness: 0.16,
    metalness: 0.12,
    clearcoat: 0.48,
    reflectivity: 0.62,
    side: THREE.DoubleSide,
  })
  private readonly treeGeometry = new THREE.ConeGeometry(0.26, 0.92, 5)
  private readonly treeMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.88 })
  private readonly trunkGeometry = new THREE.CylinderGeometry(0.045, 0.062, 0.42, 5)
  private readonly trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x62432c, flatShading: true, roughness: 0.94 })
  private readonly rockGeometry = new THREE.DodecahedronGeometry(0.18, 0)
  private readonly rockMaterial = new THREE.MeshStandardMaterial({ color: 0x87909a, flatShading: true, roughness: 0.84, metalness: 0.08 })
  private readonly resourceGeometry = new THREE.ConeGeometry(0.12, 0.45, 5)
  private readonly resourceMaterial = new THREE.MeshStandardMaterial({ color: 0xf4be64, flatShading: true, roughness: 0.47, metalness: 0.36 })
  private readonly houseGeometry = new THREE.BoxGeometry(0.38, 0.32, 0.36)
  private readonly houseMaterial = new THREE.MeshStandardMaterial({ color: 0xb8714e, flatShading: true, roughness: 0.82 })
  private readonly roofGeometry = new THREE.ConeGeometry(0.35, 0.34, 4)
  private readonly roofMaterial = new THREE.MeshStandardMaterial({ color: 0x5e3c34, flatShading: true, roughness: 0.9 })
  private readonly settlerGeometry = new THREE.SphereGeometry(0.09, 7, 5)
  private readonly settlerMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.72 })
  private readonly rainGeometry = new THREE.BufferGeometry()
  private readonly rainMaterial = new THREE.LineBasicMaterial({ color: 0xbdeaff, transparent: true, opacity: 0.84, depthWrite: false, depthTest: false })
  private readonly previewMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.68, side: THREE.DoubleSide })
  private readonly clouds: Array<{ group: THREE.Group; baseX: number; baseZ: number; speed: number }> = []
  private readonly sun = new THREE.DirectionalLight(0xfff0bc, 2.3)
  private readonly skyLight = new THREE.HemisphereLight(0x9bd8ff, 0x4d5539, 1.55)
  private readonly dummy = new THREE.Object3D()
  private readonly skyColor = new THREE.Color()
  /** Two vertices per drop make weather legible as rain streaks while retaining one draw call. */
  private readonly rainPositions = new Float32Array(MAX_RAIN_DROPS * 6)
  private terrain!: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
  private water!: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshPhysicalMaterial>
  private trees!: THREE.InstancedMesh
  private trunks!: THREE.InstancedMesh
  private rocks!: THREE.InstancedMesh
  private resources!: THREE.InstancedMesh
  private houses!: THREE.InstancedMesh
  private roofs!: THREE.InstancedMesh
  private settlers!: THREE.InstancedMesh
  private rain!: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>
  private preview!: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
  private cloudGeometry: THREE.DodecahedronGeometry | undefined
  private cloudMaterial: THREE.MeshStandardMaterial | undefined
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
  private waterWaveFrame = 0

  public constructor(
    private readonly host: HTMLElement,
    world: World,
    simulation: SimulationState,
    private readonly callbacks: RendererCallbacks,
    quality: QualityProfile = 'auto',
  ) {
    if (!WorldRenderer.supportsWebGl()) {
      throw new Error('Trình duyệt này không hỗ trợ WebGL.')
    }

    this.world = world
    this.simulation = simulation
    this.qualityProfile = quality
    this.effectiveQuality = effectiveQualityFor(quality, 60)
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

    if (sizeChanged) {
      this.disposeWorldObjects()
      this.createWorldObjects(world)
      this.controls.target.set(0, 0, 0)
      return
    }

    if (seedChanged) {
      this.disposeClouds()
      this.createClouds()
      this.seedRain()
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
    this.writeTerrain()
  }

  public setQuality(profile: QualityProfile): void {
    this.qualityProfile = profile
    this.effectiveQuality = effectiveQualityFor(profile, 60, this.effectiveQuality)
    this.applyQuality()
    this.resize()
    this.refreshCloudQuality()
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
    this.renderer.setAnimationLoop(null)
    this.resizeObserver.disconnect()
    this.detachInteractions()
    this.disposeWorldObjects()
    this.previewMaterial.dispose()
    this.terrainMaterial.dispose()
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
    this.houseGeometry.dispose()
    this.houseMaterial.dispose()
    this.roofGeometry.dispose()
    this.roofMaterial.dispose()
    this.settlerGeometry.dispose()
    this.settlerMaterial.dispose()
    this.controls.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.scene.clear()
    this.renderer.domElement.remove()
  }

  private createWorldObjects(world: World): void {
    const size = world.config.size
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(size * size * 3)
    const colors = new Float32Array(size * size * 3)
    const indices: number[] = []

    for (let z = 0; z < size - 1; z += 1) {
      for (let x = 0; x < size - 1; x += 1) {
        const first = z * size + x
        indices.push(first, first + size, first + 1, first + 1, first + size, first + size + 1)
      }
    }

    geometry.setIndex(indices)
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    this.terrain = new THREE.Mesh(geometry, this.terrainMaterial)
    this.terrain.receiveShadow = true
    this.terrain.castShadow = false
    this.scene.add(this.terrain)

    const waterSize = Math.max(2, (size - 1) * TILE_SCALE)
    const waterSegments = Math.min(48, Math.max(16, size))
    const waterGeometry = new THREE.PlaneGeometry(waterSize, waterSize, waterSegments, waterSegments)
    waterGeometry.rotateX(-Math.PI / 2)
    this.water = new THREE.Mesh(waterGeometry, this.waterMaterial)
    this.water.position.y = getWaterLevel(world.config) + 0.016
    this.scene.add(this.water)

    const capacity = size * size
    this.trees = new THREE.InstancedMesh(this.treeGeometry, this.treeMaterial, capacity)
    this.trunks = new THREE.InstancedMesh(this.trunkGeometry, this.trunkMaterial, capacity)
    this.rocks = new THREE.InstancedMesh(this.rockGeometry, this.rockMaterial, capacity)
    this.resources = new THREE.InstancedMesh(this.resourceGeometry, this.resourceMaterial, capacity)
    this.houses = new THREE.InstancedMesh(this.houseGeometry, this.houseMaterial, MAX_HOUSES)
    this.roofs = new THREE.InstancedMesh(this.roofGeometry, this.roofMaterial, MAX_HOUSES)
    this.settlers = new THREE.InstancedMesh(this.settlerGeometry, this.settlerMaterial, MAX_SETTLERS)

    for (const object of [this.trees, this.trunks, this.rocks, this.resources, this.houses, this.roofs, this.settlers]) {
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

  private disposeWorldObjects(): void {
    if (this.terrain) {
      this.scene.remove(this.terrain)
      this.terrain.geometry.dispose()
    }
    if (this.water) {
      this.scene.remove(this.water)
      this.water.geometry.dispose()
    }
    for (const object of [this.trees, this.trunks, this.rocks, this.resources, this.houses, this.roofs, this.settlers]) {
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
    const positions = this.terrain.geometry.getAttribute('position') as THREE.BufferAttribute
    const colors = this.terrain.geometry.getAttribute('color') as THREE.BufferAttribute
    const half = (this.world.config.size - 1) / 2

    for (const tile of this.world.tiles) {
      const x = (tile.x - half) * TILE_SCALE
      const z = (tile.z - half) * TILE_SCALE
      positions.setXYZ(tile.index, x, tile.height, z)
      const color = terrainColor(tile, this.heatmap, this.simulation, this.world)
      colors.setXYZ(tile.index, color.r, color.g, color.b)
    }

    positions.needsUpdate = true
    colors.needsUpdate = true
    this.terrain.geometry.computeVertexNormals()
    this.terrain.geometry.computeBoundingSphere()
    this.water.position.y = getWaterLevel(this.world.config) + 0.016
  }

  private updateStaticInstances(): void {
    const seed = seedToUint32(this.world.config.seed)
    let treeCount = 0
    let rockCount = 0
    let resourceCount = 0

    for (const tile of this.world.tiles) {
      const { x, y, z } = this.tilePosition(tile)
      const variation = hash2d(seed, tile.x, tile.z)

      if (tile.forest && treeCount < this.trees.instanceMatrix.count) {
        const treeScaleX = 0.66 + variation * 0.42
        const treeScaleY = 0.72 + hash2d(seed ^ 0x2d3d4f, tile.x, tile.z) * 0.8
        const treeScaleZ = 0.66 + hash2d(seed ^ 0x7a1e3b, tile.z, tile.x) * 0.42
        const treeHeight = 0.92 * treeScaleY
        const trunkHeight = 0.28 + treeScaleY * 0.18
        const rotation = variation * Math.PI * 2

        this.dummy.position.set(x, y + trunkHeight / 2, z)
        this.dummy.rotation.set(0, rotation, 0)
        this.dummy.scale.set(treeScaleX * 0.42, trunkHeight / 0.42, treeScaleZ * 0.42)
        this.dummy.updateMatrix()
        this.trunks.setMatrixAt(treeCount, this.dummy.matrix)

        this.dummy.position.set(x, y + trunkHeight * 0.78 + treeHeight / 2, z)
        this.dummy.rotation.set(0, rotation, 0)
        this.dummy.scale.set(treeScaleX, treeScaleY, treeScaleZ)
        this.dummy.updateMatrix()
        this.trees.setMatrixAt(treeCount, this.dummy.matrix)
        this.trees.setColorAt(treeCount, new THREE.Color(0x2d683d).lerp(new THREE.Color(0x66934b), variation))
        treeCount += 1
      }

      if ((tile.biome === 'đồi' || tile.biome === 'núi' || tile.biome === 'tuyết') && variation > 0.47 && rockCount < this.rocks.instanceMatrix.count) {
        this.dummy.position.set(x, y + 0.08, z)
        this.dummy.rotation.set(variation, variation * 4, 0)
        this.dummy.scale.set(0.64 + variation * 0.72, 0.6 + hash2d(seed ^ 0x66dd11, tile.z, tile.x) * 0.78, 0.64 + hash2d(seed ^ 0x9016a4, tile.x, tile.z) * 0.72)
        this.dummy.updateMatrix()
        this.rocks.setMatrixAt(rockCount, this.dummy.matrix)
        rockCount += 1
      }

      if (tile.resources > 0.73 && tile.biome !== 'biển' && resourceCount < this.resources.instanceMatrix.count) {
        this.dummy.position.set(x + 0.16, y + 0.2, z - 0.1)
        this.dummy.rotation.set(0, variation * 2, 0)
        this.dummy.scale.setScalar(0.66 + tile.resources * 0.46)
        this.dummy.updateMatrix()
        this.resources.setMatrixAt(resourceCount, this.dummy.matrix)
        resourceCount += 1
      }
    }

    this.trees.count = treeCount
    this.trunks.count = treeCount
    this.rocks.count = rockCount
    this.resources.count = resourceCount
    this.trees.instanceMatrix.needsUpdate = true
    this.trunks.instanceMatrix.needsUpdate = true
    this.rocks.instanceMatrix.needsUpdate = true
    this.resources.instanceMatrix.needsUpdate = true
    if (this.trees.instanceColor) this.trees.instanceColor.needsUpdate = true
    this.trees.computeBoundingSphere()
    this.trunks.computeBoundingSphere()
    this.rocks.computeBoundingSphere()
    this.resources.computeBoundingSphere()
  }

  private updateSettlementInstances(): void {
    let houseCount = 0
    let settlerCount = 0
    const seed = seedToUint32(this.world.config.seed)

    for (const village of this.simulation.villages) {
      const home = this.world.tiles[village.tileIndex]
      if (!home) continue
      const base = this.tilePosition(home)
      const localSeed = seed ^ seedToUint32(village.id)

      for (let index = 0; index < village.homes && houseCount < MAX_HOUSES; index += 1) {
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

      const visibleResidents = Math.min(village.population, 70)
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
    this.settlers.count = settlerCount
    this.houses.instanceMatrix.needsUpdate = true
    this.roofs.instanceMatrix.needsUpdate = true
    this.settlers.instanceMatrix.needsUpdate = true
    if (this.settlers.instanceColor) this.settlers.instanceColor.needsUpdate = true
    this.houses.computeBoundingSphere()
    this.roofs.computeBoundingSphere()
    this.settlers.computeBoundingSphere()
  }

  private createClouds(): void {
    const random = createPrng(`${this.world.config.seed}-clouds`)
    this.cloudGeometry = new THREE.DodecahedronGeometry(0.58, 1)
    this.cloudMaterial = new THREE.MeshStandardMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.44, flatShading: true, roughness: 0.92 })

    for (let index = 0; index < qualitySettings(this.effectiveQuality).cloudCount; index += 1) {
      const group = new THREE.Group()
      for (let puff = 0; puff < 3; puff += 1) {
        const cloud = new THREE.Mesh(this.cloudGeometry, this.cloudMaterial)
        cloud.position.set((puff - 1) * 0.36, random.range(-0.13, 0.13), random.range(-0.08, 0.08))
        cloud.scale.set(0.95 + random.next() * 0.5, 0.45 + random.next() * 0.22, 0.72 + random.next() * 0.3)
        group.add(cloud)
      }
      const baseX = random.range(-11, 11)
      const baseZ = random.range(-9, 9)
      group.position.set(baseX, random.range(4.8, 7.2), baseZ)
      this.clouds.push({ group, baseX, baseZ, speed: random.range(0.06, 0.14) })
      this.scene.add(group)
    }
  }

  private disposeClouds(): void {
    for (const cloud of this.clouds) {
      this.scene.remove(cloud.group)
    }
    this.clouds.length = 0
    this.cloudGeometry?.dispose()
    this.cloudMaterial?.dispose()
    this.cloudGeometry = undefined
    this.cloudMaterial = undefined
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
    if (!reducedMotion) this.updateWaterSurface()

    const worldWidth = this.world.config.size * TILE_SCALE
    if (!reducedMotion) {
      for (const cloud of this.clouds) {
        const x = ((cloud.baseX + this.elapsed * cloud.speed * 2 + worldWidth / 2) % (worldWidth + 8)) - worldWidth / 2 - 4
        cloud.group.position.x = x
        cloud.group.position.z = cloud.baseZ + Math.sin(this.elapsed * cloud.speed) * 0.24
      }
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
    this.waterWaveFrame += 1
    if (this.waterWaveFrame % 3 === 0) this.water.geometry.computeVertexNormals()
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

  private applyQuality(): void {
    const settings = qualitySettings(this.effectiveQuality)
    this.renderer.shadowMap.enabled = settings.shadows
    this.sun.castShadow = settings.shadows
    this.sun.shadow.mapSize.set(settings.shadowMapSize, settings.shadowMapSize)
    this.renderer.shadowMap.needsUpdate = true
    this.rainGeometry.setDrawRange(0, settings.rainDropCount * 2)
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
    const hit = this.raycaster.intersectObject(this.terrain, false)[0]
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
      const nextQuality = effectiveQualityFor(this.qualityProfile, fps, this.effectiveQuality)
      if (nextQuality !== this.effectiveQuality) {
        this.effectiveQuality = nextQuality
        this.applyQuality()
        this.resize()
        this.refreshCloudQuality()
      }
      this.callbacks.onStats({
        fps,
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
      })
      this.statsElapsed = 0
      this.framesSinceStats = 0
    }
  }
}
