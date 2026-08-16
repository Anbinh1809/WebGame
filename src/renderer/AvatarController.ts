import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { Tile, World } from '../world/types'
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

    const haloGeo = new THREE.RingGeometry(0.18, 0.28, 32)
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
    this.auraHalo.position.set(0, 0.03, 0)

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

  public enter(world: World, tileIndexOrX?: number, maybeZ?: number): void {
    let tile: Tile | undefined
    if (tileIndexOrX !== undefined && maybeZ !== undefined) {
      tile = world.tiles[maybeZ * world.config.size + tileIndexOrX]
    } else if (tileIndexOrX !== undefined) {
      tile = world.tiles[tileIndexOrX]
    }
    tile = tile ?? world.tiles[Math.floor(world.tiles.length / 2)] ?? world.tiles[0]
    if (!tile) return
    this.active = true
    this.position.set(tile.x * this.tileScale, Math.max(0.12, tile.height) + 0.1, tile.z * this.tileScale)
    this.velocity.set(0, 0, 0)
    this.heading = 0
    this.pitch = 0.15
    this.speed = 0
    this.stamina = this.maxStamina
    this.group.position.copy(this.position)
    this.group.visible = true
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

  public handleKeyUp(code: string): void {
    switch (code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = false
        break
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = false
        break
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = false
        break
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = false
        break
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.sprint = false
        break
      case 'Space':
        this.keys.jump = false
        break
    }
  }

  public handleMouseMove(movementX: number, movementY: number): void {
    if (!this.active) return
    const sensitivity = 0.0024
    this.heading -= movementX * sensitivity
    this.pitch -= movementY * sensitivity
    this.pitch = Math.max(-0.45, Math.min(0.65, this.pitch))
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

  public update(delta: number, world: World, camera: THREE.Camera): void {
    if (!this.active) return

    const clampedDelta = Math.min(delta, 0.1)

    // Stamina logic
    const isSprinting = this.keys.sprint && this.stamina > 5 && (this.keys.forward || this.keys.backward || this.keys.left || this.keys.right)
    if (isSprinting) {
      this.stamina = Math.max(0, this.stamina - clampedDelta * 18)
    } else {
      this.stamina = Math.min(this.maxStamina, this.stamina + clampedDelta * 12)
    }

    const moveSpeed = isSprinting ? 5.8 : 3.2

    // Direction vector
    const moveDir = new THREE.Vector3()
    if (this.keys.forward) moveDir.z += 1
    if (this.keys.backward) moveDir.z -= 1
    if (this.keys.left) moveDir.x -= 1
    if (this.keys.right) moveDir.x += 1

    if (moveDir.lengthSq() > 0.001) {
      moveDir.normalize()
      // Rotate by heading
      const forwardX = Math.sin(this.heading)
      const forwardZ = Math.cos(this.heading)
      const rightX = Math.cos(this.heading)
      const rightZ = -Math.sin(this.heading)

      const targetVx = (forwardX * moveDir.z + rightX * moveDir.x) * moveSpeed
      const targetVz = (forwardZ * moveDir.z + rightZ * moveDir.x) * moveSpeed

      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, targetVx, clampedDelta * 10)
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetVz, clampedDelta * 10)
    } else {
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, clampedDelta * 12)
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, 0, clampedDelta * 12)
    }

    // Gravity & Jump
    if (!this.isGrounded) {
      this.velocity.y -= 14.5 * clampedDelta
    } else if (this.keys.jump) {
      this.velocity.y = 4.8
      this.isGrounded = false
    }

    // Apply movement
    this.position.x += this.velocity.x * clampedDelta
    this.position.y += this.velocity.y * clampedDelta
    this.position.z += this.velocity.z * clampedDelta

    // World terrain clamping
    const groundPoint = new THREE.Vector3()
    sampleTerrainPointAtScene(world, this.tileScale, this.position.x, this.position.z, groundPoint, this.normalTarget)
    const minHeight = Math.max(0.08, groundPoint.y)

    if (this.position.y <= minHeight) {
      this.position.y = minHeight
      this.velocity.y = 0
      this.isGrounded = true
    } else {
      this.isGrounded = false
    }

    // Update Avatar Group transform
    this.group.position.copy(this.position)
    this.avatarMesh.rotation.y = this.heading

    this.speed = Math.hypot(this.velocity.x, this.velocity.z)

    // Halo pulse animation
    const time = performance.now() * 0.003
    this.auraHalo.scale.setScalar(1 + Math.sin(time) * 0.08)
    this.avatarMixer?.update(clampedDelta)

    // Update Camera
    if (this.perspective === 'third-person') {
      const dist = 1.6
      const eyeHeight = 0.45
      this.cameraTarget.copy(this.position).add(new THREE.Vector3(0, eyeHeight, 0))

      const camX = this.position.x - Math.sin(this.heading) * Math.cos(this.pitch) * dist
      const camY = this.position.y + eyeHeight + Math.sin(this.pitch) * dist + 0.15
      const camZ = this.position.z - Math.cos(this.heading) * Math.cos(this.pitch) * dist

      camera.position.set(camX, Math.max(groundPoint.y + 0.15, camY), camZ)
      camera.lookAt(this.cameraTarget)
    } else {
      const eyeHeight = 0.40
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
    const robeGeo = new THREE.CylinderGeometry(0.06, 0.11, 0.35, 16)
    robeGeo.translate(0, 0.18, 0)
    const robeMat = new THREE.MeshStandardMaterial({
      color: 0xfdfbf7,
      emissive: 0x3d3014,
      emissiveIntensity: 0.4,
      roughness: 0.6,
      metalness: 0.1,
    })
    const robe = new THREE.Mesh(robeGeo, robeMat)

    // Head
    const headGeo = new THREE.SphereGeometry(0.055, 16, 12)
    headGeo.translate(0, 0.40, 0)
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xffe2b8,
      roughness: 0.8,
    })
    const head = new THREE.Mesh(headGeo, headMat)

    // Halo / Divine Crown
    const crownGeo = new THREE.TorusGeometry(0.07, 0.012, 8, 24)
    crownGeo.rotateX(Math.PI / 2)
    crownGeo.translate(0, 0.48, 0)
    const crownMat = new THREE.MeshStandardMaterial({
      color: 0xffdf87,
      emissive: 0xffca3a,
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.8,
    })
    const crown = new THREE.Mesh(crownGeo, crownMat)

    // Staff of Creation
    const staffGeo = new THREE.CylinderGeometry(0.009, 0.012, 0.55, 8)
    staffGeo.translate(0.12, 0.28, 0.05)
    const gemGeo = new THREE.DodecahedronGeometry(0.035, 1)
    gemGeo.translate(0.12, 0.56, 0.05)
    const staffMat = new THREE.MeshStandardMaterial({
      color: 0x8c6239,
      roughness: 0.7,
    })
    const staffMesh = new THREE.Mesh(staffGeo, staffMat)
    const gemMesh = new THREE.Mesh(
      gemGeo,
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
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
