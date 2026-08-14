import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { World } from '../world/types'
import { sampleTerrainPointAtScene } from './TerrainPose'

export type AvatarCameraPerspective = 'third-person' | 'first-person'

export interface AvatarState {
  active: boolean
  perspective: AvatarCameraPerspective
  x: number
  y: number
  z: number
  heading: number
  pitch: number
  speed: number
  stamina: number
  maxStamina: number
  nearbyEntity?: {
    name: string
    type: 'villager' | 'monster' | 'nature'
    distance: number
  }
}

export class AvatarController {
  private active = false
  private perspective: AvatarCameraPerspective = 'third-person'
  private readonly position = new THREE.Vector3()
  private readonly velocity = new THREE.Vector3()
  private heading = 0
  private pitch = 0.15
  private speed = 0
  private stamina = 100
  private readonly maxStamina = 100
  private isGrounded = true

  private readonly keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    jump: false,
  }

  private readonly group = new THREE.Group()
  private readonly avatarMesh: THREE.Group
  private avatarMixer: THREE.AnimationMixer | undefined
  private readonly avatarLight: THREE.PointLight
  private readonly auraHalo: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>

  private readonly cameraTarget = new THREE.Vector3()
  private readonly normalTarget = new THREE.Vector3()

  public constructor(private readonly tileScale: number) {
    this.avatarMesh = this.createAvatarMesh()
    this.loadArchangelModel()
    this.avatarLight = new THREE.PointLight(0xffdf87, 2.5, 8, 1.2)
    this.avatarLight.position.set(0, 1.2, 0)

    const haloGeo = new THREE.RingGeometry(0.3, 0.45, 32)
    haloGeo.rotateX(-Math.PI / 2)
    this.auraHalo = new THREE.Mesh(
      haloGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffdf87,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    this.auraHalo.position.set(0, 0.05, 0)

    this.group.add(this.avatarMesh)
    this.group.add(this.avatarLight)
    this.group.add(this.auraHalo)
    this.group.visible = false
  }

  public getRootGroup(): THREE.Group {
    return this.group
  }

  public isActive(): boolean {
    return this.active
  }

  public getPerspective(): AvatarCameraPerspective {
    return this.perspective
  }

  public togglePerspective(): AvatarCameraPerspective {
    this.perspective = this.perspective === 'third-person' ? 'first-person' : 'third-person'
    this.avatarMesh.visible = this.perspective === 'third-person'
    return this.perspective
  }

  public getState(): AvatarState {
    return {
      active: this.active,
      perspective: this.perspective,
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
      heading: this.heading,
      pitch: this.pitch,
      speed: this.speed,
      stamina: this.stamina,
      maxStamina: this.maxStamina,
    }
  }

  public enter(world: World, initialX?: number, initialZ?: number): void {
    this.active = true
    this.group.visible = true
    this.perspective = 'third-person'
    this.avatarMesh.visible = true

    const spawnTileX = initialX ?? Math.floor(world.config.size / 2)
    const spawnTileZ = initialZ ?? Math.floor(world.config.size / 2)
    const spawnSceneX = (spawnTileX - world.config.size / 2 + 0.5) * this.tileScale
    const spawnSceneZ = (spawnTileZ - world.config.size / 2 + 0.5) * this.tileScale

    sampleTerrainPointAtScene(world, spawnSceneX, spawnSceneZ, this.tileScale, this.position, this.normalTarget)
    this.group.position.copy(this.position)
    this.velocity.set(0, 0, 0)
    this.speed = 0
  }

  public exit(): void {
    this.active = false
    this.group.visible = false
    this.resetKeys()
  }

  public handleKeyDown(code: string): boolean {
    if (!this.active) return false
    switch (code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = true
        return true
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = true
        return true
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = true
        return true
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = true
        return true
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.sprint = true
        return true
      case 'Space':
        this.keys.jump = true
        return true
      case 'KeyV':
        this.togglePerspective()
        return true
      default:
        return false
    }
  }

  public handleKeyUp(code: string): boolean {
    if (!this.active) return false
    switch (code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = false
        return true
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = false
        return true
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = false
        return true
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = false
        return true
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.sprint = false
        return true
      case 'Space':
        this.keys.jump = false
        return true
      default:
        return false
    }
  }

  public handleMouseMove(movementX: number, movementY: number): void {
    if (!this.active) return
    const sensitivity = 0.0032
    this.heading -= movementX * sensitivity
    this.pitch -= movementY * sensitivity
    this.pitch = Math.max(-Math.PI / 4, Math.min(Math.PI / 3, this.pitch))
  }

  public update(delta: number, world: World, camera: THREE.PerspectiveCamera): void {
    if (!this.active) return

    const clampedDelta = Math.min(0.1, Math.max(0.001, delta))

    // Handle Movement Input
    let moveForward = 0
    let moveSide = 0
    if (this.keys.forward) moveForward += 1
    if (this.keys.backward) moveForward -= 1
    if (this.keys.right) moveSide += 1
    if (this.keys.left) moveSide -= 1

    const isMoving = moveForward !== 0 || moveSide !== 0
    const isSprinting = this.keys.sprint && isMoving && this.stamina > 5

    if (isSprinting) {
      this.stamina = Math.max(0, this.stamina - clampedDelta * 22)
    } else {
      this.stamina = Math.min(this.maxStamina, this.stamina + clampedDelta * 14)
    }

    const baseMoveSpeed = isSprinting ? 5.2 : 2.8
    if (isMoving) {
      const inputAngle = Math.atan2(moveSide, moveForward)
      const targetAngle = this.heading + inputAngle
      const targetVelX = Math.sin(targetAngle) * baseMoveSpeed
      const targetVelZ = Math.cos(targetAngle) * baseMoveSpeed

      this.velocity.x += (targetVelX - this.velocity.x) * 12 * clampedDelta
      this.velocity.z += (targetVelZ - this.velocity.z) * 12 * clampedDelta
      this.avatarMesh.rotation.y = targetAngle
    } else {
      this.velocity.x *= Math.max(0, 1 - 10 * clampedDelta)
      this.velocity.z *= Math.max(0, 1 - 10 * clampedDelta)
    }

    // Jump / Gravity
    if (this.keys.jump && this.isGrounded) {
      this.velocity.y = 4.2
      this.isGrounded = false
    }

    if (!this.isGrounded) {
      this.velocity.y -= 12 * clampedDelta
    }

    // Apply Position
    this.position.x += this.velocity.x * clampedDelta
    this.position.z += this.velocity.z * clampedDelta
    this.position.y += this.velocity.y * clampedDelta

    // Ground Snapping
    const groundPoint = new THREE.Vector3()
    sampleTerrainPointAtScene(world, this.position.x, this.position.z, this.tileScale, groundPoint, this.normalTarget)

    if (this.position.y <= groundPoint.y + 0.02) {
      this.position.y = groundPoint.y
      this.velocity.y = 0
      this.isGrounded = true
    }

    // World Boundary Clamp
    const halfSize = (world.config.size * this.tileScale) / 2 - 0.5
    this.position.x = Math.max(-halfSize, Math.min(halfSize, this.position.x))
    this.position.z = Math.max(-halfSize, Math.min(halfSize, this.position.z))

    this.group.position.copy(this.position)

    this.speed = Math.hypot(this.velocity.x, this.velocity.z)

    // Halo pulse animation
    const time = performance.now() * 0.003
    this.auraHalo.scale.setScalar(1 + Math.sin(time) * 0.08)
    this.avatarMixer?.update(clampedDelta)

    // Update Camera
    if (this.perspective === 'third-person') {
      const dist = 2.8
      const eyeHeight = 0.95
      this.cameraTarget.copy(this.position).add(new THREE.Vector3(0, eyeHeight, 0))

      const camX = this.position.x - Math.sin(this.heading) * Math.cos(this.pitch) * dist
      const camY = this.position.y + eyeHeight + Math.sin(this.pitch) * dist + 0.3
      const camZ = this.position.z - Math.cos(this.heading) * Math.cos(this.pitch) * dist

      camera.position.set(camX, Math.max(groundPoint.y + 0.3, camY), camZ)
      camera.lookAt(this.cameraTarget)
    } else {
      const eyeHeight = 0.85
      camera.position.set(this.position.x, this.position.y + eyeHeight, this.position.z)
      const lookX = this.position.x + Math.sin(this.heading) * Math.cos(this.pitch) * 10
      const lookY = this.position.y + eyeHeight - Math.sin(this.pitch) * 10
      const lookZ = this.position.z + Math.cos(this.heading) * Math.cos(this.pitch) * 10
      camera.lookAt(lookX, lookY, lookZ)
    }
  }

  private resetKeys(): void {
    this.keys.forward = false
    this.keys.backward = false
    this.keys.left = false
    this.keys.right = false
    this.keys.sprint = false
    this.keys.jump = false
  }

  private createAvatarMesh(): THREE.Group {
    const avatarGroup = new THREE.Group()

    // Robe / Body
    const robeGeo = new THREE.CylinderGeometry(0.12, 0.22, 0.7, 16)
    robeGeo.translate(0, 0.38, 0)
    const robeMat = new THREE.MeshStandardMaterial({
      color: 0xfdfbf7,
      emissive: 0x3d3014,
      emissiveIntensity: 0.4,
      roughness: 0.6,
      metalness: 0.1,
    })
    const robe = new THREE.Mesh(robeGeo, robeMat)

    // Head
    const headGeo = new THREE.SphereGeometry(0.11, 16, 12)
    headGeo.translate(0, 0.82, 0)
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xffe2b8,
      roughness: 0.8,
    })
    const head = new THREE.Mesh(headGeo, headMat)

    // Halo / Divine Crown
    const crownGeo = new THREE.TorusGeometry(0.14, 0.02, 8, 24)
    crownGeo.rotateX(Math.PI / 2)
    crownGeo.translate(0, 0.98, 0)
    const crownMat = new THREE.MeshStandardMaterial({
      color: 0xffdf87,
      emissive: 0xffca3a,
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.8,
    })
    const crown = new THREE.Mesh(crownGeo, crownMat)

    // Staff of Creation
    const staffGeo = new THREE.CylinderGeometry(0.018, 0.022, 1.1, 8)
    staffGeo.translate(0.24, 0.55, 0.1)
    const gemGeo = new THREE.DodecahedronGeometry(0.065, 1)
    gemGeo.translate(0.24, 1.12, 0.1)
    const staffMesh = new THREE.Mesh(
      staffGeo,
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.7 }),
    )
    const gemMesh = new THREE.Mesh(
      gemGeo,
      new THREE.MeshStandardMaterial({
        color: 0x5edeb5,
        emissive: 0x22d3ee,
        emissiveIntensity: 0.9,
        roughness: 0.1,
      }),
    )

    avatarGroup.add(robe)
    avatarGroup.add(head)
    avatarGroup.add(crown)
    avatarGroup.add(staffMesh)
    avatarGroup.add(gemMesh)

    return avatarGroup
  }

  private loadArchangelModel(): void {
    void new GLTFLoader().loadAsync('/assets/models/characters/archangel.glb').then((gltf) => {
      const model = gltf.scene
      model.scale.setScalar(0.55)
      model.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.castShadow = true
          node.receiveShadow = true
        }
      })
      // Clear procedural fallback and add Archangel
      this.avatarMesh.clear()
      this.avatarMesh.add(model)

      const firstClip = gltf.animations[0]
      if (firstClip) {
        this.avatarMixer = new THREE.AnimationMixer(model)
        const action = this.avatarMixer.clipAction(firstClip)
        action.play()
      }
    }).catch(() => {
      // Graceful fallback to procedural divine robe avatar
    })
  }

  public dispose(): void {
    this.exit()
  }
}
