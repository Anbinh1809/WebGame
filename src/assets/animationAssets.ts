export interface AnimatedFaunaAssetDefinition {
  readonly species: 'hươu-rừng' | 'sơn-dương'
  readonly path: string
  readonly sourceUrl: string
  readonly license: 'CC0-1.0'
  /** These low-poly models have vertex colours, not resolution-dependent texture maps. */
  readonly resolutionPolicy: 'shared-untextured-rig'
  readonly clips: {
    readonly idle: string
    readonly forage: string
    readonly walk: string
  }
}

export const ANIMATED_FAUNA_ASSETS = [
  {
    species: 'hươu-rừng',
    path: '/assets/animation/cc0/animals/deer.glb',
    sourceUrl: 'https://quaternius.com/packs/ultimateanimatedanimals.html',
    license: 'CC0-1.0',
    resolutionPolicy: 'shared-untextured-rig',
    clips: { idle: 'Idle', forage: 'Eating', walk: 'Walk' },
  },
  {
    species: 'sơn-dương',
    path: '/assets/animation/cc0/animals/stag.glb',
    sourceUrl: 'https://quaternius.com/packs/ultimateanimatedanimals.html',
    license: 'CC0-1.0',
    resolutionPolicy: 'shared-untextured-rig',
    clips: { idle: 'Idle_Headlow', forage: 'Eating', walk: 'Walk' },
  },
] as const satisfies readonly AnimatedFaunaAssetDefinition[]

export interface AnimatedSettlerAssetDefinition {
  readonly modelPath: string
  readonly sourceUrl: string
  readonly license: 'CC0-1.0'
  /** The source is an untextured rig; it must not be advertised as fabricated 2K–8K texture tiers. */
  readonly resolutionPolicy: 'shared-untextured-rig'
  readonly clips: {
    readonly idle: string
    readonly run: string
    readonly jump: string
  }
}

export const ANIMATED_SETTLER_ASSET: AnimatedSettlerAssetDefinition = {
  modelPath: '/assets/animation/cc0/settlers/character-medium.fbx',
  sourceUrl: 'https://opengameart.org/content/animated-characters-1',
  license: 'CC0-1.0',
  resolutionPolicy: 'shared-untextured-rig',
  clips: {
    idle: '/assets/animation/cc0/settlers/idle.fbx',
    run: '/assets/animation/cc0/settlers/run.fbx',
    jump: '/assets/animation/cc0/settlers/jump.fbx',
  },
}
