export interface GamePackModelEntry {
  id: string
  name: string
  category: 'nature' | 'props' | 'characters'
  path: string
  scale: number
}

export const GAME_PACK_MODELS: Record<string, GamePackModelEntry> = {
  // Stylized Nature
  'tree-common-1': {
    id: 'tree-common-1',
    name: 'Cây Rừng Stylized 1',
    category: 'nature',
    path: '/assets/pack/nature/CommonTree_1.gltf',
    scale: 0.65,
  },
  'tree-common-2': {
    id: 'tree-common-2',
    name: 'Cây Rừng Stylized 2',
    category: 'nature',
    path: '/assets/pack/nature/CommonTree_2.gltf',
    scale: 0.65,
  },
  'tree-common-3': {
    id: 'tree-common-3',
    name: 'Cây Rừng Stylized 3',
    category: 'nature',
    path: '/assets/pack/nature/CommonTree_3.gltf',
    scale: 0.65,
  },
  'bush-common': {
    id: 'bush-common',
    name: 'Bụi Cây Stylized',
    category: 'nature',
    path: '/assets/pack/nature/Bush_Common.gltf',
    scale: 0.45,
  },
  'dead-tree-1': {
    id: 'dead-tree-1',
    name: 'Cây Khô Cằn',
    category: 'nature',
    path: '/assets/pack/nature/DeadTree_1.gltf',
    scale: 0.6,
  },

  // Fantasy Props
  'prop-anvil': {
    id: 'prop-anvil',
    name: 'Đe Rèn Kim Khí',
    category: 'props',
    path: '/assets/pack/props/Anvil.gltf',
    scale: 0.5,
  },
  'prop-barrel': {
    id: 'prop-barrel',
    name: 'Thùng Gỗ Trữ Lương',
    category: 'props',
    path: '/assets/pack/props/Barrel.gltf',
    scale: 0.5,
  },
  'prop-barrel-apples': {
    id: 'prop-barrel-apples',
    name: 'Thùng Quả Thu Hoạch',
    category: 'props',
    path: '/assets/pack/props/Barrel_Apples.gltf',
    scale: 0.5,
  },
  'prop-bench': {
    id: 'prop-bench',
    name: 'Ghế Gỗ Dân Làng',
    category: 'props',
    path: '/assets/pack/props/Bench.gltf',
    scale: 0.5,
  },
  'prop-banner': {
    id: 'prop-banner',
    name: 'Cờ Hiệu Làng',
    category: 'props',
    path: '/assets/pack/props/Banner_1.gltf',
    scale: 0.6,
  },

  // Characters & Equipment
  'char-axe': {
    id: 'char-axe',
    name: 'Rìu Đốn Gỗ',
    category: 'characters',
    path: '/assets/pack/characters/axe_1handed.gltf',
    scale: 0.4,
  },
  'char-sword': {
    id: 'char-sword',
    name: 'Kiếm Phòng Vệ',
    category: 'characters',
    path: '/assets/pack/characters/sword_1handed.gltf',
    scale: 0.4,
  },
  'char-shield': {
    id: 'char-shield',
    name: 'Khiên Dân Binh',
    category: 'characters',
    path: '/assets/pack/characters/shield_round.gltf',
    scale: 0.4,
  },
}

export const GAME_PACK_AUDIO = {
  ambientTheme: '/assets/pack/audio/ambient_theme.ogg',
  ambientExplore: '/assets/pack/audio/ambient_explore.ogg',
  ambientPeaceful: '/assets/pack/audio/ambient_peaceful.ogg',
}
