import * as THREE from 'three'
import type { VillageToolId } from '../simulation/types'
import type { World } from '../world/types'
import { settlerMotionPose } from './ActorMotion'
import type { SettlerActivity } from './ActorMotion'
import { sampleTerrainPointAtScene, sampleTerrainPointAtTile, solveTwoBoneKnee, WORLD_UP } from './TerrainPose'

export interface SettlerPlacement {
  id: string
  anchorTileX: number
  anchorTileZ: number
  phase: number
  radius: number
  scale: number
  clothingColor: number
  skinColor: number
  tool: VillageToolId
  /** Presentation-only role derived from the deterministic village simulation. */
  activity?: SettlerActivity
}

interface ToolVisual {
  handleScale: number
  headScale: readonly [number, number, number]
  color: number
}

const LOCAL_FORWARD = new THREE.Vector3(0, 0, 1)
const LOCAL_RIGHT = new THREE.Vector3(1, 0, 0)

function toolVisual(tool: VillageToolId): ToolVisual {
  const visuals: Record<VillageToolId, ToolVisual> = {
    'stone-handaxe': { handleScale: 0.84, headScale: [0.82, 0.74, 0.94], color: 0x9da49e },
    'flint-axe': { handleScale: 0.96, headScale: [0.96, 0.82, 1.08], color: 0xd0d2c1 },
    'stone-hoe': { handleScale: 1.08, headScale: [1.14, 0.56, 0.7], color: 0x8f9690 },
    'wooden-plow': { handleScale: 1.28, headScale: [1.34, 0.5, 0.8], color: 0x8c633d },
    'copper-hammer': { handleScale: 0.92, headScale: [1.16, 0.92, 0.92], color: 0xc77946 },
    'bronze-spear': { handleScale: 1.42, headScale: [0.54, 1.46, 0.5], color: 0xd5a651 },
    'iron-anvil': { handleScale: 0.88, headScale: [1.44, 0.88, 0.88], color: 0x63727d },
  }
  return visuals[tool]
}

function createInstancedMesh<G extends THREE.BufferGeometry>(
  geometry: G,
  material: THREE.MeshStandardMaterial,
  capacity: number,
): THREE.InstancedMesh<G, THREE.MeshStandardMaterial> {
  const mesh = new THREE.InstancedMesh(geometry, material, capacity)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.frustumCulled = true
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  mesh.count = 0
  return mesh
}

/**
 * Lightweight biped rig. Each resident keeps two terrain-conforming legs and
 * two animated arms while all residents remain batched in a few draw calls.
 */
export class SettlerLayer {
  private readonly group = new THREE.Group()
  private readonly bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x8eb5d1, flatShading: false, roughness: 0.74 })
  private readonly skinMaterial = new THREE.MeshStandardMaterial({ color: 0xf4d6a4, flatShading: false, roughness: 0.78 })
  private readonly toolMaterial = new THREE.MeshStandardMaterial({ color: 0x8a9299, flatShading: false, roughness: 0.58, metalness: 0.22 })
  private readonly torsoGeometry = new THREE.CapsuleGeometry(0.055, 0.13, 4, 12)
  private readonly headGeometry = new THREE.SphereGeometry(0.065, 14, 10)
  private readonly limbGeometry = new THREE.CylinderGeometry(1, 1, 1, 10)
  private readonly toolHandleGeometry = new THREE.CylinderGeometry(0.012, 0.016, 0.32, 8)
  private readonly toolHeadGeometry = new THREE.BoxGeometry(0.1, 0.07, 0.06)
  private readonly bodies: THREE.InstancedMesh<THREE.CapsuleGeometry, THREE.MeshStandardMaterial>
  private readonly heads: THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>
  private readonly legs: THREE.InstancedMesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>
  private readonly arms: THREE.InstancedMesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>
  private readonly toolHandles: THREE.InstancedMesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>
  private readonly toolHeads: THREE.InstancedMesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>
  private readonly dummy = new THREE.Object3D()
  private readonly rootPosition = new THREE.Vector3()
  private readonly surfaceNormal = new THREE.Vector3()
  private readonly footPosition = new THREE.Vector3()
  private readonly footNormal = new THREE.Vector3()
  private readonly hipPosition = new THREE.Vector3()
  private readonly kneePosition = new THREE.Vector3()
  private readonly shoulderPosition = new THREE.Vector3()
  private readonly handPosition = new THREE.Vector3()
  private readonly rootQuaternion = new THREE.Quaternion()
  private readonly slopeQuaternion = new THREE.Quaternion()
  private readonly yawQuaternion = new THREE.Quaternion()
  private readonly limbDirection = new THREE.Vector3()
  private readonly bendHint = new THREE.Vector3()
  private readonly forward = new THREE.Vector3()
  private readonly side = new THREE.Vector3()
  private readonly color = new THREE.Color()
  private attachedScene: THREE.Scene | undefined
  private world: World | undefined
  private placements: readonly SettlerPlacement[] = []
  private disposed = false

  public constructor(private readonly tileScale: number, private readonly capacity = 180) {
    this.group.name = 'aetheria-instanced-settlers'
    this.group.visible = false
    this.torsoGeometry.translate(0, 0.29, 0)
    this.bodies = createInstancedMesh(this.torsoGeometry, this.bodyMaterial, capacity)
    this.heads = createInstancedMesh(this.headGeometry, this.skinMaterial, capacity)
    this.legs = createInstancedMesh(this.limbGeometry, this.bodyMaterial, capacity * 4)
    this.arms = createInstancedMesh(this.limbGeometry, this.bodyMaterial, capacity * 2)
    this.toolHandles = createInstancedMesh(this.toolHandleGeometry, this.bodyMaterial, capacity)
    this.toolHeads = createInstancedMesh(this.toolHeadGeometry, this.toolMaterial, capacity)
    this.bodies.name = 'aetheria-settler-bodies'
    this.legs.name = 'aetheria-settler-ik-legs'
    this.group.add(this.bodies, this.heads, this.legs, this.arms, this.toolHandles, this.toolHeads)
  }

  public attach(scene: THREE.Scene): void {
    if (this.disposed || this.attachedScene === scene) return
    this.detach()
    scene.add(this.group)
    this.attachedScene = scene
  }

  public detach(): void {
    this.attachedScene?.remove(this.group)
    this.attachedScene = undefined
  }

  public setSettlers(world: World, placements: readonly SettlerPlacement[]): void {
    if (this.disposed) return
    this.world = world
    this.placements = placements.slice(0, this.capacity)
    this.updateMatrices(0, true, true)
  }

  public update(elapsed: number, reducedMotion: boolean): void {
    this.updateMatrices(elapsed, reducedMotion, false)
  }

  public dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.detach()
    this.torsoGeometry.dispose()
    this.headGeometry.dispose()
    this.limbGeometry.dispose()
    this.toolHandleGeometry.dispose()
    this.toolHeadGeometry.dispose()
    this.bodyMaterial.dispose()
    this.skinMaterial.dispose()
    this.toolMaterial.dispose()
    this.group.clear()
  }

  private updateMatrices(elapsed: number, reducedMotion: boolean, updateColors: boolean): void {
    if (this.disposed || !this.world) return
    for (let index = 0; index < this.placements.length; index += 1) {
      const settler = this.placements[index]
      if (!settler) continue
      const pose = settlerMotionPose(settler, elapsed, reducedMotion)
      const tileX = pose.tileX
      const tileZ = pose.tileZ
      const heading = pose.heading
      const walking = pose.movement > 0.26
      const gait = reducedMotion ? 0 : Math.sin(elapsed * (walking ? 5.6 : 3.4) + settler.phase)

      sampleTerrainPointAtTile(this.world, this.tileScale, tileX, tileZ, this.rootPosition, this.surfaceNormal)
      this.rootPosition.y += reducedMotion ? 0 : Math.abs(gait) * 0.014 * settler.scale
      this.setRootOrientation(this.surfaceNormal, heading)
      this.forward.copy(LOCAL_FORWARD).applyQuaternion(this.rootQuaternion).normalize()
      this.side.copy(LOCAL_RIGHT).applyQuaternion(this.rootQuaternion).normalize()

      this.dummy.position.copy(this.rootPosition)
      this.dummy.quaternion.copy(this.rootQuaternion)
      this.dummy.scale.setScalar(settler.scale)
      this.dummy.updateMatrix()
      this.bodies.setMatrixAt(index, this.dummy.matrix)

      this.dummy.position.set(0, 0.49 * settler.scale, 0).applyQuaternion(this.rootQuaternion).add(this.rootPosition)
      this.dummy.quaternion.copy(this.rootQuaternion)
      this.dummy.scale.setScalar(settler.scale)
      this.dummy.updateMatrix()
      this.heads.setMatrixAt(index, this.dummy.matrix)

      if (updateColors) {
        this.color.setHex(settler.clothingColor)
        this.bodies.setColorAt(index, this.color)
        this.legs.setColorAt(index * 4, this.color)
        this.legs.setColorAt(index * 4 + 1, this.color)
        this.legs.setColorAt(index * 4 + 2, this.color)
        this.legs.setColorAt(index * 4 + 3, this.color)
        this.arms.setColorAt(index * 2, this.color)
        this.arms.setColorAt(index * 2 + 1, this.color)
        this.toolHandles.setColorAt(index, this.color)
        this.color.setHex(settler.skinColor)
        this.heads.setColorAt(index, this.color)
      }

      this.updateLeg(index, -1, gait, settler.scale)
      this.updateLeg(index, 1, -gait, settler.scale)
      this.updateArmsAndTool(index, settler, gait, pose.workPulse, walking, updateColors)
    }

    const count = this.placements.length
    this.bodies.count = count
    this.heads.count = count
    this.legs.count = count * 4
    this.arms.count = count * 2
    this.toolHandles.count = count
    this.toolHeads.count = count
    for (const mesh of [this.bodies, this.heads, this.legs, this.arms, this.toolHandles, this.toolHeads]) mesh.instanceMatrix.needsUpdate = true
    if (updateColors) {
      if (this.bodies.instanceColor) this.bodies.instanceColor.needsUpdate = true
      if (this.heads.instanceColor) this.heads.instanceColor.needsUpdate = true
      if (this.legs.instanceColor) this.legs.instanceColor.needsUpdate = true
      if (this.arms.instanceColor) this.arms.instanceColor.needsUpdate = true
      if (this.toolHandles.instanceColor) this.toolHandles.instanceColor.needsUpdate = true
      if (this.toolHeads.instanceColor) this.toolHeads.instanceColor.needsUpdate = true
      for (const mesh of [this.bodies, this.heads, this.legs, this.arms, this.toolHandles, this.toolHeads]) mesh.computeBoundingSphere()
    }
  }

  private updateLeg(index: number, sideSign: -1 | 1, gait: number, scale: number): void {
    if (!this.world) return
    const stride = gait * 0.075 * scale
    const lift = Math.max(0, gait) * 0.065 * scale
    this.hipPosition.set(sideSign * 0.042 * scale, 0.2 * scale, 0).applyQuaternion(this.rootQuaternion).add(this.rootPosition)
    this.footPosition
      .set(sideSign * 0.055 * scale, 0, stride)
      .applyQuaternion(this.rootQuaternion)
      .add(this.rootPosition)
    sampleTerrainPointAtScene(this.world, this.tileScale, this.footPosition.x, this.footPosition.z, this.footPosition, this.footNormal)
    this.footPosition.y += lift + 0.01
    this.bendHint.copy(this.forward).addScaledVector(this.side, sideSign * 0.35).normalize()
    solveTwoBoneKnee(this.hipPosition, this.footPosition, 0.14 * scale, 0.145 * scale, this.bendHint, this.kneePosition)
    const segmentIndex = index * 4 + (sideSign < 0 ? 0 : 2)
    this.setSegmentMatrix(this.legs, segmentIndex, this.hipPosition, this.kneePosition, 0.021 * scale)
    this.setSegmentMatrix(this.legs, segmentIndex + 1, this.kneePosition, this.footPosition, 0.018 * scale)
  }

  private updateArmsAndTool(
    index: number,
    settler: SettlerPlacement,
    gait: number,
    workPulse: number,
    walking: boolean,
    updateColors: boolean,
  ): void {
    const visual = toolVisual(settler.tool)
    const working = settler.activity === 'farm' || settler.activity === 'craft'
    for (const sideSign of [-1, 1] as const) {
      const swing = working
        ? sideSign < 0 ? workPulse * 0.32 : -workPulse
        : walking ? sideSign < 0 ? -gait : gait * 0.32 : gait * 0.16
      this.shoulderPosition.set(sideSign * 0.082 * settler.scale, 0.39 * settler.scale, 0).applyQuaternion(this.rootQuaternion).add(this.rootPosition)
      this.handPosition
        .set(sideSign * 0.13 * settler.scale, (0.24 - swing * 0.035) * settler.scale, swing * 0.075 * settler.scale)
        .applyQuaternion(this.rootQuaternion)
        .add(this.rootPosition)
      this.setSegmentMatrix(this.arms, index * 2 + (sideSign < 0 ? 0 : 1), this.shoulderPosition, this.handPosition, 0.018 * settler.scale)

      if (sideSign > 0) {
        this.dummy.position.copy(this.handPosition).addScaledVector(this.forward, 0.018 * settler.scale)
        this.dummy.quaternion.copy(this.rootQuaternion)
        this.dummy.rotateZ(0.54)
        this.dummy.scale.set(1, visual.handleScale * settler.scale, 1)
        this.dummy.updateMatrix()
        this.toolHandles.setMatrixAt(index, this.dummy.matrix)

        this.dummy.position.copy(this.handPosition).addScaledVector(this.forward, (0.09 + visual.handleScale * 0.08) * settler.scale)
        this.dummy.quaternion.copy(this.rootQuaternion)
        this.dummy.rotateZ(0.2)
        this.dummy.scale.set(...visual.headScale).multiplyScalar(settler.scale)
        this.dummy.updateMatrix()
        this.toolHeads.setMatrixAt(index, this.dummy.matrix)
        if (updateColors) {
          this.color.setHex(visual.color)
          this.toolHeads.setColorAt(index, this.color)
        }
      }
    }
  }

  private setRootOrientation(normal: THREE.Vector3, heading: number): void {
    this.slopeQuaternion.setFromUnitVectors(WORLD_UP, normal)
    this.yawQuaternion.setFromAxisAngle(WORLD_UP, heading)
    this.rootQuaternion.copy(this.slopeQuaternion).multiply(this.yawQuaternion)
  }

  private setSegmentMatrix(
    mesh: THREE.InstancedMesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>,
    index: number,
    start: THREE.Vector3,
    end: THREE.Vector3,
    radius: number,
  ): void {
    this.dummy.position.copy(start).lerp(end, 0.5)
    this.limbDirection.subVectors(end, start)
    const length = Math.max(this.limbDirection.length(), 0.001)
    this.limbDirection.multiplyScalar(1 / length)
    this.dummy.quaternion.setFromUnitVectors(WORLD_UP, this.limbDirection)
    this.dummy.scale.set(radius, length, radius)
    this.dummy.updateMatrix()
    mesh.setMatrixAt(index, this.dummy.matrix)
  }
}
