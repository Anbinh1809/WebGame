import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'

export interface SettlementModelPlacements {
  readonly townHalls: readonly THREE.Matrix4[]
  readonly forges: readonly THREE.Matrix4[]
  readonly houses: readonly THREE.Matrix4[]
  readonly workshops: readonly THREE.Matrix4[]
}

interface LoadedBuildingModel {
  template: THREE.Group
  instances: THREE.Group[]
  scale: number
}

/**
 * SettlementModelLayer replaces procedural boxes and cylinders with high-fidelity
 * 3D medieval castles, blacksmith forges, village cottages, and workshop props.
 */
export class SettlementModelLayer {
  private readonly group = new THREE.Group()
  private castleModel: LoadedBuildingModel | undefined
  private blacksmithModel: LoadedBuildingModel | undefined
  private villageModel: LoadedBuildingModel | undefined
  private anvilModel: LoadedBuildingModel | undefined
  private disposed = false
  private currentPlacements: SettlementModelPlacements = {
    townHalls: [],
    forges: [],
    houses: [],
    workshops: [],
  }

  public constructor() {
    this.group.name = 'aetheria-settlement-models'
    this.loadModels()
  }

  private async loadModel(path: string, scale: number): Promise<LoadedBuildingModel | undefined> {
    try {
      const loader = new GLTFLoader()
      loader.setMeshoptDecoder(MeshoptDecoder)
      const gltf = await loader.loadAsync(path)
      if (this.disposed) {
        gltf.scene.traverse((node) => {
          if (node instanceof THREE.Mesh) {
            node.geometry?.dispose()
            if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose())
            else node.material?.dispose()
          }
        })
        return undefined
      }

      gltf.scene.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.castShadow = true
          node.receiveShadow = true
        }
      })

      return {
        template: gltf.scene,
        instances: [],
        scale,
      }
    } catch {
      return undefined
    }
  }

  private async loadModels(): Promise<void> {
    const [castle, blacksmith, village, anvil] = await Promise.all([
      this.loadModel('/assets/models/settlements/medieval_castle_1k.glb', 0.035),
      this.loadModel('/assets/models/settlements/blacksmith_1k.glb', 0.045),
      this.loadModel('/assets/models/settlements/modular_village_1k.glb', 0.032),
      this.loadModel('/assets/pack/props/Anvil.gltf', 0.22),
    ])

    if (this.disposed) return
    this.castleModel = castle
    this.blacksmithModel = blacksmith
    this.villageModel = village
    this.anvilModel = anvil
    this.applyPlacements()
  }

  public setPlacements(placements: SettlementModelPlacements): void {
    this.currentPlacements = placements
    this.applyPlacements()
  }

  private syncInstances(model: LoadedBuildingModel | undefined, matrices: readonly THREE.Matrix4[], offsetY = 0): void {
    if (!model) return

    // Reallocate or reuse groups
    while (model.instances.length < matrices.length) {
      const clone = model.template.clone(true)
      this.group.add(clone)
      model.instances.push(clone)
    }

    // Hide extra
    for (let i = matrices.length; i < model.instances.length; i += 1) {
      model.instances[i]!.visible = false
    }

    // Apply matrix transformation
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3()

    for (let i = 0; i < matrices.length; i += 1) {
      const group = model.instances[i]!
      group.visible = true
      matrices[i]!.decompose(position, quaternion, scale)
      group.position.set(position.x, position.y + offsetY, position.z)
      group.quaternion.copy(quaternion)
      group.scale.copy(scale).multiplyScalar(model.scale)
    }
  }

  private applyPlacements(): void {
    this.syncInstances(this.castleModel, this.currentPlacements.townHalls, 0.02)
    this.syncInstances(this.blacksmithModel, this.currentPlacements.forges, 0.02)
    this.syncInstances(this.villageModel, this.currentPlacements.houses, 0.02)
    this.syncInstances(this.anvilModel, this.currentPlacements.workshops, 0.02)
  }

  public attach(scene: THREE.Scene): void {
    scene.add(this.group)
  }

  public hasModelsLoaded(): boolean {
    return Boolean(this.castleModel || this.blacksmithModel || this.villageModel)
  }

  public dispose(): void {
    this.disposed = true
    const models = [this.castleModel, this.blacksmithModel, this.villageModel, this.anvilModel]
    for (const model of models) {
      if (!model) continue
      for (const instance of model.instances) {
        this.group.remove(instance)
      }
      model.instances = []
      model.template.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.geometry?.dispose()
          if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose())
          else node.material?.dispose()
        }
      })
    }
  }
}
