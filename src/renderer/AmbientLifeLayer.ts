import * as THREE from 'three'
import type { SimulationState } from '../simulation/types'
import { createPrng } from '../world/prng'
import type { World } from '../world/types'
import type { EffectiveQuality } from './quality'

const MAX_PARTICLES = 320

interface AmbientParticle {
  baseX: number
  baseY: number
  baseZ: number
  phase: number
  rate: number
  kind: 'bird' | 'firefly' | 'smoke' | 'spore' | 'ember' | 'bubble' | 'snowflake' | 'petal' | 'butterfly' | 'magma_spark' | 'frost_sparkle'
}

export function ambientParticleCount(quality: EffectiveQuality): number {
  if (quality === 'low') return 64
  if (quality === 'medium') return 140
  if (quality === 'high') return 220
  return MAX_PARTICLES
}

/**
 * A single Points draw-call for distant birds, fireflies, hearth smoke, forest spores,
 * volcanic embers, marine bubbles, swirling snow crystals, cherry blossom petals, and butterflies.
 * It is presentation-only: all positions derive from the deterministic seed.
 */
export class AmbientLifeLayer {
  private readonly geometry = new THREE.BufferGeometry()
  private readonly material = new THREE.PointsMaterial({
    size: 0.092,
    vertexColors: true,
    transparent: true,
    opacity: 0.88,
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
      const tileX = Math.floor(random.range(0, world.config.size - 1))
      const tileZ = Math.floor(random.range(0, world.config.size - 1))
      const tile = world.tiles[tileZ * world.config.size + tileX]
      const biome = tile?.biome ?? 'đồng cỏ'

      let kind: AmbientParticle['kind'] = 'firefly'
      if (index % 10 === 0) kind = 'smoke'
      else if (index % 7 === 0) kind = 'bird'
      else if (biome === 'hoa anh đào') kind = 'petal'
      else if (biome === 'núi lửa') kind = 'magma_spark'
      else if (biome === 'sông băng') kind = 'frost_sparkle'
      else if (biome === 'đồng cỏ' && index % 3 === 0) kind = 'butterfly'
      else if (biome === 'rừng' || biome === 'rừng nhiệt đới') kind = 'spore'
      else if (biome === 'núi' || biome === 'đồi' || biome === 'hẻm núi') kind = 'ember'
      else if (biome === 'biển' || biome === 'bờ cát' || biome === 'san hô') kind = 'bubble'
      else if (biome === 'tuyết') kind = 'snowflake'

      particles.push({
        baseX: (tileX - half) * this.tileScale,
        baseY: kind === 'bird' ? random.range(3.5, 5.8) : (tile?.height ?? 0.2) + random.range(0.25, 1.35),
        baseZ: (tileZ - half) * this.tileScale,
        phase: random.range(0, Math.PI * 2),
        rate: random.range(0.28, 0.95),
        kind,
      })

      let color = new THREE.Color(0xf6d989)
      if (kind === 'bird') color = new THREE.Color(0xe2edf5)
      else if (kind === 'smoke') color = new THREE.Color(0xb0b8c0)
      else if (kind === 'spore') color = new THREE.Color(0x6ee7b7)
      else if (kind === 'ember') color = new THREE.Color(0xf97316)
      else if (kind === 'bubble') color = new THREE.Color(0x38bdf8)
      else if (kind === 'snowflake') color = new THREE.Color(0xe0f2fe)
      else if (kind === 'petal') color = random.next() > 0.4 ? new THREE.Color(0xf472b6) : new THREE.Color(0xfbcfe8)
      else if (kind === 'butterfly') color = random.next() > 0.5 ? new THREE.Color(0x38bdf8) : new THREE.Color(0xfacc15)
      else if (kind === 'magma_spark') color = new THREE.Color(0xff4500)
      else if (kind === 'frost_sparkle') color = new THREE.Color(0xa5f3fc)

      color.toArray(this.colors, index * 3)
    }
    this.particles = particles
    const colorAttr = this.geometry.getAttribute('color') as THREE.BufferAttribute
    colorAttr.needsUpdate = true
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
      } else if (particle.kind === 'spore') {
        x += Math.sin(travel * 0.85) * 0.22
        z += Math.cos(travel * 0.65) * 0.22
        y += Math.sin(travel * 1.4) * 0.15 + (travel % 1) * 0.05
      } else if (particle.kind === 'ember') {
        x += Math.sin(travel * 1.6) * 0.14
        z += Math.cos(travel * 1.2) * 0.14
        y += ((travel * 0.4) % 1.2)
      } else if (particle.kind === 'bubble') {
        x += Math.sin(travel * 0.9) * 0.1
        z += Math.cos(travel * 0.9) * 0.1
        y += ((travel * 0.25) % 0.6)
      } else if (particle.kind === 'snowflake') {
        x += Math.sin(travel * 1.1) * 0.28
        z += Math.cos(travel * 0.8) * 0.28
        y -= ((travel * 0.3) % 0.8)
      } else if (particle.kind === 'petal') {
        x += Math.sin(travel * 1.1) * 0.35 + ((travel * 0.1) % 0.5)
        z += Math.cos(travel * 0.85) * 0.35 + ((travel * 0.15) % 0.5)
        y += Math.sin(travel * 1.5) * 0.12 - ((travel * 0.25) % 0.8)
      } else if (particle.kind === 'butterfly') {
        x += Math.sin(travel * 2.2) * 0.28
        z += Math.cos(travel * 1.8) * 0.28
        y += Math.sin(travel * 3.4) * 0.15
        if (stormActive) y = -20
      } else if (particle.kind === 'magma_spark') {
        x += Math.sin(travel * 2.4) * 0.16
        z += Math.cos(travel * 1.9) * 0.16
        y += ((travel * 0.6) % 1.5)
      } else if (particle.kind === 'frost_sparkle') {
        x += Math.sin(travel * 0.7) * 0.18
        z += Math.cos(travel * 0.7) * 0.18
        y += Math.sin(travel * 1.2) * 0.08
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
