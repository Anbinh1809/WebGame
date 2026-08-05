import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { assetsForPack } from '../assets/registry'
import type { AssetManifestEntry, AssetPackQuality } from '../assets/types'
import type { DisposableResource } from './AssetPackManager'
import type { EffectiveQuality } from './quality'

interface InstancedTreePart {
  mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>
  localMatrix: THREE.Matrix4
}

const MATERIAL_TEXTURE_KEYS = [
  'map', 'alphaMap', 'aoMap', 'bumpMap', 'displacementMap', 'emissiveMap',
  'envMap', 'lightMap', 'metalnessMap', 'normalMap', 'roughnessMap',
] as const

function collectMaterialTextures(material: THREE.Material, output: Set<THREE.Texture>): void {
  const maps = material as THREE.Material & Record<(typeof MATERIAL_TEXTURE_KEYS)[number], THREE.Texture | null | undefined>
  for (const key of MATERIAL_TEXTURE_KEYS) {
    const texture = maps[key]
    if (texture) output.add(texture)
  }
}

function cloneTreeMaterial(source: THREE.Material): THREE.Material {
  const material = source.clone()
  if (material instanceof THREE.MeshStandardMaterial && /leaves/i.test(material.name)) {
    // Keep Poly Haven's authored BLEND treatment. The prior alpha-test shortcut
    // stripped the tiny leaf cards during an isometric close-up.
    material.side = THREE.DoubleSide
    material.needsUpdate = true
  }
  return material
}

function cloneTreeMaterials(source: THREE.Material | THREE.Material[]): THREE.Material | THREE.Material[] {
  return Array.isArray(source) ? source.map(cloneTreeMaterial) : cloneTreeMaterial(source)
}

function eachMaterial(material: THREE.Material | THREE.Material[], callback: (item: THREE.Material) => void): void {
  if (Array.isArray(material)) {
    for (const item of material) callback(item)
    return
  }
  callback(material)
}

/** A small, quality-aware cap keeps the real model from becoming a tile-count cost. */
export function treeModelInstanceLimit(quality: EffectiveQuality, assetLimit: number): number {
  const target = quality === 'low' ? 4 : quality === 'medium' ? 12 : 24
  return Math.max(0, Math.min(assetLimit, target))
}

/** A 512px WebGL fallback stays procedural instead of allocating 1K model maps. */
export function canLoadTreeModel(textureSourceResolution: number): boolean {
  return textureSourceResolution >= 1024
}

export function treeModelAssetForPack(
  entries: readonly AssetManifestEntry[],
  pack: AssetPackQuality,
): AssetManifestEntry | undefined {
  return assetsForPack(entries, pack).find((entry) => entry.runtime.kind === 'model' && entry.runtime.modelType === 'tree' && entry.runtime.modelVariant === 'forest')
}

/**
 * One shared geometry/material set is instanced for every selected tree. The
 * layer owns its GLTF GPU resources and is safe to detach during a pack swap.
 */
export class InstancedTreeModelLayer implements DisposableResource {
  private readonly group = new THREE.Group()
  private readonly combinedMatrix = new THREE.Matrix4()
  private attachedScene: THREE.Scene | undefined
  private disposed = false

  public constructor(
    private readonly parts: readonly InstancedTreePart[],
    public readonly maximumInstances: number,
    public readonly worldScale: number,
    public readonly minimumSpacing: number,
  ) {
    this.group.name = 'polyhaven-tree-small-02-instanced'
    for (const part of parts) {
      part.mesh.castShadow = true
      part.mesh.receiveShadow = true
      this.group.add(part.mesh)
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

  public setMatrices(placements: readonly THREE.Matrix4[], requestedLimit: number): number {
    if (this.disposed) return 0
    const count = Math.min(this.maximumInstances, requestedLimit, placements.length)
    for (const part of this.parts) {
      for (let index = 0; index < count; index += 1) {
        const placement = placements[index]
        if (!placement) continue
        this.combinedMatrix.multiplyMatrices(placement, part.localMatrix)
        part.mesh.setMatrixAt(index, this.combinedMatrix)
      }
      part.mesh.count = count
      part.mesh.instanceMatrix.needsUpdate = true
      part.mesh.computeBoundingSphere()
    }
    return count
  }

  public dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.detach()
    const materials = new Set<THREE.Material>()
    const textures = new Set<THREE.Texture>()
    for (const part of this.parts) {
      part.mesh.geometry.dispose()
      eachMaterial(part.mesh.material, (material) => {
        materials.add(material)
        collectMaterialTextures(material, textures)
      })
    }
    for (const material of materials) material.dispose()
    for (const texture of textures) texture.dispose()
    this.group.clear()
  }
}

/** Loads only the preprocessed Aetheria GLB; it never contacts Poly Haven at runtime. */
export async function loadInstancedTreeModel(asset: AssetManifestEntry): Promise<InstancedTreeModelLayer> {
  if (asset.runtime.kind !== 'model' || asset.runtime.modelType !== 'tree') {
    throw new Error(`${asset.id} is not a tree model asset.`)
  }
  const file = asset.runtime.files.find((candidate) => candidate.role === 'model')
  if (!file) throw new Error(`${asset.id} is missing its model runtime file.`)

  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const gltf = await loader.loadAsync(file.path)
  gltf.scene.updateMatrixWorld(true)

  const parts: InstancedTreePart[] = []
  const sourceGeometries = new Set<THREE.BufferGeometry>()
  const sourceMaterials = new Set<THREE.Material>()
  gltf.scene.traverse((node) => {
    if (!(node instanceof THREE.Mesh) || !node.geometry) return
    sourceGeometries.add(node.geometry)
    eachMaterial(node.material, (material) => sourceMaterials.add(material))
    const geometry = node.geometry.clone()
    const material = cloneTreeMaterials(node.material)
    const mesh = new THREE.InstancedMesh(geometry, material, asset.runtimeBudget.maxInstances)
    mesh.name = `${asset.id}-${parts.length}`
    parts.push({ mesh, localMatrix: node.matrixWorld.clone() })
  })

  for (const geometry of sourceGeometries) geometry.dispose()
  for (const material of sourceMaterials) material.dispose()
  if (parts.length === 0) throw new Error(`${asset.id} contains no renderable mesh.`)
  return new InstancedTreeModelLayer(
    parts,
    asset.runtimeBudget.maxInstances,
    asset.runtime.worldScale,
    asset.runtime.minimumSpacing,
  )
}
