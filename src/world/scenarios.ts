import type { WorldConfig } from './types'

export type ScenarioDifficulty = 'dễ' | 'trung-bình' | 'thử-thách' | 'khắc-nghiệt' | 'thần-thoại'

export interface MapScenario {
  id: string
  name: string
  tagline: string
  description: string
  difficulty: ScenarioDifficulty
  difficultyLabel: string
  icon: string
  accentColor: string
  config: WorldConfig
  initialBlessing: string
}

export const STARTER_SCENARIOS: readonly MapScenario[] = [
  {
    id: 'sunrise-vale',
    name: 'Thung Lũng Bình Minh',
    tagline: 'Vùng đồng bằng trù phú & sông suối hiền hòa',
    description: 'Vùng đất màu mỡ với nguồn nước dồi dào, thảm thực vật phong phú và khí hậu ấm áp. Lý tưởng để khởi đầu xây dựng một nền văn minh phồn thịnh.',
    difficulty: 'dễ',
    difficultyLabel: 'Dễ Khởi Đầu',
    icon: '🌿',
    accentColor: '#5ecb72',
    config: {
      seed: 'aetheria-thung-lung-binh-minh',
      size: 48,
      climate: 'ôn hòa',
      water: 0.52,
      resources: 0.75,
    },
    initialBlessing: 'Lương thực ban đầu dồi dào (+20% sinh sôi)',
  },
  {
    id: 'coral-archipelago',
    name: 'Quần Đảo San Hô',
    tagline: 'Quần đảo nhiệt đới giữa biển xanh sâu thẳm',
    description: 'Địa hình gồm nhiều đảo nổi giữa đại dương rộng lớn. Dân làng cần khéo léo kết nối các bờ biển, khai thác bãi bồi và phát triển ngành ngư nghiệp.',
    difficulty: 'trung-bình',
    difficultyLabel: 'Trung Bình',
    icon: '🏝️',
    accentColor: '#38bdf8',
    config: {
      seed: 'aetheria-quan-dao-san-ho',
      size: 48,
      climate: 'ấm',
      water: 0.74,
      resources: 0.65,
    },
    initialBlessing: 'Tài nguyên bờ biển & gió bão thuận hòa',
  },
  {
    id: 'frostpeak-highlands',
    name: 'Cao Nguyên Băng Tuyết',
    tagline: 'Núi non tuyết phủ & khí hậu giá lạnh',
    description: 'Vùng đồi núi cao nguyên hiểm trở với nhiệt độ đóng băng và đất đai cằn cỗi. Đòi hỏi đấng sáng thế phải điều chỉnh địa hình để tạo nơi trú ẩn ấm áp.',
    difficulty: 'thử-thách',
    difficultyLabel: 'Thử Thách Lớn',
    icon: '🏔️',
    accentColor: '#93c5fd',
    config: {
      seed: 'aetheria-cao-nguyen-bang-tuyet',
      size: 48,
      climate: 'lạnh',
      water: 0.42,
      resources: 0.55,
    },
    initialBlessing: 'Khoáng thạch băng giá & gỗ cứng bền bỉ',
  },
  {
    id: 'ancient-oasis',
    name: 'Hoang Mạc Cổ Đại',
    tagline: 'Biển cát mênh mông quanh ốc đảo huyền bí',
    description: 'Khí hậu khô cằn nắng gắt, nguồn nước ngọt cực kỳ khan hiếm. Thử thách tài năng gọi mưa và hồi sinh thảm thực vật từ vùng cát bỏng.',
    difficulty: 'khắc-nghiệt',
    difficultyLabel: 'Khắc Nghiệt',
    icon: '🏜️',
    accentColor: '#f59e0b',
    config: {
      seed: 'aetheria-hoang-mac-co-dai',
      size: 48,
      climate: 'ấm',
      water: 0.28,
      resources: 0.48,
    },
    initialBlessing: 'Ốc đảo thần kỳ phục hồi mana nhanh',
  },
  {
    id: 'volcanic-crucible',
    name: 'Miền Núi Lửa Thần Thoại',
    tagline: 'Đất đá bazan nung nấu nguồn quặng vô tận',
    description: 'Vùng đất núi lửa sôi trào giàu tài nguyên kim khí quý hiếm nhưng giông bão sấm sét thường xuyên đe dọa sự sống của cư dân sơ khai.',
    difficulty: 'thần-thoại',
    difficultyLabel: 'Cấp Thần Thoại',
    icon: '🌋',
    accentColor: '#ef4444',
    config: {
      seed: 'aetheria-nui-lua-than-thoai',
      size: 48,
      climate: 'ấm',
      water: 0.38,
      resources: 0.95,
    },
    initialBlessing: 'Nhiệt lượng kim khí tăng tốc độ đúc rèn',
  },
]

export function getScenarioById(id: string): MapScenario | undefined {
  return STARTER_SCENARIOS.find((scenario) => scenario.id === id)
}
