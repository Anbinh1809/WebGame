import * as THREE from 'three'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js'
import { ANIMATED_FAUNA_ASSETS, ANIMATED_SETTLER_ASSET } from '../assets/animationAssets'
import { generateFauna } from '../world/fauna'
import type { FaunaSpawn, FaunaSpecies } from '../world/fauna'
import type { World } from '../world/types'
import { faunaMotionPose, settlerMotionPose } from './ActorMotion'
import type { EffectiveQuality } from './quality'
import type { SettlerPlacement } from './SettlerLayer'
import { sampleTerrainPointAtTile, WORLD_UP } from './TerrainPose'

type FaunaClipKey = 'idle' | 'forage' | 'walk'
type SettlerClipKey = 'idle' | 'run' | 'jump'

interface AnimationState<TKey extends string> {
  actions: ReadonlyMap<TKey, THREE.AnimationAction>
  activeAction: THREE.AnimationAction | undefined
}

interface FaunaTemplate {
  visual: THREE.Object3D
  clips: ReadonlyMap<FaunaClipKey, THREE.AnimationClip>
}

interface AnimatedFaunaActor extends AnimationState<FaunaClipKey> {
  root: THREE.Group
  visual: THREE.Object3D
  mixer: THREE.AnimationMixer
  spawn: FaunaSpawn
}

interface SettlerTemplate {
  visual: THREE.Object3D
  clips: ReadonlyMap<SettlerClipKey, THREE.AnimationClip>
}

interface AnimatedSettlerActor extends AnimationState<SettlerClipKey> {
  root: THREE.Group
  visual: THREE.Object3D
  mixer: THREE.AnimationMixer
  settler: SettlerPlacement
}

interface SurfacePoseScratch {
  position: THREE.Vector3
  normal: THREE.Vector3
  slope: THREE.Quaternion
  yaw: THREE.Quaternion
}

interface FbxAnimationGroup extends THREE.Group {
  animations: THREE.AnimationClip[]
}

function animatedActorLimit(quality: EffectiveQuality): number {
  if (quality === 'low') return 16
  if (quality === 'medium') return 32
  return 64
}

function createSurfacePoseScratch(): SurfacePoseScratch {
  return {
    position: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    slope: new THREE.Quaternion(),
    yaw: new THREE.Quaternion(),
  }
}

function setShadowFlags(root: THREE.Object3D): void {
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return
    node.castShadow = true
    node.receiveShadow = true
    node.frustumCulled = true
  })
}

function createNormalisedVisual(source: THREE.Object3D, targetHeight: number): THREE.Object3D {
  const visual = cloneSkeleton(source)
  setShadowFlags(visual)
  visual.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(visual)
  const height = bounds.max.y - bounds.min.y
  if (height <= 0.0001) throw new Error('Animated actor model has no measurable height.')

  visual.scale.setScalar(targetHeight / height)
  visual.updateMatrixWorld(true)
  const normalisedBounds = new THREE.Box3().setFromObject(visual)
  visual.position.y -= normalisedBounds.min.y
  return visual
}

function disposeObjectResources(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return
    geometries.add(node.geometry)
    const nodeMaterials = Array.isArray(node.material) ? node.material : [node.material]
    for (const material of nodeMaterials) {
      materials.add(material)
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value)
      }
    }
  })
  for (const geometry of geometries) geometry.dispose()
  for (const material of materials) material.dispose()
  for (const texture of textures) texture.dispose()
}

function addActions<TKey extends string>(
  mixer: THREE.AnimationMixer,
  clips: ReadonlyMap<TKey, THREE.AnimationClip>,
): ReadonlyMap<TKey, THREE.AnimationAction> {
  const actions = new Map<TKey, THREE.AnimationAction>()
  for (const [key, clip] of clips) {
    const action = mixer.clipAction(clip)
    action.setLoop(THREE.LoopRepeat, Infinity)
    actions.set(key, action)
  }
  return actions
}

function transitionTo<TKey extends string>(state: AnimationState<TKey>, key: TKey): void {
  const next = state.actions.get(key) ?? state.actions.values().next().value
  if (!next || state.activeAction === next) return
  next.reset().setEffectiveWeight(1).play()
  if (state.activeAction) state.activeAction.crossFadeTo(next, 0.24, false)
  state.activeAction = next
}

function applySurfacePose(
  root: THREE.Group,
  world: World,
  tileScale: number,
  tileX: number,
  tileZ: number,
  heading: number,
  scale: number,
  scratch: SurfacePoseScratch,
): void {
  sampleTerrainPointAtTile(world, tileScale, tileX, tileZ, scratch.position, scratch.normal)
  scratch.position.y = Math.max(0.08, scratch.position.y)
  scratch.slope.setFromUnitVectors(WORLD_UP, scratch.normal)
  scratch.yaw.setFromAxisAngle(WORLD_UP, heading)
  root.position.copy(scratch.position)
  root.quaternion.copy(scratch.slope).multiply(scratch.yaw)
  root.scale.setScalar(scale)
}

function faunaClipFor(spawn: FaunaSpawn, elapsed: number, reducedMotion: boolean, movement: number): FaunaClipKey {
  if (reducedMotion) return 'idle'
  if (movement > 0.15) return 'walk'
  return Math.sin(elapsed * 0.31 + spawn.phase) > 0.15 ? 'forage' : 'idle'
}

function sameIds<T extends { id: string }>(current: readonly T[], next: readonly T[]): boolean {
  return current.length === next.length && current.every((item, index) => item.id === next[index]?.id)
}

function clipForName(clips: readonly THREE.AnimationClip[], clipName: string): THREE.AnimationClip | undefined {
  return clips.find((clip) => clip.name === clipName)
}

function requiredFbxClip(source: THREE.Group, path: string): THREE.AnimationClip {
  const clip = (source as FbxAnimationGroup).animations[0]
  if (!clip) throw new Error(`FBX animation source has no animation clip: ${path}`)
  return clip
}

/**
 * A handful of skinned animals and monsters are reserved for close, high-quality moments.
 * The original instanced fauna remains the scalable fallback for the rest.
 */
export class AnimatedFaunaLayer {
  private readonly group = new THREE.Group()
  private readonly templates = new Map<FaunaSpecies, FaunaTemplate>()
  private readonly pending = new Set<FaunaSpecies>()
  private readonly failed = new Set<FaunaSpecies>()
  private readonly surface = createSurfacePoseScratch()
  private readonly actors: AnimatedFaunaActor[] = []
  private attachedScene: THREE.Scene | undefined
  private world: World | undefined
  private selected: readonly FaunaSpawn[] = []
  private fleeing = false
  private disposed = false

  public constructor(private readonly tileScale: number) {
    this.group.name = 'aetheria-animated-fauna-cc0'
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

  public setWorld(world: World, quality: EffectiveQuality): void {
    if (this.disposed) return
    this.world = world
    const limit = animatedActorLimit(quality)
    const candidates = generateFauna(world)
    const next: FaunaSpawn[] = []
    for (const asset of ANIMATED_FAUNA_ASSETS) {
      if (next.length >= limit) break
      const spawn = candidates.find((candidate) => candidate.species === asset.species)
      if (spawn) next.push(spawn)
    }

    const changed = !sameIds(this.selected, next)
    this.selected = next
    for (const spawn of next) this.loadTemplateFor(spawn.species)
    if (changed) this.rebuildActors()
  }

  public update(delta: number, elapsed: number, reducedMotion: boolean): void {
    const world = this.world
    if (this.disposed || !world) return
    const clampedDelta = Math.min(Math.max(0, delta), 0.1)
    for (const actor of this.actors) {
      const pose = faunaMotionPose(actor.spawn, elapsed, reducedMotion, this.fleeing)
      applySurfacePose(actor.root, world, this.tileScale, pose.tileX, pose.tileZ, pose.heading, actor.spawn.scale, this.surface)
      transitionTo(actor, faunaClipFor(actor.spawn, elapsed, reducedMotion, pose.movement))
      if (!reducedMotion) actor.mixer.update(clampedDelta)
    }
  }

  public setStormActive(active: boolean): void {
    this.fleeing = active
  }

  public dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.detach()
    this.clearActors()
    for (const template of this.templates.values()) disposeObjectResources(template.visual)
    this.templates.clear()
    this.selected = []
    this.group.clear()
  }

  private loadTemplateFor(species: FaunaSpecies): void {
    if (this.templates.has(species) || this.pending.has(species) || this.failed.has(species)) return
    const asset = ANIMATED_FAUNA_ASSETS.find((candidate) => candidate.species === species)
    if (!asset) return
    this.pending.add(species)
    void this.loadTemplate(asset).then((template) => {
      if (this.disposed) {
        disposeObjectResources(template.visual)
        return
      }
      this.templates.set(species, template)
      this.rebuildActors()
    }).catch(() => {
      this.failed.add(species)
    }).finally(() => {
      this.pending.delete(species)
    })
  }

  private async loadTemplate(asset: (typeof ANIMATED_FAUNA_ASSETS)[number]): Promise<FaunaTemplate> {
    const gltf = await new GLTFLoader().loadAsync(asset.path)
    const clips = new Map<FaunaClipKey, THREE.AnimationClip>()
    const fallbackClip = gltf.animations[0]
    for (const key of ['idle', 'forage', 'walk'] as const) {
      const clip = clipForName(gltf.animations, asset.clips[key]) ?? fallbackClip
      if (clip) clips.set(key, clip)
    }
    if (clips.size === 0 && fallbackClip) {
      clips.set('idle', fallbackClip)
      clips.set('walk', fallbackClip)
      clips.set('forage', fallbackClip)
    }
    setShadowFlags(gltf.scene)
    return { visual: gltf.scene, clips }
  }

  private rebuildActors(): void {
    this.clearActors()
    for (const spawn of this.selected) {
      const template = this.templates.get(spawn.species)
      if (!template) continue
      const root = new THREE.Group()
      let targetHeight = 0.22
      switch (spawn.species) {
        case 'dực-long':
        case 'dực-điểu':
          targetHeight = 0.65
          break
        case 'thạch-thú':
        case 'mộc-quái':
          targetHeight = 0.52
          break
        case 'cự-tượng':
          targetHeight = 0.58
          break
        case 'gấu-bắc-cực':
        case 'lạc-đà':
        case 'xà-vương':
          targetHeight = 0.32
          break
        case 'lang-tộc':
        case 'hươu-rừng':
        case 'lợn-rừng':
        case 'sơn-dương':
        case 'báo-đốm':
        case 'cá-sấu':
          targetHeight = 0.22
          break
        case 'sói-hoang':
        case 'cáo-tuyết':
        case 'bọ-cạp-vàng':
          targetHeight = 0.16
          break
        case 'thỏ-hoang':
        default:
          targetHeight = 0.09
          break
      }
      const visual = createNormalisedVisual(template.visual, targetHeight)
      root.name = `aetheria-animated-${spawn.species}-${spawn.id}`
      root.add(visual)
      const mixer = new THREE.AnimationMixer(visual)
      const actor: AnimatedFaunaActor = {
        root,
        visual,
        mixer,
        spawn,
        actions: addActions(mixer, template.clips),
        activeAction: undefined,
      }
      if (template.clips.size > 0) {
        transitionTo(actor, 'idle')
      }
      this.actors.push(actor)
      this.group.add(root)
    }
  }

  private clearActors(): void {
    for (const actor of this.actors) {
      actor.mixer.stopAllAction()
      actor.mixer.uncacheRoot(actor.visual)
      this.group.remove(actor.root)
    }
    this.actors.length = 0
  }
}

/**
 * The rigged foreground residents complement the batched tool-working settlers.
 * Keeping the count very low avoids turning a stylized colony view into a CPU-bound skinned crowd.
 */
export class AnimatedSettlerLayer {
  private readonly group = new THREE.Group()
  private readonly surface = createSurfacePoseScratch()
  private readonly actors: AnimatedSettlerActor[] = []
  private template: SettlerTemplate | undefined
  private templatePromise: Promise<SettlerTemplate> | undefined
  private attachedScene: THREE.Scene | undefined
  private world: World | undefined
  private selected: readonly SettlerPlacement[] = []
  private disposed = false

  public constructor(private readonly tileScale: number) {
    this.group.name = 'aetheria-animated-settlers-cc0'
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

  public setSettlers(world: World, placements: readonly SettlerPlacement[], quality: EffectiveQuality): void {
    if (this.disposed) return
    this.world = world
    const next = placements.slice(0, animatedActorLimit(quality))
    const changed = !sameIds(this.selected, next)
    this.selected = next
    if (next.length > 0) this.loadTemplate()
    if (changed) this.rebuildActors()
  }

  public update(delta: number, elapsed: number, reducedMotion: boolean): void {
    const world = this.world
    if (this.disposed || !world) return
    const clampedDelta = Math.min(Math.max(0, delta), 0.1)
    for (const actor of this.actors) {
      const pose = settlerMotionPose(actor.settler, elapsed, reducedMotion)
      applySurfacePose(actor.root, world, this.tileScale, pose.tileX, pose.tileZ, pose.heading, actor.settler.scale, this.surface)
      transitionTo(actor, reducedMotion || pose.movement < 0.26 ? 'idle' : 'run')
      if (!reducedMotion) actor.mixer.update(clampedDelta * 0.62)
    }
  }

  public dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.detach()
    this.clearActors()
    if (this.template) disposeObjectResources(this.template.visual)
    this.template = undefined
    this.selected = []
    this.group.clear()
  }

  private loadTemplate(): void {
    if (this.template || this.templatePromise) return
    this.templatePromise = this.createTemplate()
    void this.templatePromise.then((template) => {
      if (this.disposed) {
        disposeObjectResources(template.visual)
        return
      }
      this.template = template
      this.rebuildActors()
    }).catch(() => {
      // Batched procedural residents stay visible if a device cannot parse the optional FBX files.
    }).finally(() => {
      this.templatePromise = undefined
    })
  }

  private async createTemplate(): Promise<SettlerTemplate> {
    if (ANIMATED_SETTLER_ASSET.modelPath.endsWith('.glb') || ANIMATED_SETTLER_ASSET.modelPath.endsWith('.gltf')) {
      const gltf = await new GLTFLoader().loadAsync(ANIMATED_SETTLER_ASSET.modelPath)
      const clips = new Map<SettlerClipKey, THREE.AnimationClip>()
      const fallbackClip = gltf.animations[0]
      for (const key of ['idle', 'run', 'jump'] as const) {
        const clip = clipForName(gltf.animations, ANIMATED_SETTLER_ASSET.clips[key]) ?? fallbackClip
        if (clip) clips.set(key, clip)
      }
      if (clips.size === 0 && fallbackClip) {
        clips.set('idle', fallbackClip)
        clips.set('run', fallbackClip)
        clips.set('jump', fallbackClip)
      }
      setShadowFlags(gltf.scene)
      return { visual: gltf.scene, clips }
    }

    const [character, idle, run, jump] = await Promise.all([
      new FBXLoader().loadAsync(ANIMATED_SETTLER_ASSET.modelPath),
      new FBXLoader().loadAsync(ANIMATED_SETTLER_ASSET.clips.idle),
      new FBXLoader().loadAsync(ANIMATED_SETTLER_ASSET.clips.run),
      new FBXLoader().loadAsync(ANIMATED_SETTLER_ASSET.clips.jump),
    ])

    const clips = new Map<SettlerClipKey, THREE.AnimationClip>([
      ['idle', requiredFbxClip(idle, ANIMATED_SETTLER_ASSET.clips.idle)],
      ['run', requiredFbxClip(run, ANIMATED_SETTLER_ASSET.clips.run)],
      ['jump', requiredFbxClip(jump, ANIMATED_SETTLER_ASSET.clips.jump)],
    ])

    setShadowFlags(character)
    return { visual: character, clips }
  }

  private rebuildActors(): void {
    this.clearActors()
    const template = this.template
    if (!template) return
    for (const settler of this.selected) {
      const root = new THREE.Group()
      const visual = createNormalisedVisual(template.visual, 0.22)
      root.name = `aetheria-animated-${settler.id}`
      root.add(visual)
      const mixer = new THREE.AnimationMixer(visual)
      const actor: AnimatedSettlerActor = {
        root,
        visual,
        mixer,
        settler,
        actions: addActions(mixer, template.clips),
        activeAction: undefined,
      }
      if (template.clips.size > 0) {
        transitionTo(actor, 'idle')
      }
      this.actors.push(actor)
      this.group.add(root)
    }
  }

  private clearActors(): void {
    for (const actor of this.actors) {
      actor.mixer.stopAllAction()
      actor.mixer.uncacheRoot(actor.visual)
      this.group.remove(actor.root)
    }
    this.actors.length = 0
  }
}

export const __animatedActorTestables = {
  animatedActorLimit,
  faunaClipFor,
  faunaMotionPose,
  settlerMotionPose,
}

