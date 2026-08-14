import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import type { World } from '../world/types'
import { getWaterLevel } from '../world/generator'

export interface ShipRoute {
  readonly id: string
  readonly centerSceneX: number
  readonly centerSceneZ: number
  readonly radius: number
  readonly speed: number
  readonly phase: number
  readonly scale: number
}

/**
 * ShipLayer introduces majestic high-seas exploration ships (Galleon 3D)
 * sailing smoothly around the oceanic boundaries of the world.
 */
export class ShipLayer {
  private readonly group = new THREE.Group()
  private ships: { mesh: THREE.Group; route: ShipRoute }[] = []
  private template: THREE.Group | undefined
  private isLoaded = false
  private disposed = false

  public constructor(private readonly tileScale: number) {
    this.group.name = 'aetheria-ships'
    this.loadModel()
  }

  private async loadModel(): Promise<void> {
    try {
      const loader = new GLTFLoader()
      loader.setMeshoptDecoder(MeshoptDecoder)
      const gltf = await loader.loadAsync('/assets/models/ships/galleon_1k.glb')
      if (this.disposed) {
        gltf.scene.traverse((node) => {
          if (node instanceof THREE.Mesh) {
            node.geometry?.dispose()
            if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose())
            else node.material?.dispose()
          }
        })
        return
      }

      gltf.scene.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.castShadow = true
          node.receiveShadow = true
        }
      })

      this.template = gltf.scene
      this.isLoaded = true
      this.rebuildShips()
    } catch {
      // Graceful fallback if model is unavailable
    }
  }

  private currentWorld: World | undefined

  public setWorld(world: World): void {
    this.currentWorld = world
    if (this.isLoaded) {
      this.rebuildShips()
    }
  }

  private rebuildShips(): void {
    if (!this.template || !this.currentWorld) return

    // Clear existing ships
    for (const ship of this.ships) {
      this.group.remove(ship.mesh)
    }
    this.ships = []

    const world = this.currentWorld
    const boardRadius = (world.config.size / 2) * this.tileScale
    const shipCount = Math.max(1, Math.min(3, Math.floor(world.config.size / 16)))

    for (let index = 0; index < shipCount; index += 1) {
      const shipMesh = this.template.clone(true)
      const route: ShipRoute = {
        id: `ship-${index}`,
        centerSceneX: 0,
        centerSceneZ: 0,
        radius: boardRadius * (0.88 + index * 0.18),
        speed: 0.08 + index * 0.03,
        phase: (index * Math.PI * 2) / shipCount,
        scale: 0.045 + (index % 2) * 0.012,
      }
      shipMesh.scale.setScalar(route.scale)
      this.group.add(shipMesh)
      this.ships.push({ mesh: shipMesh, route })
    }
  }

  public attach(scene: THREE.Scene): void {
    scene.add(this.group)
  }

  public update(elapsed: number, reducedMotion: boolean): void {
    if (!this.isLoaded || this.ships.length === 0 || !this.currentWorld) return
    const waterLevel = getWaterLevel(this.currentWorld.config)

    for (const { mesh, route } of this.ships) {
      const angle = route.phase + (reducedMotion ? 0 : elapsed * route.speed)
      const x = route.centerSceneX + Math.cos(angle) * route.radius
      const z = route.centerSceneZ + Math.sin(angle) * route.radius

      // Gentle ocean bobbing & rocking
      const wavePitch = reducedMotion ? 0 : Math.sin(elapsed * 1.8 + route.phase) * 0.06
      const waveRoll = reducedMotion ? 0 : Math.cos(elapsed * 2.2 + route.phase) * 0.05
      const waveHeave = reducedMotion ? 0 : Math.sin(elapsed * 2.5 + route.phase) * 0.03

      mesh.position.set(x, waterLevel + 0.03 + waveHeave, z)
      // Heading is tangential to the circular orbit
      const heading = angle + Math.PI / 2
      mesh.rotation.set(wavePitch, heading, waveRoll)
    }
  }

  public dispose(): void {
    this.disposed = true
    for (const ship of this.ships) {
      this.group.remove(ship.mesh)
    }
    this.ships = []
    if (this.template) {
      this.template.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.geometry?.dispose()
          if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose())
          else node.material?.dispose()
        }
      })
      this.template = undefined
    }
  }
}
