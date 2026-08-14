import type { FaunaSpecies } from '../world/fauna'

export interface AnimatedFaunaAssetDefinition {
  readonly species: FaunaSpecies
  readonly path: string
  readonly sourceUrl: string
  readonly license: string
  readonly resolutionPolicy: 'shared-untextured-rig' | 'textured-gltf'
  readonly clips: {
    readonly idle: string
    readonly forage: string
    readonly walk: string
  }
}

export const ANIMATED_FAUNA_ASSETS: readonly AnimatedFaunaAssetDefinition[] = [
  {
    species: 'dực-long',
    path: '/assets/models/monsters/mountain_dragon_1k.glb',
    sourceUrl: 'Sketchfab Mountain Dragon by Alexey Zaika',
    license: 'CC Attribution',
    resolutionPolicy: 'textured-gltf',
    clips: { idle: 'Take 001', forage: 'Take 001', walk: 'Take 001' },
  },
  {
    species: 'thạch-thú',
    path: '/assets/models/monsters/lava_golem_1k.glb',
    sourceUrl: 'Sketchfab Lava Golem',
    license: 'CC Attribution',
    resolutionPolicy: 'textured-gltf',
    clips: { idle: 'idle', forage: 'walk', walk: 'walk' },
  },
  {
    species: 'mộc-quái',
    path: '/assets/models/monsters/tree_golem_1k.glb',
    sourceUrl: 'Sketchfab Tree Golem',
    license: 'CC Attribution',
    resolutionPolicy: 'textured-gltf',
    clips: { idle: 'idle', forage: 'walk', walk: 'walk' },
  },
  {
    species: 'hồn-cát',
    path: '/assets/models/monsters/skeleton_1k.glb',
    sourceUrl: 'Sketchfab Animated Skeleton',
    license: 'CC Attribution',
    resolutionPolicy: 'textured-gltf',
    clips: { idle: 'Take 001', forage: 'Take 001', walk: 'Take 001' },
  },
  {
    species: 'hươu-rừng',
    path: '/assets/models/animals/animated_deer.glb',
    sourceUrl: 'Sketchfab Animated Deer',
    license: 'CC Attribution',
    resolutionPolicy: 'textured-gltf',
    clips: { idle: 'GltfAnimation 0', forage: 'GltfAnimation 0', walk: 'GltfAnimation 0' },
  },
  {
    species: 'sơn-dương',
    path: '/assets/models/animals/horse_1k.glb',
    sourceUrl: 'Sketchfab Horse Animated',
    license: 'CC Attribution',
    resolutionPolicy: 'textured-gltf',
    clips: { idle: 'Take 001', forage: 'Take 001', walk: 'Take 001' },
  },
  {
    species: 'lợn-rừng',
    path: '/assets/models/animals/cave_bear_1k.glb',
    sourceUrl: 'Sketchfab Cave Bear',
    license: 'CC Attribution',
    resolutionPolicy: 'textured-gltf',
    clips: { idle: 'Take 001', forage: 'Take 001', walk: 'Take 001' },
  },
  {
    species: 'sói-hoang',
    path: '/assets/models/animals/wolf_1k.glb',
    sourceUrl: 'Sketchfab Arctic Wolf',
    license: 'CC Attribution',
    resolutionPolicy: 'textured-gltf',
    clips: { idle: 'Take 001', forage: 'Take 001', walk: 'Take 001' },
  },
  {
    species: 'cự-tượng',
    path: '/assets/models/animals/elephant.glb',
    sourceUrl: 'Sketchfab Ancient War Elephant',
    license: 'CC Attribution',
    resolutionPolicy: 'textured-gltf',
    clips: { idle: 'Take 001', forage: 'Take 001', walk: 'Take 001' },
  },
  {
    species: 'lang-tộc',
    path: '/assets/models/monsters/werewolf.glb',
    sourceUrl: 'Sketchfab Bloodmoon Werewolf',
    license: 'CC Attribution',
    resolutionPolicy: 'textured-gltf',
    clips: { idle: 'Take 001', forage: 'Take 001', walk: 'Take 001' },
  },
  {
    species: 'dực-điểu',
    path: '/assets/models/monsters/griffin.glb',
    sourceUrl: 'Sketchfab Mythical Griffin',
    license: 'CC Attribution',
    resolutionPolicy: 'textured-gltf',
    clips: { idle: 'Take 001', forage: 'Take 001', walk: 'Take 001' },
  },
] as const

export interface AnimatedSettlerAssetDefinition {
  readonly modelPath: string
  readonly sourceUrl: string
  readonly license: string
  readonly resolutionPolicy: 'shared-untextured-rig' | 'textured-gltf'
  readonly clips: {
    readonly idle: string
    readonly run: string
    readonly jump: string
  }
}

export const ANIMATED_SETTLER_ASSET: AnimatedSettlerAssetDefinition = {
  modelPath: '/assets/models/characters/wizard_1k.glb',
  sourceUrl: 'Sketchfab Old Wizard',
  license: 'CC Attribution',
  resolutionPolicy: 'textured-gltf',
  clips: {
    idle: 'idle',
    run: 'walk',
    jump: 'attack',
  },
}

export const ANIMATED_SETTLER_ASSETS: readonly AnimatedSettlerAssetDefinition[] = [
  ANIMATED_SETTLER_ASSET,
  {
    modelPath: '/assets/models/characters/female_knight.glb',
    sourceUrl: 'Sketchfab Female Knight',
    license: 'CC Attribution',
    resolutionPolicy: 'textured-gltf',
    clips: {
      idle: 'Take 001',
      run: 'Take 001',
      jump: 'Take 001',
    },
  },
  {
    modelPath: '/assets/models/characters/prophet_1k.glb',
    sourceUrl: 'Sketchfab Prophet',
    license: 'CC Attribution',
    resolutionPolicy: 'textured-gltf',
    clips: {
      idle: 'idle',
      run: 'walk',
      jump: 'attack',
    },
  },
]
