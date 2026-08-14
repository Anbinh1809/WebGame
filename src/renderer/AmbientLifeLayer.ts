import * as THREE from 'three'
import type { SimulationState } from '../simulation/types'
import { createPrng } from '../world/prng'
import type { World } from '../world/types'
import type { EffectiveQuality } from './quality'

const MAX_PARTICLES = 144

interface AmbientParticle {
  baseX: number
  baseY: number
  baseZ: number
  phase: number
  rate: number
  kind: 'bird' | 'firefly' | 'smoke'
}

export function ambientParticleCount(quality: EffectiveQuality): number {
  if (quality === 'low') return 24
  if (quality === 'medium') return 52
  if (quality === 'high') return 92
  return MAX_PARTICLES
}

/**
 * A single Points draw-call for distant birds, fireflies and hearth smoke.
 * It is presentation-only: all positions derive from the deterministic seed.
 */
export class AmbientLifeLayer {
  private readonly geometry = new THREE.BufferGeometry()
  private readonly material = new THREE.PointsMaterial({
    size: 0.075,
    vertexColors: true,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    sizeAttenuation: true,
  })
  private readonly points = new THREE.Points(this.geometry, this.material)
  private readonly positions = new Float32Array(MAX_PARTICLES * 3)
  private readonly colors = new Float32Array(MAX_PARTICLES * 3)
  private particles: readonly AmbientParticle[] = []
  private world: World | undefined
  private simulation: SimulationState | undefined
  private activeCount = 0
  private attachedScene: THREE.Scene | undefined
  private disposed = false

  public constructor(private readonly tileScale: number) {
    this.points.name = 'aetheria-ambient-life'
    this.points.frustumCulled = false
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))
    this.geometry.setDrawRange(0, 0)
  }

  public attach(scene: THREE.Scene): void {
    if (this.disposed || this.attachedScene === scene) return
    this.detach()
    scene.add(this.points)
    this.attachedScene = scene
  }

  public detach(): void {
    this.attachedScene?.remove(this.points)
    this.attachedScene = undefined
  }

  public setWorld(world: World, quality: EffectiveQuality): void {
    if (this.disposed) return
    this.world = world
    this.activeCount = ambientParticleCount(quality)
    const half = (world.config.size - 1) / 2
    const random = createPrng(`${world.config.seed}-ambient-life`)
    const particles: AmbientParticle[] = []
    for (let index = 0; index < MAX_PARTICLES; index += 1) {
      const kind = index % 7 === 0 ? 'smoke' : index % 3 === 0 ? 'bird' : 'firefly'
      particles.push({
        baseX: (random.range(0, world.config.size - 1) - half) * this.tileScale,
        baseY: kind === 'bird' ? random.range(3.2, 5.3) : random.range(0.38, 1.25),
        baseZ: (random.range(0, world.config.size - 1) - half) * this.tileScale,
        phase: random.range(0, Math.PI * 2),
        rate: random.range(0.28, 0.92),
        kind,
      })
      const color = kind === 'bird'
        ? new THREE.Color(0xd8e6f0)
        : kind === 'smoke'
          ? new THREE.Color(0xb8bec4)
          : new THREE.Color(0xf6d989)
      color.toArray(this.colors, index * 3)
    }
    this.particles = particles
    const color = this.geometry.getAttribute('color') as THREE.BufferAttribute
    color.needsUpdate = true
    this.update(0, true, false)
  }

  public setSimulation(simulation: SimulationState): void {
    this.simulation = simulation
  }

  public setQuality(quality: EffectiveQuality): void {
    this.activeCount = ambientParticleCount(quality)
    this.geometry.setDrawRange(0, this.activeCount)
  }

  public update(elapsed: number, reducedMotion: boolean, stormActive: boolean): void {
    const world = this.world
    if (this.disposed || !world || this.particles.length === 0) return
    const half = (world.config.size - 1) / 2
    const villages = this.simulation?.villages ?? []
    const positions = this.geometry.getAttribute('position') as THREE.BufferAttribute
    const animationTime = reducedMotion ? 0 : elapsed

    for (let index = 0; index < this.activeCount; index += 1) {
      const particle = this.particles[index]
      if (!particle) continue
      const travel = animationTime * particle.rate + particle.phase
      let x = particle.baseX
      let y = particle.baseY
      let z = particle.baseZ

      if (particle.kind === 'bird') {
        const speed = stormActive ? 1.7 : 1
        x += Math.sin(travel * speed) * 1.25
        z += Math.cos(travel * 0.73 * speed) * 0.82
        y += Math.sin(travel * 1.8) * 0.18
      } else if (particle.kind === 'firefly') {
        x += Math.sin(travel * 1.46) * 0.18
        z += Math.cos(travel * 1.13) * 0.18
        y += Math.sin(travel * 2.2) * 0.12
        if (stormActive) y = -20
      } else {
        const village = villages[index % Math.max(1, villages.length)]
        const home = village ? world.tiles[village.tileIndex] : undefined
        if (home) {
          x = (home.x - half) * this.tileScale + Math.sin(particle.phase) * 0.2
          z = (home.z - half) * this.tileScale + Math.cos(particle.phase) * 0.2
          y = home.height + 0.55 + (reducedMotion ? 0 : (travel % 1) * 0.7)
        } else {
          y = -20
        }
      }
      positions.setXYZ(index, x, y, z)
    }

    this.geometry.setDrawRange(0, this.activeCount)
    positions.needsUpdate = true
  }

  public dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.detach()
    this.geometry.dispose()
    this.material.dispose()
    this.particles = []
  }
}
