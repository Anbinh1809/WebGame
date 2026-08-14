import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { FAUNA_SPECIES, generateFauna } from '../world/fauna'
import type { FaunaSpawn, FaunaSpecies } from '../world/fauna'
import type { World } from '../world/types'
import { faunaMotionPose } from './ActorMotion'
import type { EffectiveQuality } from './quality'
import { sampleTerrainPointAtScene, sampleTerrainPointAtTile, solveTwoBoneKnee, WORLD_UP } from './TerrainPose'

interface QuadrupedRig {
  bodyGeometry: THREE.BufferGeometry
  headGeometry: THREE.BufferGeometry
  legGeometry: THREE.CylinderGeometry
  headAnchor: THREE.Vector3
  hips: readonly THREE.Vector3[]
  upperLegLength: number
  lowerLegLength: number
}

interface SpeciesBatch {
  body: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
  head: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | undefined
  legs: THREE.InstancedMesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial> | undefined
  material: THREE.MeshStandardMaterial
  placements: readonly FaunaSpawn[]
  rig: QuadrupedRig | undefined
}

interface FaunaLimits {
  animals: number
  monsters: number
}

const SPECIES_CAPACITY: Record<FaunaSpecies, number> = {
  'hươu-rừng': 28,
  'lợn-rừng': 24,
  'sơn-dương': 24,
  'hồn-cát': 16,
  'thạch-thú': 16,
}

const LOCAL_FORWARD = new THREE.Vector3(0, 0, 1)
const LOCAL_RIGHT = new THREE.Vector3(1, 0, 0)

function faunaLimitsFor(quality: EffectiveQuality): FaunaLimits {
  if (quality === 'low') return { animals: 6, monsters: 1 }
  if (quality === 'medium') return { animals: 12, monsters: 3 }
  if (quality === 'high') return { animals: 20, monsters: 6 }
  return { animals: 28, monsters: 10 }
}

function creatureMaterial(species: FaunaSpecies): THREE.MeshStandardMaterial {
  switch (species) {
    case 'hươu-rừng': return new THREE.MeshStandardMaterial({ color: 0xa87545, flatShading: false, roughness: 0.82 })
    case 'lợn-rừng': return new THREE.MeshStandardMaterial({ color: 0x4e392e, flatShading: false, roughness: 0.88 })
    case 'sơn-dương': return new THREE.MeshStandardMaterial({ color: 0x8f8d7b, flatShading: false, roughness: 0.86 })
    case 'hồn-cát': return new THREE.MeshStandardMaterial({ color: 0xe7bd67, emissive: 0x6a3c10, emissiveIntensity: 0.8, transparent: true, opacity: 0.88, flatShading: false, roughness: 0.68, depthWrite: false })
    case 'thạch-thú': return new THREE.MeshStandardMaterial({ color: 0x58636a, emissive: 0x163539, emissiveIntensity: 0.46, flatShading: false, roughness: 0.74, metalness: 0.08 })
  }
}

function transformedPart(
  source: THREE.BufferGeometry,
  scale: readonly [number, number, number],
  position: readonly [number, number, number],
  rotation: readonly [number, number, number] = [0, 0, 0],
): THREE.BufferGeometry {
  const geometry = source.index ? source.toNonIndexed() : source.clone()
  source.dispose()
  geometry.scale(scale[0], scale[1], scale[2])
  geometry.rotateX(rotation[0])
  geometry.rotateY(rotation[1])
  geometry.rotateZ(rotation[2])
  geometry.translate(position[0], position[1], position[2])
  return geometry
}

function mergedCreature(parts: readonly THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries([...parts], false)
  for (const part of parts) part.dispose()
  if (!merged) throw new Error('Could not merge the authored fauna geometry.')
  merged.computeVertexNormals()
  return merged
}

function hornedQuadrupedRig(headScale: readonly [number, number, number], hornHeight: number): QuadrupedRig {
  const bodyGeometry = mergedCreature([
    transformedPart(new THREE.DodecahedronGeometry(0.27, 1), [0.88, 0.52, 1.18], [0, 0.3, -0.035]),
  ])
  const headParts: THREE.BufferGeometry[] = [
    transformedPart(new THREE.DodecahedronGeometry(0.16, 1), headScale, [0, 0, 0]),
    transformedPart(new THREE.ConeGeometry(0.055, 0.14, 10), [1, 1, 1], [-0.09, 0.18, 0.02], [0, 0, -0.24]),
    transformedPart(new THREE.ConeGeometry(0.055, 0.14, 10), [1, 1, 1], [0.09, 0.18, 0.02], [0, 0, 0.24]),
  ]
  if (hornHeight > 0) {
    headParts.push(
      transformedPart(new THREE.CylinderGeometry(0.014, 0.018, hornHeight, 8), [1, 1, 1], [-0.072, 0.23 + hornHeight / 2, 0.02], [0, 0, -0.16]),
      transformedPart(new THREE.CylinderGeometry(0.014, 0.018, hornHeight, 8), [1, 1, 1], [0.072, 0.23 + hornHeight / 2, 0.02], [0, 0, 0.16]),
    )
  }
  return {
    bodyGeometry,
    headGeometry: mergedCreature(headParts),
    legGeometry: new THREE.CylinderGeometry(1, 1, 1, 10),
    headAnchor: new THREE.Vector3(0, 0.39, 0.29),
    hips: [
      new THREE.Vector3(-0.15, 0.3, -0.19),
      new THREE.Vector3(0.15, 0.3, -0.19),
      new THREE.Vector3(-0.15, 0.3, 0.18),
      new THREE.Vector3(0.15, 0.3, 0.18),
    ],
    upperLegLength: 0.22,
    lowerLegLength: 0.23,
  }
}

function boarRig(): QuadrupedRig {
  const bodyGeometry = mergedCreature([
    transformedPart(new THREE.DodecahedronGeometry(0.28, 1), [1.05, 0.58, 1.16], [0, 0.27, -0.045]),
  ])
  const headGeometry = mergedCreature([
    transformedPart(new THREE.DodecahedronGeometry(0.15, 1), [0.86, 0.66, 0.82], [0, 0, 0]),
    transformedPart(new THREE.ConeGeometry(0.07, 0.18, 10), [1, 0.52, 1], [0, -0.02, 0.13], [Math.PI / 2, 0, 0]),
    transformedPart(new THREE.ConeGeometry(0.06, 0.12, 10), [1, 1, 1], [-0.1, 0.17, -0.02], [0, 0, -0.52]),
    transformedPart(new THREE.ConeGeometry(0.06, 0.12, 10), [1, 1, 1], [0.1, 0.17, -0.02], [0, 0, 0.52]),
  ])
  return {
    bodyGeometry,
    headGeometry,
    legGeometry: new THREE.CylinderGeometry(1, 1, 1, 10),
    headAnchor: new THREE.Vector3(0, 0.32, 0.3),
    hips: [
      new THREE.Vector3(-0.16, 0.27, -0.17),
      new THREE.Vector3(0.16, 0.27, -0.17),
      new THREE.Vector3(-0.16, 0.27, 0.16),
      new THREE.Vector3(0.16, 0.27, 0.16),
    ],
    upperLegLength: 0.18,
    lowerLegLength: 0.19,
  }
}

function quadrupedRigFor(species: FaunaSpecies): QuadrupedRig | undefined {
  switch (species) {
    case 'hươu-rừng': return hornedQuadrupedRig([0.72, 0.76, 0.82], 0.14)
    case 'lợn-rừng': return boarRig()
    case 'sơn-dương': return hornedQuadrupedRig([0.78, 0.84, 0.82], 0.23)
    default: return undefined
  }
}

function sandWraithGeometry(): THREE.BufferGeometry {
  return mergedCreature([
    transformedPart(new THREE.ConeGeometry(0.24, 0.62, 14), [1, 1, 1], [0, 0.37, 0], [0, Math.PI / 5, 0]),
    transformedPart(new THREE.DodecahedronGeometry(0.16, 1), [0.92, 0.8, 0.92], [0, 0.68, 0]),
    transformedPart(new THREE.ConeGeometry(0.095, 0.28, 10), [1, 1, 1], [-0.19, 0.38, -0.03], [0, 0, Math.PI / 2]),
    transformedPart(new THREE.ConeGeometry(0.095, 0.28, 10), [1, 1, 1], [0.19, 0.38, -0.03], [0, 0, -Math.PI / 2]),
  ])
}

function stoneBeastGeometry(): THREE.BufferGeometry {
  return mergedCreature([
    transformedPart(new THREE.DodecahedronGeometry(0.28, 1), [0.96, 0.76, 1], [0, 0.31, -0.03]),
    transformedPart(new THREE.DodecahedronGeometry(0.17, 1), [0.88, 0.8, 0.86], [0, 0.37, 0.29]),
    transformedPart(new THREE.ConeGeometry(0.08, 0.2, 10), [1, 1, 1], [-0.14, 0.63, -0.04]),
    transformedPart(new THREE.ConeGeometry(0.08, 0.2, 10), [1, 1, 1], [0.14, 0.63, -0.04]),
    transformedPart(new THREE.DodecahedronGeometry(0.095, 1), [1.1, 0.42, 1], [-0.17, 0.1, -0.17]),
    transformedPart(new THREE.DodecahedronGeometry(0.095, 1), [1.1, 0.42, 1], [0.17, 0.1, -0.17]),
    transformedPart(new THREE.DodecahedronGeometry(0.095, 1), [1.1, 0.42, 1], [-0.17, 0.1, 0.18]),
    transformedPart(new THREE.DodecahedronGeometry(0.095, 1), [1.1, 0.42, 1], [0.17, 0.1, 0.18]),
  ])
}

function creatureGeometry(species: FaunaSpecies): THREE.BufferGeometry {
  return species === 'hồn-cát' ? sandWraithGeometry() : stoneBeastGeometry()
}

function createInstancedMesh<G extends THREE.BufferGeometry>(
  geometry: G,
  material: THREE.MeshStandardMaterial,
  capacity: number,
  castShadow: boolean,
): THREE.InstancedMesh<G, THREE.MeshStandardMaterial> {
  const mesh = new THREE.InstancedMesh(geometry, material, capacity)
  mesh.castShadow = castShadow
  mesh.receiveShadow = true
  mesh.frustumCulled = true
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  mesh.count = 0
  return mesh
}

/**
 * Instanced wildlife with a compact two-bone terrain IK pose for every visible
 * quadruped. The visual rig does not touch deterministic world data or saves.
 */
export class FaunaLayer {
  private readonly group = new THREE.Group()
  private readonly batches = new Map<FaunaSpecies, SpeciesBatch>()
  private readonly dummy = new THREE.Object3D()
  private readonly rootPosition = new THREE.Vector3()
  private readonly surfaceNormal = new THREE.Vector3()
  private readonly footPosition = new THREE.Vector3()
  private readonly footNormal = new THREE.Vector3()
  private readonly hipPosition = new THREE.Vector3()
  private readonly kneePosition = new THREE.Vector3()
  private readonly bendHint = new THREE.Vector3()
  private readonly headPosition = new THREE.Vector3()
  private readonly rootQuaternion = new THREE.Quaternion()
  private readonly slopeQuaternion = new THREE.Quaternion()
  private readonly yawQuaternion = new THREE.Quaternion()
  private readonly headQuaternion = new THREE.Quaternion()
  private readonly forward = new THREE.Vector3()
  private readonly side = new THREE.Vector3()
  private readonly legPhase = [0, Math.PI, Math.PI, 0] as const
  private attachedScene: THREE.Scene | undefined
  private world: World | undefined
  private fleeing = false
  private disposed = false
  private poseTileX = 0
  private poseTileZ = 0
  private poseHeading = 0
  private poseGait = 0

  public constructor(private readonly tileScale: number) {
    this.group.name = 'aetheria-instanced-fauna'
    for (const species of FAUNA_SPECIES) {
      const material = creatureMaterial(species)
      const rig = quadrupedRigFor(species)
      const bodyGeometry = rig?.bodyGeometry ?? creatureGeometry(species)
      const body = createInstancedMesh(bodyGeometry, material, SPECIES_CAPACITY[species], species !== 'hồn-cát')
      body.name = `aetheria-${species}`

      const head = rig
        ? createInstancedMesh(rig.headGeometry, material, SPECIES_CAPACITY[species], true)
        : undefined
      const legs = rig
        ? createInstancedMesh(rig.legGeometry, material, SPECIES_CAPACITY[species] * 8, true)
        : undefined
      if (head) head.name = `aetheria-${species}-head`
      if (legs) legs.name = `aetheria-${species}-ik-legs`

      this.batches.set(species, { body, head, legs, material, placements: [], rig })
      this.group.add(body)
      if (head) this.group.add(head)
      if (legs) this.group.add(legs)
    }
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

  public setWorld(world: World, quality: EffectiveQuality): void {
    if (this.disposed) return
    this.world = world
    const limits = faunaLimitsFor(quality)
    const spawns = generateFauna(world)
    const animals = spawns.filter((spawn) => spawn.category === 'animal').slice(0, limits.animals)
    const monsters = spawns.filter((spawn) => spawn.category === 'monster').slice(0, limits.monsters)
    const selected = [...animals, ...monsters]

    for (const species of FAUNA_SPECIES) {
      const batch = this.batches.get(species)
      if (batch) batch.placements = selected.filter((spawn) => spawn.species === species)
    }
    this.updateMatrices(0, true, true)
  }

  /** Weather changes presentation only; generated fauna positions remain deterministic. */
  public setStormActive(active: boolean): void {
    if (this.fleeing === active) return
    this.fleeing = active
  }

  public update(elapsed: number, reducedMotion: boolean): void {
    this.updateMatrices(elapsed, reducedMotion, false)
  }

  public dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.detach()
    for (const batch of this.batches.values()) {
      batch.body.geometry.dispose()
      batch.head?.geometry.dispose()
      batch.legs?.geometry.dispose()
      batch.material.dispose()
    }
    this.batches.clear()
    this.group.clear()
  }

  private updateMatrices(elapsed: number, reducedMotion: boolean, recomputeBounds: boolean): void {
    if (this.disposed || !this.world) return
    for (const species of FAUNA_SPECIES) {
      const batch = this.batches.get(species)
      if (!batch) continue
      if (batch.rig && batch.head && batch.legs) {
        this.updateQuadrupeds(batch, elapsed, reducedMotion)
      } else {
        this.updateWholeCreatures(batch, species, elapsed, reducedMotion)
      }
      this.finishBatch(batch, recomputeBounds)
    }
  }

  private updateQuadrupeds(batch: SpeciesBatch, elapsed: number, reducedMotion: boolean): void {
    const rig = batch.rig
    const head = batch.head
    const legs = batch.legs
    if (!rig || !head || !legs || !this.world) return

    for (let index = 0; index < batch.placements.length; index += 1) {
      const spawn = batch.placements[index]
      if (!spawn) continue
      this.setWanderPose(spawn, elapsed, reducedMotion)
      sampleTerrainPointAtTile(this.world, this.tileScale, this.poseTileX, this.poseTileZ, this.rootPosition, this.surfaceNormal)
      const bodyBob = reducedMotion ? 0 : Math.abs(this.poseGait) * 0.018 * spawn.scale
      this.rootPosition.y += bodyBob
      this.setRootOrientation(this.surfaceNormal, this.poseHeading)

      const breath = reducedMotion ? 1 : 1 + Math.sin(elapsed * spawn.pace * 2.4 + spawn.phase) * 0.012
      this.dummy.position.copy(this.rootPosition)
      this.dummy.quaternion.copy(this.rootQuaternion)
      this.dummy.scale.setScalar(spawn.scale * breath)
      this.dummy.updateMatrix()
      batch.body.setMatrixAt(index, this.dummy.matrix)

      this.headPosition.copy(rig.headAnchor).multiplyScalar(spawn.scale).applyQuaternion(this.rootQuaternion).add(this.rootPosition)
      this.headQuaternion.setFromAxisAngle(LOCAL_RIGHT, reducedMotion ? 0 : Math.sin(elapsed * spawn.pace * 1.55 + spawn.phase) * 0.14)
      this.dummy.position.copy(this.headPosition)
      this.dummy.quaternion.copy(this.rootQuaternion).multiply(this.headQuaternion)
      this.dummy.scale.setScalar(spawn.scale * breath)
      this.dummy.updateMatrix()
      head.setMatrixAt(index, this.dummy.matrix)

      this.forward.copy(LOCAL_FORWARD).applyQuaternion(this.rootQuaternion).normalize()
      this.side.copy(LOCAL_RIGHT).applyQuaternion(this.rootQuaternion).normalize()
      for (let legIndex = 0; legIndex < rig.hips.length; legIndex += 1) {
        const hip = rig.hips[legIndex]
        if (!hip) continue
        const gait = reducedMotion ? 0 : Math.sin(elapsed * spawn.pace * 7.4 + spawn.phase + (this.legPhase[legIndex] ?? 0))
        const stride = gait * 0.1 * spawn.scale
        const lift = Math.max(0, gait) * 0.075 * spawn.scale

        this.hipPosition.copy(hip).multiplyScalar(spawn.scale).applyQuaternion(this.rootQuaternion).add(this.rootPosition)
        this.footPosition
          .set(hip.x * spawn.scale, 0, (hip.z + stride) * spawn.scale)
          .applyQuaternion(this.rootQuaternion)
          .add(this.rootPosition)
        sampleTerrainPointAtScene(this.world, this.tileScale, this.footPosition.x, this.footPosition.z, this.footPosition, this.footNormal)
        this.footPosition.y += lift + 0.012

        this.bendHint.copy(this.forward).multiplyScalar(hip.z >= 0 ? 1 : -1).addScaledVector(this.side, hip.x * 1.6).normalize()
        solveTwoBoneKnee(
          this.hipPosition,
          this.footPosition,
          rig.upperLegLength * spawn.scale,
          rig.lowerLegLength * spawn.scale,
          this.bendHint,
          this.kneePosition,
        )
        const segmentIndex = index * 8 + legIndex * 2
        this.setSegmentMatrix(legs, segmentIndex, this.hipPosition, this.kneePosition, 0.027 * spawn.scale)
        this.setSegmentMatrix(legs, segmentIndex + 1, this.kneePosition, this.footPosition, 0.023 * spawn.scale)
      }
    }
    batch.body.count = batch.placements.length
    head.count = batch.placements.length
    legs.count = batch.placements.length * 8
  }

  private updateWholeCreatures(batch: SpeciesBatch, species: FaunaSpecies, elapsed: number, reducedMotion: boolean): void {
    if (!this.world) return
    const isWraith = species === 'hồn-cát'
    for (let index = 0; index < batch.placements.length; index += 1) {
      const spawn = batch.placements[index]
      if (!spawn) continue
      this.setWanderPose(spawn, elapsed, reducedMotion)
      sampleTerrainPointAtTile(this.world, this.tileScale, this.poseTileX, this.poseTileZ, this.rootPosition, this.surfaceNormal)
      const hover = isWraith && !reducedMotion ? Math.sin(elapsed * 1.9 + spawn.phase) * 0.08 : 0
      this.rootPosition.y += hover
      if (isWraith) this.rootQuaternion.setFromAxisAngle(WORLD_UP, this.poseHeading)
      else this.setRootOrientation(this.surfaceNormal, this.poseHeading)

      const breath = reducedMotion ? 1 : 1 + Math.sin(elapsed * spawn.pace * 2.4 + spawn.phase) * 0.018
      this.dummy.position.copy(this.rootPosition)
      this.dummy.quaternion.copy(this.rootQuaternion)
      this.dummy.scale.setScalar(spawn.scale * breath)
      this.dummy.updateMatrix()
      batch.body.setMatrixAt(index, this.dummy.matrix)
    }
    batch.body.count = batch.placements.length
  }

  private finishBatch(batch: SpeciesBatch, recomputeBounds: boolean): void {
    batch.body.instanceMatrix.needsUpdate = true
    if (batch.head) batch.head.instanceMatrix.needsUpdate = true
    if (batch.legs) batch.legs.instanceMatrix.needsUpdate = true
    if (!recomputeBounds) return
    batch.body.computeBoundingSphere()
    batch.head?.computeBoundingSphere()
    batch.legs?.computeBoundingSphere()
  }

  /** Gives every animal a small smooth wandering route instead of a tick-by-tick teleport. */
  private setWanderPose(spawn: FaunaSpawn, elapsed: number, reducedMotion: boolean): void {
    const pose = faunaMotionPose(spawn, elapsed, reducedMotion, this.fleeing)
    this.poseTileX = pose.tileX
    this.poseTileZ = pose.tileZ
    this.poseHeading = pose.heading
    this.poseGait = reducedMotion ? 0 : Math.sin(elapsed * spawn.pace * 9.6 + spawn.phase)
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
    this.forward.subVectors(end, start)
    const length = Math.max(this.forward.length(), 0.001)
    this.forward.multiplyScalar(1 / length)
    this.dummy.quaternion.setFromUnitVectors(WORLD_UP, this.forward)
    this.dummy.scale.set(radius, length, radius)
    this.dummy.updateMatrix()
    mesh.setMatrixAt(index, this.dummy.matrix)
  }
}
