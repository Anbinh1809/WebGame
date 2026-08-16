import * as THREE from 'three'
import type { EffectiveQuality } from './quality'
import type { World } from '../world/types'

export interface EvolutionPulseEffect {
  x: number
  y: number
  z: number
  radius: number
  maxRadius: number
  color: THREE.Color
  duration: number
  elapsed: number
}

export class EvolutionFxLayer {
  public group = new THREE.Group()
  private particlesMesh: THREE.Points | null = null
  private particleGeo: THREE.BufferGeometry | null = null
  private particleMat: THREE.PointsMaterial | null = null
  private pulses: EvolutionPulseEffect[] = []
  private pulseMeshes: THREE.Mesh[] = []
  private ringGeo: THREE.RingGeometry | null = null
  private isDisposed = false

  constructor() {
    this.group.name = 'evolution-fx-layer'
  }

  public initParticles(world: World, quality: EffectiveQuality): void {
    this.disposeParticles()
    if (quality === 'low') return

    const particleCount = quality === 'high' || quality === 'ultra' ? 250 : 100
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)

    const palette = [
      new THREE.Color(0x38bdf8), // Aether blue
      new THREE.Color(0xa855f7), // Mutation purple
      new THREE.Color(0x10b981), // Bio green
      new THREE.Color(0xf59e0b), // Solar amber
    ]

    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3
      positions[idx] = (Math.random() - 0.5) * world.config.size * 0.7
      positions[idx + 1] = 0.5 + Math.random() * 3.5
      positions[idx + 2] = (Math.random() - 0.5) * world.config.size * 0.7

      const col = palette[i % palette.length] ?? palette[0]!
      colors[idx] = col.r
      colors[idx + 1] = col.g
      colors[idx + 2] = col.b
    }

    this.particleGeo = new THREE.BufferGeometry()
    this.particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    this.particleMat = new THREE.PointsMaterial({
      size: 0.18,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    this.particlesMesh = new THREE.Points(this.particleGeo, this.particleMat)
    this.group.add(this.particlesMesh)

    this.ringGeo = new THREE.RingGeometry(0.2, 0.4, 24)
  }

  public triggerMutationPulse(x: number, y: number, z: number, colorHex = 0xa855f7): void {
    this.pulses.push({
      x,
      y: y + 0.1,
      z,
      radius: 0.2,
      maxRadius: 2.8,
      color: new THREE.Color(colorHex),
      duration: 1.2,
      elapsed: 0,
    })
  }

  public triggerConvergenceResonance(x: number, y: number, z: number): void {
    // Triple pulsing wave for legendary 0.5% duplicate convergence
    this.triggerMutationPulse(x, y, z, 0x38bdf8)
    setTimeout(() => {
      if (!this.isDisposed) this.triggerMutationPulse(x, y, z, 0xa855f7)
    }, 200)
    setTimeout(() => {
      if (!this.isDisposed) this.triggerMutationPulse(x, y, z, 0xf59e0b)
    }, 400)
  }

  public update(deltaTimeSeconds: number): void {
    // Animate DNA & Aether particles
    if (this.particlesMesh && this.particleGeo) {
      const posAttr = this.particleGeo.getAttribute('position')
      if (posAttr) {
        const positions = posAttr.array as Float32Array
        const count = positions.length / 3

        for (let i = 0; i < count; i++) {
          const yIdx = i * 3 + 1
          const currY = positions[yIdx]
          if (currY !== undefined) {
            positions[yIdx] = currY > 4.5 ? 0.4 : currY + deltaTimeSeconds * 0.4
          }
        }
        posAttr.needsUpdate = true
      }
      this.particlesMesh.rotation.y += deltaTimeSeconds * 0.05
    }

    // Update Pulses
    this.updatePulses(deltaTimeSeconds)
  }

  private updatePulses(deltaTimeSeconds: number): void {
    // Clear old pulse meshes
    for (const mesh of this.pulseMeshes) {
      this.group.remove(mesh)
      if (mesh.material instanceof THREE.Material) mesh.material.dispose()
    }
    this.pulseMeshes = []

    if (!this.ringGeo) return

    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const pulse = this.pulses[i]
      if (!pulse) continue

      pulse.elapsed += deltaTimeSeconds
      if (pulse.elapsed >= pulse.duration) {
        this.pulses.splice(i, 1)
        continue
      }

      const progress = pulse.elapsed / pulse.duration
      const currentRadius = pulse.radius + (pulse.maxRadius - pulse.radius) * progress
      const opacity = (1 - progress) * 0.8

      const mat = new THREE.MeshBasicMaterial({
        color: pulse.color,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      })

      const mesh = new THREE.Mesh(this.ringGeo, mat)
      mesh.scale.set(currentRadius, currentRadius, 1)
      mesh.rotation.x = -Math.PI / 2
      mesh.position.set(pulse.x, pulse.y, pulse.z)
      this.group.add(mesh)
      this.pulseMeshes.push(mesh)
    }
  }

  private disposeParticles(): void {
    if (this.particlesMesh) {
      this.group.remove(this.particlesMesh)
      this.particlesMesh = null
    }
    if (this.particleGeo) {
      this.particleGeo.dispose()
      this.particleGeo = null
    }
    if (this.particleMat) {
      this.particleMat.dispose()
      this.particleMat = null
    }
  }

  public dispose(): void {
    this.isDisposed = true
    this.disposeParticles()
    if (this.ringGeo) {
      this.ringGeo.dispose()
      this.ringGeo = null
    }
    for (const mesh of this.pulseMeshes) {
      this.group.remove(mesh)
      if (mesh.material instanceof THREE.Material) mesh.material.dispose()
    }
    this.pulseMeshes = []
  }
}
