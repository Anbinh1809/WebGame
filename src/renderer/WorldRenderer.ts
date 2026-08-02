import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { SimulationState } from '../simulation/types'
import { createPrng, hash2d, seedToUint32 } from '../world/prng'
import { getWaterLevel } from '../world/generator'
import type { HeatmapMode, Tile, ToolId, World } from '../world/types'

const TILE_SCALE = 0.72
const MAX_SETTLERS = 180
const MAX_HOUSES = 48
const MAX_RAIN_DROPS = 360

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
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function terrainColor(tile: Tile, mode: HeatmapMode, simulation: SimulationState): THREE.Color {
  if (mode === 'tài nguyên') {
    return new THREE.Color().setHSL(0.08 + tile.resources * 0.28, 0.72, 0.28 + tile.resources * 0.3)
  }

  if (mode === 'hạnh phúc') {
    const village = simulation.villages[0]
    if (!village) return new THREE.Color(0x536069)
    const villageTile = village
    const baseline = village.happiness / 100
    const proximity = Math.max(0, 1 - Math.abs(tile.index - villageTile.tileIndex) / 140)
    const happiness = clamp(baseline * 0.72 + proximity * 0.28, 0, 1)
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

  return new THREE.Color(palette[tile.biome])
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
  private readonly terrainMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })
  private readonly waterMaterial = new THREE.MeshPhongMaterial({
    color: 0x287dae,
    transparent: true,
    opacity: 0.7,
    shininess: 92,
  })
  private readonly treeGeometry = new THREE.ConeGeometry(0.26, 0.92, 5)
  private readonly treeMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })
  private readonly rockGeometry = new THREE.DodecahedronGeometry(0.18, 0)
  private readonly rockMaterial = new THREE.MeshLambertMaterial({ color: 0x87909a, flatShading: true })
  private readonly resourceGeometry = new THREE.ConeGeometry(0.12, 0.45, 5)
  private readonly resourceMaterial = new THREE.MeshLambertMaterial({ color: 0xf4be64, flatShading: true })
  private readonly houseGeometry = new THREE.BoxGeometry(0.38, 0.32, 0.36)
  private readonly houseMaterial = new THREE.MeshLambertMaterial({ color: 0xb8714e, flatShading: true })
  private readonly roofGeometry = new THREE.ConeGeometry(0.35, 0.34, 4)
  private readonly roofMaterial = new THREE.MeshLambertMaterial({ color: 0x5e3c34, flatShading: true })
  private readonly settlerGeometry = new THREE.SphereGeometry(0.09, 7, 5)
  private readonly settlerMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })
  private readonly rainGeometry = new THREE.BufferGeometry()
  private readonly rainMaterial = new THREE.PointsMaterial({ color: 0x9fdfff, size: 0.045, transparent: true, opacity: 0.82 })
  private readonly previewMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.68, side: THREE.DoubleSide })
  private readonly clouds: Array<{ group: THREE.Group; baseX: number; baseZ: number; speed: number }> = []
  private readonly sun = new THREE.DirectionalLight(0xfff0bc, 2.3)
  private readonly skyLight = new THREE.HemisphereLight(0x9bd8ff, 0x4d5539, 1.55)
  private readonly dummy = new THREE.Object3D()
  private readonly rainPositions = new Float32Array(MAX_RAIN_DROPS * 3)
  private terrain!: THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>
  private water!: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshPhongMaterial>
  private trees!: THREE.InstancedMesh
  private rocks!: THREE.InstancedMesh
  private resources!: THREE.InstancedMesh
  private houses!: THREE.InstancedMesh
  private roofs!: THREE.InstancedMesh
  private settlers!: THREE.InstancedMesh
  private rain!: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>
  private preview!: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
  private cloudGeometry: THREE.DodecahedronGeometry | undefined
  private cloudMaterial: THREE.MeshLambertMaterial | undefined
  private world: World
  private simulation: SimulationState
  private heatmap: HeatmapMode = 'địa hình'
  private tool: ToolId = 'raise'
  private elapsed = 0
  private previousFrame = 0
  private statsElapsed = 0
  private framesSinceStats = 0
  private lastHoverTime = 0
  private pointerDown: { x: number; y: number } | undefined

  public constructor(
    private readonly host: HTMLElement,
    world: World,
    simulation: SimulationState,
    private readonly callbacks: RendererCallbacks,
  ) {
    if (!WorldRenderer.supportsWebGl()) {
      throw new Error('Trình duyệt này không hỗ trợ WebGL.')
    }

    this.world = world
    this.simulation = simulation
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
    this.sun.shadow.mapSize.set(1024, 1024)
    this.sun.shadow.camera.near = 1
    this.sun.shadow.camera.far = 45
    this.sun.shadow.camera.left = -15
    this.sun.shadow.camera.right = 15
    this.sun.shadow.camera.top = 15
    this.sun.shadow.camera.bottom = -15
    this.sun.shadow.normalBias = 0.025
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
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
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

  public capturePhoto(): string {
    this.renderer.render(this.scene, this.camera)
    return this.renderer.domElement.toDataURL('image/png')
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
    const waterGeometry = new THREE.PlaneGeometry(waterSize, waterSize, 1, 1)
    waterGeometry.rotateX(-Math.PI / 2)
    this.water = new THREE.Mesh(waterGeometry, this.waterMaterial)
    this.water.position.y = getWaterLevel(world.config) + 0.016
    this.scene.add(this.water)

    const capacity = size * size
    this.trees = new THREE.InstancedMesh(this.treeGeometry, this.treeMaterial, capacity)
    this.rocks = new THREE.InstancedMesh(this.rockGeometry, this.rockMaterial, capacity)
    this.resources = new THREE.InstancedMesh(this.resourceGeometry, this.resourceMaterial, capacity)
    this.houses = new THREE.InstancedMesh(this.houseGeometry, this.houseMaterial, MAX_HOUSES)
    this.roofs = new THREE.InstancedMesh(this.roofGeometry, this.roofMaterial, MAX_HOUSES)
    this.settlers = new THREE.InstancedMesh(this.settlerGeometry, this.settlerMaterial, MAX_SETTLERS)

    for (const object of [this.trees, this.rocks, this.resources, this.houses, this.roofs, this.settlers]) {
      object.castShadow = true
      object.receiveShadow = true
      object.frustumCulled = true
      this.scene.add(object)
    }

    this.rainGeometry.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3))
    this.rain = new THREE.Points(this.rainGeometry, this.rainMaterial)
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
    for (const object of [this.trees, this.rocks, this.resources, this.houses, this.roofs, this.settlers]) {
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
      const color = terrainColor(tile, this.heatmap, this.simulation)
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
        this.dummy.position.set(x, y + 0.36, z)
        this.dummy.rotation.set(0, variation * Math.PI * 2, 0)
        this.dummy.scale.setScalar(0.72 + variation * 0.74)
        this.dummy.updateMatrix()
        this.trees.setMatrixAt(treeCount, this.dummy.matrix)
        this.trees.setColorAt(treeCount, new THREE.Color(0x2d683d).lerp(new THREE.Color(0x66934b), variation))
        treeCount += 1
      }

      if ((tile.biome === 'đồi' || tile.biome === 'núi' || tile.biome === 'tuyết') && variation > 0.47 && rockCount < this.rocks.instanceMatrix.count) {
        this.dummy.position.set(x, y + 0.08, z)
        this.dummy.rotation.set(variation, variation * 4, 0)
        this.dummy.scale.setScalar(0.68 + variation * 0.7)
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
    this.rocks.count = rockCount
    this.resources.count = resourceCount
    this.trees.instanceMatrix.needsUpdate = true
    this.rocks.instanceMatrix.needsUpdate = true
    this.resources.instanceMatrix.needsUpdate = true
    if (this.trees.instanceColor) this.trees.instanceColor.needsUpdate = true
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
        this.dummy.scale.set(0.82, 1, 0.82)
        this.dummy.updateMatrix()
        this.houses.setMatrixAt(houseCount, this.dummy.matrix)

        this.dummy.position.set(x, height + 0.33, z)
        this.dummy.rotation.set(0, angle + Math.PI / 4, 0)
        this.dummy.scale.set(0.86, 1, 0.86)
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
  }

  private createClouds(): void {
    const random = createPrng(`${this.world.config.seed}-clouds`)
    this.cloudGeometry = new THREE.DodecahedronGeometry(0.58, 1)
    this.cloudMaterial = new THREE.MeshLambertMaterial({ color: 0xf4fbff, transparent: true, opacity: 0.48, flatShading: true })

    for (let index = 0; index < 7; index += 1) {
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

  private updateSky(delta: number): void {
    const phase = (this.simulation.tick % 96) / 96
    const sunArc = Math.sin(phase * Math.PI * 2)
    const daylight = clamp(sunArc * 0.8 + 0.45, 0.14, 1)
    const sky = new THREE.Color(0x172842).lerp(new THREE.Color(0x9ccfe5), daylight)
    const fog = this.scene.fog
    this.scene.background = sky
    if (fog) fog.color.copy(sky)
    this.skyLight.intensity = 0.42 + daylight * 1.15
    this.skyLight.color.setHSL(0.58, 0.5, 0.3 + daylight * 0.42)
    this.sun.intensity = 0.3 + daylight * 2.1
    this.sun.color.setHSL(0.1, 0.65, 0.55 + daylight * 0.25)
    this.sun.position.set(Math.cos(phase * Math.PI * 2) * 13, 6 + daylight * 15, Math.sin(phase * Math.PI * 2) * 12)
    this.waterMaterial.opacity = 0.52 + daylight * 0.24
    this.water.position.y = getWaterLevel(this.world.config) + 0.016 + Math.sin(this.elapsed * 1.5) * 0.006

    const worldWidth = this.world.config.size * TILE_SCALE
    for (const cloud of this.clouds) {
      const x = ((cloud.baseX + this.elapsed * cloud.speed * 2 + worldWidth / 2) % (worldWidth + 8)) - worldWidth / 2 - 4
      cloud.group.position.x = x
      cloud.group.position.z = cloud.baseZ + Math.sin(this.elapsed * cloud.speed) * 0.24
    }

    const storm = this.simulation.activeStorm
    this.rain.visible = Boolean(storm)
    if (!storm) return
    const waterHeight = getWaterLevel(this.world.config)
    for (let index = 0; index < MAX_RAIN_DROPS; index += 1) {
      const yIndex = index * 3 + 1
      const currentY = this.rainPositions[yIndex] ?? 0
      const nextY = currentY - delta * (4.8 + (index % 5) * 0.34)
      this.rainPositions[yIndex] = nextY < waterHeight - 0.7 ? 7.2 + (index % 6) * 0.2 : nextY
    }
    const attribute = this.rainGeometry.getAttribute('position') as THREE.BufferAttribute
    attribute.needsUpdate = true
  }

  private seedRain(): void {
    const random = createPrng(`${this.world.config.seed}-rain`)
    const width = this.world.config.size * TILE_SCALE
    for (let index = 0; index < MAX_RAIN_DROPS; index += 1) {
      const position = index * 3
      this.rainPositions[position] = random.range(-width / 2, width / 2)
      this.rainPositions[position + 1] = random.range(0, 7.5)
      this.rainPositions[position + 2] = random.range(-width / 2, width / 2)
    }
  }

  private attachInteractions(): void {
    const canvas = this.renderer.domElement
    canvas.addEventListener('pointermove', this.handlePointerMove)
    canvas.addEventListener('pointerdown', this.handlePointerDown)
    canvas.addEventListener('pointerup', this.handlePointerUp)
    canvas.addEventListener('pointerleave', this.handlePointerLeave)
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
    this.seedRain()
  }

  private detachInteractions(): void {
    const canvas = this.renderer.domElement
    canvas.removeEventListener('pointermove', this.handlePointerMove)
    canvas.removeEventListener('pointerdown', this.handlePointerDown)
    canvas.removeEventListener('pointerup', this.handlePointerUp)
    canvas.removeEventListener('pointerleave', this.handlePointerLeave)
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
  }

  private resize(): void {
    const { width, height } = this.host.getBoundingClientRect()
    if (width === 0 || height === 0) return
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobileViewport() ? 1 : 1.5))
    this.renderer.setSize(width, height, false)
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
      this.callbacks.onTileHover(undefined)
      return
    }
    const position = this.tilePosition(hovered.tile)
    this.preview.visible = true
    this.preview.position.set(position.x, position.y + 0.035, position.z)
    this.callbacks.onTileHover(hovered)
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.pointerDown = { x: event.clientX, y: event.clientY }
  }

  private readonly handlePointerUp = (event: PointerEvent): void => {
    const down = this.pointerDown
    this.pointerDown = undefined
    if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 7) return
    const hovered = this.pickTile(event)
    if (hovered) this.callbacks.onTileActivate(hovered.index)
  }

  private readonly handlePointerLeave = (): void => {
    this.preview.visible = false
    this.callbacks.onTileHover(undefined)
  }

  private readonly handleVisibilityChange = (): void => {
    this.previousFrame = 0
  }

  private readonly renderFrame = (timestamp: number): void => {
    if (!this.previousFrame) this.previousFrame = timestamp
    const delta = Math.min((timestamp - this.previousFrame) / 1000, 0.1)
    this.previousFrame = timestamp
    this.elapsed += delta
    this.statsElapsed += delta
    this.framesSinceStats += 1
    this.updateSky(delta)
    this.controls.update()
    this.renderer.render(this.scene, this.camera)

    if (this.statsElapsed >= 0.9) {
      const info = this.renderer.info
      this.callbacks.onStats({
        fps: Math.round(this.framesSinceStats / this.statsElapsed),
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
      })
      this.statsElapsed = 0
      this.framesSinceStats = 0
    }
  }
}
