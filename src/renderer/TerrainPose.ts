import * as THREE from 'three'
import type { World } from '../world/types'

export const WORLD_UP = new THREE.Vector3(0, 1, 0)

const IK_DIRECTION = new THREE.Vector3()
const IK_BEND = new THREE.Vector3()

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function tileHeight(world: World, x: number, z: number): number {
  const size = world.config.size
  return world.tiles[z * size + x]?.height ?? 0
}

/** Bilinear sampling keeps visual contacts stable while an actor crosses a tile edge. */
export function sampleTerrainHeight(world: World, tileX: number, tileZ: number): number {
  const maximumIndex = world.config.size - 1
  const x = clamp(tileX, 0, maximumIndex)
  const z = clamp(tileZ, 0, maximumIndex)
  const x0 = Math.floor(x)
  const z0 = Math.floor(z)
  const x1 = Math.min(maximumIndex, x0 + 1)
  const z1 = Math.min(maximumIndex, z0 + 1)
  const tx = x - x0
  const tz = z - z0
  const north = THREE.MathUtils.lerp(tileHeight(world, x0, z0), tileHeight(world, x1, z0), tx)
  const south = THREE.MathUtils.lerp(tileHeight(world, x0, z1), tileHeight(world, x1, z1), tx)
  return THREE.MathUtils.lerp(north, south, tz)
}

/** Samples the continuous terrain normal in renderer units. */
export function sampleTerrainNormal(
  world: World,
  tileScale: number,
  tileX: number,
  tileZ: number,
  target: THREE.Vector3,
): THREE.Vector3 {
  const sampleDistance = 0.35
  const left = sampleTerrainHeight(world, tileX - sampleDistance, tileZ)
  const right = sampleTerrainHeight(world, tileX + sampleDistance, tileZ)
  const north = sampleTerrainHeight(world, tileX, tileZ - sampleDistance)
  const south = sampleTerrainHeight(world, tileX, tileZ + sampleDistance)
  const span = sampleDistance * 2 * tileScale
  return target.set(-(right - left) / span, 1, -(south - north) / span).normalize()
}

/** Maps a deterministic tile-space point onto the rendered height field. */
export function sampleTerrainPointAtTile(
  world: World,
  tileScale: number,
  tileX: number,
  tileZ: number,
  positionTarget: THREE.Vector3,
  normalTarget: THREE.Vector3,
): void {
  const halfWorldSize = (world.config.size - 1) / 2
  positionTarget.set(
    (tileX - halfWorldSize) * tileScale,
    sampleTerrainHeight(world, tileX, tileZ),
    (tileZ - halfWorldSize) * tileScale,
  )
  sampleTerrainNormal(world, tileScale, tileX, tileZ, normalTarget)
}

/** Maps an already-rendered scene X/Z coordinate back to the terrain data. */
export function sampleTerrainPointAtScene(
  world: World,
  tileScale: number,
  sceneX: number,
  sceneZ: number,
  positionTarget: THREE.Vector3,
  normalTarget: THREE.Vector3,
): void {
  const halfWorldSize = (world.config.size - 1) / 2
  sampleTerrainPointAtTile(
    world,
    tileScale,
    sceneX / tileScale + halfWorldSize,
    sceneZ / tileScale + halfWorldSize,
    positionTarget,
    normalTarget,
  )
}

/**
 * Finds the knee/elbow of a two-bone chain. The caller places the two visual
 * segments between hip -> knee and knee -> foot, which keeps feet attached to
 * the sampled terrain even on a slope.
 */
export function solveTwoBoneKnee(
  hip: THREE.Vector3,
  foot: THREE.Vector3,
  upperLength: number,
  lowerLength: number,
  bendHint: THREE.Vector3,
  target: THREE.Vector3,
): THREE.Vector3 {
  IK_DIRECTION.subVectors(foot, hip)
  const actualDistance = IK_DIRECTION.length()
  if (actualDistance < 0.0001) return target.copy(hip).addScaledVector(bendHint, upperLength * 0.5)

  IK_DIRECTION.multiplyScalar(1 / actualDistance)
  const minimumReach = Math.abs(upperLength - lowerLength) + 0.0001
  const maximumReach = Math.max(minimumReach, upperLength + lowerLength - 0.0001)
  const distance = clamp(actualDistance, minimumReach, maximumReach)
  const along = (upperLength * upperLength - lowerLength * lowerLength + distance * distance) / (2 * distance)
  const bendHeight = Math.sqrt(Math.max(0, upperLength * upperLength - along * along))

  IK_BEND.copy(bendHint).addScaledVector(IK_DIRECTION, -bendHint.dot(IK_DIRECTION))
  if (IK_BEND.lengthSq() < 0.00001) IK_BEND.crossVectors(IK_DIRECTION, WORLD_UP)
  if (IK_BEND.lengthSq() < 0.00001) IK_BEND.set(1, 0, 0)
  IK_BEND.normalize()

  return target.copy(hip).addScaledVector(IK_DIRECTION, along).addScaledVector(IK_BEND, bendHeight)
}
