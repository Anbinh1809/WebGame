import * as THREE from 'three'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { assetsForPack } from '../assets/registry'
import type { AssetManifestEntry, AssetMaterialSurface, AssetPackQuality, AssetRuntimeFile } from '../assets/types'
import type { DisposableResource } from './AssetPackManager'

type MaterialSurface = Exclude<AssetMaterialSurface, 'environment'>

export type PolyHavenMaterialTargets = Partial<Record<MaterialSurface, readonly THREE.MeshStandardMaterial[]>>

export interface PolyHavenArtTargets {
  scene: THREE.Scene
  materials: PolyHavenMaterialTargets
  /** The world owns its sky mesh; this callback swaps only its local texture. */
  setSkyTexture?: (texture: THREE.Texture | undefined) => void
}

export interface PolyHavenArtLoadOptions {
  /** Deferred material maps are loaded only when their gameplay visual becomes visible. */
  includeDeferred?: boolean
  /** Secondary material scopes must not replace the primary HDR environment. */
  loadEnvironment?: boolean
}

export interface ClearPolyHavenArtOptions {
  clearEnvironment?: boolean
}

interface LoadedMaterial {
  materials: readonly THREE.MeshStandardMaterial[]
  albedo: THREE.Texture
  normal: THREE.Texture
  roughness: THREE.Texture
}

function requiredFile(entry: AssetManifestEntry, role: AssetRuntimeFile['role']): AssetRuntimeFile {
  const file = entry.runtime.files.find((candidate) => candidate.role === role)
  if (!file) throw new Error(`${entry.id}: missing ${role} runtime file.`)
  return file
}

function configureTexture(texture: THREE.Texture, file: AssetRuntimeFile, repeat: readonly [number, number], maxAnisotropy: number): THREE.Texture {
  texture.colorSpace = file.colorSpace === 'srgb' ? THREE.SRGBColorSpace : THREE.NoColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeat[0], repeat[1])
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.anisotropy = Math.min(4, maxAnisotropy)
  texture.needsUpdate = true
  return texture
}

async function loadTexture(loader: THREE.TextureLoader, file: AssetRuntimeFile, repeat: readonly [number, number], maxAnisotropy: number): Promise<THREE.Texture> {
  return configureTexture(await loader.loadAsync(file.path), file, repeat, maxAnisotropy)
}

/** A loaded material/environment scope has one explicit owner: AssetPackManager. */
export class PolyHavenArtBundle implements DisposableResource {
  public constructor(
    private readonly loadedMaterials: readonly LoadedMaterial[],
    private readonly environmentTarget: THREE.WebGLRenderTarget | undefined,
    private readonly skyTexture: THREE.Texture | undefined,
    private readonly appliesEnvironment = true,
  ) {}

  public apply(targets: PolyHavenArtTargets): void {
    for (const loaded of this.loadedMaterials) {
      for (const material of loaded.materials) {
        material.map = loaded.albedo
        material.normalMap = loaded.normal
        material.roughnessMap = loaded.roughness
        material.normalScale.setScalar(0.38)
        material.needsUpdate = true
      }
    }
    if (this.appliesEnvironment) {
      targets.scene.environment = this.environmentTarget?.texture ?? null
      targets.setSkyTexture?.(this.skyTexture)
    }
  }

  public dispose(): void {
    const textures = new Set<THREE.Texture>()
    for (const loaded of this.loadedMaterials) {
      textures.add(loaded.albedo)
      textures.add(loaded.normal)
      textures.add(loaded.roughness)
    }
    for (const texture of textures) texture.dispose()
    this.environmentTarget?.dispose()
    this.skyTexture?.dispose()
  }
}

export function createProceduralArtFallback(): PolyHavenArtBundle {
  return new PolyHavenArtBundle([], undefined, undefined)
}

export function clearPolyHavenArt(targets: PolyHavenArtTargets, options: ClearPolyHavenArtOptions = {}): void {
  const materials = new Set<THREE.MeshStandardMaterial>()
  for (const surfaceMaterials of Object.values(targets.materials)) {
    for (const material of surfaceMaterials ?? []) materials.add(material)
  }
  for (const material of materials) {
    material.map = null
    material.normalMap = null
    material.roughnessMap = null
    material.normalScale.setScalar(1)
    material.needsUpdate = true
  }
  if (options.clearEnvironment !== false) {
    targets.scene.environment = null
    targets.setSkyTexture?.(undefined)
  }
}

/**
 * Loads files from Aetheria's own release path. Poly Haven is never contacted
 * at runtime: its API is used only by the offline curation script.
 */
export async function loadPolyHavenArt(
  renderer: THREE.WebGLRenderer,
  targets: PolyHavenArtTargets,
  entries: readonly AssetManifestEntry[],
  pack: AssetPackQuality,
  options: PolyHavenArtLoadOptions = {},
): Promise<PolyHavenArtBundle> {
  const textureLoader = new THREE.TextureLoader()
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy()
  const loadedMaterials: LoadedMaterial[] = []
  let environmentTarget: THREE.WebGLRenderTarget | undefined
  let skyTexture: THREE.Texture | undefined

  try {
    const availableEntries = assetsForPack(entries, pack)
      .filter((entry) => options.includeDeferred || entry.runtimeBudget.preload || (entry.runtime.kind === 'environment' && entry.runtime.environmentRole === 'sky'))
    for (const entry of availableEntries) {
      if (entry.runtime.kind !== 'material') continue
      const surface = entry.runtime.surface
      if (surface === 'environment') continue
      const targetsForSurface = targets.materials[surface]
      if (!targetsForSurface?.length || !entry.runtime.repeat) continue
      const [albedo, normal, roughness] = await Promise.all([
        loadTexture(textureLoader, requiredFile(entry, 'albedo'), entry.runtime.repeat, maxAnisotropy),
        loadTexture(textureLoader, requiredFile(entry, 'normal'), entry.runtime.repeat, maxAnisotropy),
        loadTexture(textureLoader, requiredFile(entry, 'roughness'), entry.runtime.repeat, maxAnisotropy),
      ])
      loadedMaterials.push({ materials: targetsForSurface, albedo, normal, roughness })
    }

    const environments = options.loadEnvironment === false
      ? []
      : availableEntries.filter((entry) => entry.runtime.kind === 'environment')
    const lightingEnvironment = environments.find((entry) => entry.runtime.kind === 'environment' && entry.runtime.environmentRole !== 'sky')
    const visibleSky = environments.find((entry) => entry.runtime.kind === 'environment' && entry.runtime.environmentRole === 'sky')
    if (lightingEnvironment) {
      const hdrLoader = new HDRLoader()
      const hdrTexture = await hdrLoader.loadAsync(requiredFile(lightingEnvironment, 'environment').path)
      const pmremGenerator = new THREE.PMREMGenerator(renderer)
      try {
        pmremGenerator.compileEquirectangularShader()
        environmentTarget = pmremGenerator.fromEquirectangular(hdrTexture)
      } finally {
        hdrTexture.dispose()
        pmremGenerator.dispose()
      }
    }

    if (visibleSky) {
      const hdrLoader = new HDRLoader()
      skyTexture = await hdrLoader.loadAsync(requiredFile(visibleSky, 'environment').path)
      skyTexture.mapping = THREE.EquirectangularReflectionMapping
      skyTexture.needsUpdate = true
    }

    return new PolyHavenArtBundle(loadedMaterials, environmentTarget, skyTexture, options.loadEnvironment !== false)
  } catch (error) {
    new PolyHavenArtBundle(loadedMaterials, environmentTarget, skyTexture, options.loadEnvironment !== false).dispose()
    throw error
  }
}
