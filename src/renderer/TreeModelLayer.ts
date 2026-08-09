import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { assetsForPack } from '../assets/registry'
import type { AssetManifestEntry, AssetModelRuntimeDefinition, AssetPackQuality } from '../assets/types'
import type { DisposableResource } from './AssetPackManager'
import type { EffectiveQuality } from './quality'

interface InstancedModelPart {
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

function cloneModelMaterial(source: THREE.Material): THREE.Material {
  const material = source.clone()
  if (material instanceof THREE.MeshStandardMaterial && /leaves/i.test(material.name)) {
    // Keep Poly Haven's authored BLEND treatment. The prior alpha-test shortcut
    // stripped the tiny leaf cards during an isometric close-up.
    material.side = THREE.DoubleSide
    material.needsUpdate = true
  }
  return material
}

function cloneModelMaterials(source: THREE.Material | THREE.Material[]): THREE.Material | THREE.Material[] {
  return Array.isArray(source) ? source.map(cloneModelMaterial) : cloneModelMaterial(source)
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
  // Broad-canopy production meshes retain far more leaf geometry than the
  // compact fallback. Their cap is deliberately a visual LOD, not a texture
  // quality switch: one on Low, two on Medium, four on High.
  if (assetLimit <= 4) {
    const target = quality === 'low' ? 1 : quality === 'medium' ? 2 : 4
    return Math.max(0, Math.min(assetLimit, target))
  }
  if (assetLimit <= 8) {
    const target = quality === 'low' ? 1 : quality === 'medium' ? 4 : 8
    return Math.max(0, Math.min(assetLimit, target))
  }
  const target = quality === 'low' ? 4 : quality === 'medium' ? 12 : quality === 'high' ? 24 : 36
  return Math.max(0, Math.min(assetLimit, target))
}

/**
 * Hero-scale environment models such as trees and shoreline rock formations
 * are intentionally sparse. Their visual detail comes from the real model
 * and texture pack, not from multiplying a dense mesh across every tile.
 */
export function sparseEnvironmentModelInstanceLimit(quality: EffectiveQuality, assetLimit: number): number {
  const target = quality === 'low' ? 1 : quality === 'medium' ? 2 : quality === 'high' ? 3 : 4
  return Math.max(0, Math.min(assetLimit, target))
}

/** Ferns are low-poly enough to make the forest floor feel populated without a tile-count cost. */
export function groundCoverModelInstanceLimit(quality: EffectiveQuality, assetLimit: number): number {
  const target = quality === 'low' ? 4 : quality === 'medium' ? 8 : quality === 'high' ? 12 : 16
  return Math.max(0, Math.min(assetLimit, target))
}

/** A 512px WebGL fallback stays procedural instead of allocating 1K model maps. */
export function canLoadTreeModel(textureSourceResolution: number): boolean {
  return textureSourceResolution >= 1024
}

function fallbackModelPacks(pack: AssetPackQuality): readonly AssetPackQuality[] {
  if (pack === 'cinema-8k') return ['cinema-8k', 'desktop-4k', 'desktop-2k', 'web-1k']
  return [pack]
}

export function treeModelAssetForPack(
  entries: readonly AssetManifestEntry[],
  pack: AssetPackQuality,
): AssetManifestEntry | undefined {
  for (const candidatePack of fallbackModelPacks(pack)) {
    const models = assetsForPack(entries, candidatePack).filter((entry) => entry.runtime.kind === 'model' && entry.runtime.modelType === 'tree' && entry.runtime.modelVariant === 'forest')
    const model = models.find((entry) => entry.polyHavenSlug === 'island_tree_01') ?? models[0]
    if (model) return model
  }
  return undefined
}

export function rockModelAssetForPack(
  entries: readonly AssetManifestEntry[],
  pack: AssetPackQuality,
): AssetManifestEntry | undefined {
  for (const candidatePack of fallbackModelPacks(pack)) {
    const models = assetsForPack(entries, candidatePack).filter((entry) => entry.runtime.kind === 'model' && entry.runtime.modelType === 'rock' && entry.runtime.modelVariant === 'formation')
    const model = models.find((entry) => entry.polyHavenSlug === 'boulder_01') ?? models[0]
    if (model) return model
  }
  return undefined
}

export function groundCoverModelAssetForPack(
  entries: readonly AssetManifestEntry[],
  pack: AssetPackQuality,
): AssetManifestEntry | undefined {
  for (const candidatePack of fallbackModelPacks(pack)) {
    const model = assetsForPack(entries, candidatePack).find((entry) => entry.runtime.kind === 'model' && entry.runtime.modelType === 'groundCover' && entry.runtime.modelVariant === 'ground')
    if (model) return model
  }
  return undefined
}

export function coastRockModelAssetForPack(
  entries: readonly AssetManifestEntry[],
  pack: AssetPackQuality,
): AssetManifestEntry | undefined {
  for (const candidatePack of fallbackModelPacks(pack)) {
    const model = assetsForPack(entries, candidatePack).find((entry) => entry.runtime.kind === 'model' && entry.runtime.modelType === 'coastRock' && entry.runtime.modelVariant === 'coast')
    if (model) return model
  }
  return undefined
}

/**
 * One shared geometry/material set is instanced for every selected tree. The
 * layer owns its GLTF GPU resources and is safe to detach during a pack swap.
 */
export class InstancedModelLayer implements DisposableResource {
  private readonly group = new THREE.Group()
  private readonly combinedMatrix = new THREE.Matrix4()
  private attachedScene: THREE.Scene | undefined
  private disposed = false

  public constructor(
    private readonly parts: readonly InstancedModelPart[],
    public readonly maximumInstances: number,
    public readonly worldScale: number,
    public readonly minimumSpacing: number,
    name = 'polyhaven-instanced-model',
  ) {
    this.group.name = name
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

/** Loads only a preprocessed Aetheria GLB; it never contacts Poly Haven at runtime. */
async function loadInstancedModel(asset: AssetManifestEntry, expectedType: AssetModelRuntimeDefinition['modelType']): Promise<InstancedModelLayer> {
  if (asset.runtime.kind !== 'model' || asset.runtime.modelType !== expectedType) {
    throw new Error(`${asset.id} is not a ${expectedType} model asset.`)
  }
  const file = asset.runtime.files.find((candidate) => candidate.role === 'model')
  if (!file) throw new Error(`${asset.id} is missing its model runtime file.`)

  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const gltf = await loader.loadAsync(file.path)
  gltf.scene.updateMatrixWorld(true)

  const parts: InstancedModelPart[] = []
  const sourceGeometries = new Set<THREE.BufferGeometry>()
  const sourceMaterials = new Set<THREE.Material>()
  gltf.scene.traverse((node) => {
    if (!(node instanceof THREE.Mesh) || !node.geometry) return
    sourceGeometries.add(node.geometry)
    eachMaterial(node.material, (material) => sourceMaterials.add(material))
    const geometry = node.geometry.clone()
    const material = cloneModelMaterials(node.material)
    const mesh = new THREE.InstancedMesh(geometry, material, asset.runtimeBudget.maxInstances)
    mesh.name = `${asset.id}-${parts.length}`
    parts.push({ mesh, localMatrix: node.matrixWorld.clone() })
  })

  for (const geometry of sourceGeometries) geometry.dispose()
  for (const material of sourceMaterials) material.dispose()
  if (parts.length === 0) throw new Error(`${asset.id} contains no renderable mesh.`)
  return new InstancedModelLayer(
    parts,
    asset.runtimeBudget.maxInstances,
    asset.runtime.worldScale,
    asset.runtime.minimumSpacing,
    `polyhaven-${asset.id}-instanced`,
  )
}

export function loadInstancedTreeModel(asset: AssetManifestEntry): Promise<InstancedModelLayer> {
  return loadInstancedModel(asset, 'tree')
}

export function loadInstancedRockModel(asset: AssetManifestEntry): Promise<InstancedModelLayer> {
  return loadInstancedModel(asset, 'rock')
}

export function loadInstancedGroundCoverModel(asset: AssetManifestEntry): Promise<InstancedModelLayer> {
  return loadInstancedModel(asset, 'groundCover')
}

export function loadInstancedCoastRockModel(asset: AssetManifestEntry): Promise<InstancedModelLayer> {
  return loadInstancedModel(asset, 'coastRock')
}
