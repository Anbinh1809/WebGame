import * as THREE from 'three'
import type { EffectiveQuality } from './quality'
import { sampleTerrainPointAtTile } from './TerrainPose'
import type { World } from '../world/types'

export interface SpawnedSketchfabEntity {
  id: string
  name: string
  category: string
  tileIndex: number
  x: number
  z: number
  elevation: number
  scale: number
  rotation: number
  colorHex?: string
  modelType: 'creature' | 'flora' | 'titan' | 'structure' | 'relic'
}

export class SketchfabModelLayer {
  public group = new THREE.Group()
  private entities: SpawnedSketchfabEntity[] = []
  private materials: THREE.Material[] = []
  private geometries: THREE.BufferGeometry[] = []

  private readonly tempPos = new THREE.Vector3()
  private readonly tempNorm = new THREE.Vector3()

  constructor(private readonly tileScale = 0.72) {
    this.group.name = 'sketchfab-models-layer'
  }

  public setEntities(entities: SpawnedSketchfabEntity[], world: World, quality: EffectiveQuality): void {
    this.entities = [...entities]
    this.rebuildMeshes(world, quality)
  }

  public addEntity(entity: SpawnedSketchfabEntity, world: World, quality: EffectiveQuality): void {
    this.entities.push(entity)
    this.rebuildMeshes(world, quality)
  }

  public removeEntity(id: string, world: World, quality: EffectiveQuality): void {
    this.entities = this.entities.filter((e) => e.id !== id)
    this.rebuildMeshes(world, quality)
  }

  public getEntities(): readonly SpawnedSketchfabEntity[] {
    return this.entities
  }

  public clear(world: World, quality: EffectiveQuality): void {
    this.entities = []
    this.rebuildMeshes(world, quality)
  }

  private rebuildMeshes(world: World, _quality: EffectiveQuality): void {
    // Clear existing children
    while (this.group.children.length > 0) {
      const child = this.group.children[0]
      if (child) this.group.remove(child)
      else break
    }

    this.disposeResources()

    for (const entity of this.entities) {
      const mesh = this.createEntityMesh(entity, world)
      this.group.add(mesh)
    }
  }

  private createEntityMesh(entity: SpawnedSketchfabEntity, world: World): THREE.Object3D {
    const tile = world.tiles[entity.tileIndex]
    if (tile) {
      sampleTerrainPointAtTile(world, this.tileScale, tile.x, tile.z, this.tempPos, this.tempNorm)
    } else {
      this.tempPos.set(entity.x, entity.elevation, entity.z)
    }
    const root = new THREE.Group()
    root.name = `sketchfab-entity-${entity.id}`
    root.position.copy(this.tempPos)
    root.rotation.y = entity.rotation

    const color = entity.colorHex ? new THREE.Color(entity.colorHex) : this.colorForCategory(entity.modelType)
    const primaryMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.4,
      metalness: entity.modelType === 'relic' ? 0.8 : 0.2,
      emissive: color.clone().multiplyScalar(0.35),
    })
    this.materials.push(primaryMat)

    let bodyGeo: THREE.BufferGeometry
    switch (entity.modelType) {
      case 'titan': {
        // Multi-segmented Golem/Titan shape (realistic scale ~1.15x human)
        const torsoGeo = new THREE.DodecahedronGeometry(0.24 * entity.scale, 1)
        const torso = new THREE.Mesh(torsoGeo, primaryMat)
        torso.position.y = 0.38 * entity.scale
        root.add(torso)
        this.geometries.push(torsoGeo)

        const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 })
        this.materials.push(shoulderMat)
        const armGeo = new THREE.BoxGeometry(0.12 * entity.scale, 0.28 * entity.scale, 0.12 * entity.scale)
        this.geometries.push(armGeo)

        const leftArm = new THREE.Mesh(armGeo, shoulderMat)
        leftArm.position.set(-0.28 * entity.scale, 0.32 * entity.scale, 0)
        root.add(leftArm)

        const rightArm = new THREE.Mesh(armGeo, shoulderMat)
        rightArm.position.set(0.28 * entity.scale, 0.32 * entity.scale, 0)
        root.add(rightArm)
        break
      }
      case 'flora': {
        // Stylized mystical World Tree shape
        const trunkGeo = new THREE.CylinderGeometry(0.08 * entity.scale, 0.16 * entity.scale, 0.72 * entity.scale, 6)
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d271d, roughness: 0.9 })
        this.materials.push(trunkMat)
        this.geometries.push(trunkGeo)
        const trunk = new THREE.Mesh(trunkGeo, trunkMat)
        trunk.position.y = 0.36 * entity.scale
        root.add(trunk)

        const foliageGeo = new THREE.IcosahedronGeometry(0.38 * entity.scale, 1)
        this.geometries.push(foliageGeo)
        const foliageMat = new THREE.MeshStandardMaterial({
          color,
          roughness: 0.5,
          emissive: color.clone().multiplyScalar(0.4),
        })
        this.materials.push(foliageMat)
        const foliage = new THREE.Mesh(foliageGeo, foliageMat)
        foliage.position.y = 0.78 * entity.scale
        root.add(foliage)
        break
      }
      case 'structure':
      case 'relic': {
        // Ancient Obelisk / Shrine Shape
        bodyGeo = new THREE.ConeGeometry(0.22 * entity.scale, 0.85 * entity.scale, 4)
        this.geometries.push(bodyGeo)
        const obelisk = new THREE.Mesh(bodyGeo, primaryMat)
        obelisk.position.y = 0.42 * entity.scale
        root.add(obelisk)

        const ringGeo = new THREE.TorusGeometry(0.32 * entity.scale, 0.035 * entity.scale, 8, 20)
        this.geometries.push(ringGeo)
        const ringMat = new THREE.MeshStandardMaterial({
          color: 0x00ffff,
          emissive: 0x00ffff,
          emissiveIntensity: 0.8,
        })
        this.materials.push(ringMat)
        const ring = new THREE.Mesh(ringGeo, ringMat)
        ring.position.y = 0.52 * entity.scale
        ring.rotation.x = Math.PI / 2
        root.add(ring)
        break
      }
      case 'creature':
      default: {
        // Mythical Creature Shape (realistic ~1.0 - 1.15x human scale)
        bodyGeo = new THREE.CapsuleGeometry(0.15 * entity.scale, 0.32 * entity.scale, 4, 8)
        this.geometries.push(bodyGeo)
        const creatureBody = new THREE.Mesh(bodyGeo, primaryMat)
        creatureBody.position.y = 0.28 * entity.scale
        creatureBody.rotation.x = Math.PI / 2
        root.add(creatureBody)

        const headGeo = new THREE.SphereGeometry(0.13 * entity.scale, 8, 8)
        this.geometries.push(headGeo)
        const head = new THREE.Mesh(headGeo, primaryMat)
        head.position.set(0, 0.36 * entity.scale, 0.24 * entity.scale)
        root.add(head)

        // Wing appendages
        const wingGeo = new THREE.BoxGeometry(0.48 * entity.scale, 0.015 * entity.scale, 0.22 * entity.scale)
        this.geometries.push(wingGeo)
        const wings = new THREE.Mesh(wingGeo, primaryMat)
        wings.position.set(0, 0.34 * entity.scale, 0)
        root.add(wings)
        break
      }
    }

    // Add base glowing energy halo
    const haloGeo = new THREE.RingGeometry(0.4 * entity.scale, 0.7 * entity.scale, 16)
    this.geometries.push(haloGeo)
    const haloMat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
    })
    this.materials.push(haloMat)
    const halo = new THREE.Mesh(haloGeo, haloMat)
    halo.rotation.x = -Math.PI / 2
    halo.position.y = 0.05
    root.add(halo)

    return root
  }

  private colorForCategory(type: string): THREE.Color {
    switch (type) {
      case 'titan': return new THREE.Color(0xf97316)
      case 'flora': return new THREE.Color(0x10b981)
      case 'structure':
      case 'relic': return new THREE.Color(0xa855f7)
      case 'creature':
      default: return new THREE.Color(0x06b6d4)
    }
  }

  public update(elapsedSeconds: number): void {
    // Gentle idle floating and ring rotation animations
    this.group.children.forEach((child, index) => {
      const phase = elapsedSeconds * 1.5 + index * 0.7
      child.position.y += Math.sin(phase) * 0.003

      // Rotate inner energy rings if present
      child.traverse((node) => {
        if (node instanceof THREE.Mesh && node.geometry instanceof THREE.TorusGeometry) {
          node.rotation.z += 0.02
        }
      })
    })
  }

  private disposeResources(): void {
    for (const geo of this.geometries) geo.dispose()
    for (const mat of this.materials) mat.dispose()
    this.geometries = []
    this.materials = []
  }

  public dispose(): void {
    this.disposeResources()
    while (this.group.children.length > 0) {
      const child = this.group.children[0]
      if (child) this.group.remove(child)
      else break
    }
  }
}
