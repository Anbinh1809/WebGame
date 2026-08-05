import { seedToUint32 } from '../world/prng'
import type { SimulationState, WorldObjectiveId } from '../simulation/types'
import type { TerrainKind, ToolId, World } from '../world/types'

export const PROCEDURAL_CHRONICLE_VERSION = 'aetheria-procedural-chronicle-v1'

export type ChronicleTone = 'calm' | 'hopeful' | 'ominous' | 'triumphant'

export interface ChronicleDigestVillage {
  name: string
  biome: TerrainKind
  population: number
  food: number
  happiness: number
  resilience: number
  resources: number
}

export interface ChronicleDigestObjective {
  id: WorldObjectiveId
  title: string
  completed: boolean
}

/**
 * A bounded snapshot of deterministic game state. It is presentation data
 * only: creating a chronicle never changes the world or simulation.
 */
export interface ChronicleDigest {
  version: number
  seed: string
  tick: number
  era: string
  biome: TerrainKind
  population: number
  food: number
  happiness: number
  resources: number
  disaster: 'storm' | 'none'
  villages: ChronicleDigestVillage[]
  recentGodTools: Array<{ tool: ToolId; uses: number }>
  objectives: ChronicleDigestObjective[]
}

export interface ProceduralChronicle {
  chronicle: string
  causalInsights: [string, string]
  legend: string
  godOpportunity: WorldObjectiveId | null
  tone: ChronicleTone
}

function cleanText(value: string, maximum: number): string {
  let withoutControls = ''
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index] ?? ''
    const code = character.charCodeAt(0)
    withoutControls += code <= 0x1f || code === 0x7f ? ' ' : character
  }
  return withoutControls
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximum)
}

export function createChronicleDigest(world: World, simulation: SimulationState): ChronicleDigest {
  const villages = simulation.villages.map((village) => {
    const home = world.tiles[village.tileIndex]
    return {
      name: cleanText(village.name, 72),
      biome: home?.biome ?? 'đồng cỏ',
      population: village.population,
      food: Math.round(village.food),
      happiness: Math.round(village.happiness),
      resilience: Math.round(village.resilience),
      resources: Math.round((home?.resources ?? 0) * 100),
    }
  })
  const primary = villages[0]
  const population = villages.reduce((total, village) => total + village.population, 0)
  const food = villages.reduce((total, village) => total + village.food, 0)
  const happiness = villages.length === 0
    ? 0
    : Math.round(villages.reduce((total, village) => total + village.happiness, 0) / villages.length)
  const resources = villages.length === 0
    ? 0
    : Math.round(villages.reduce((total, village) => total + village.resources, 0) / villages.length)

  return {
    version: 1,
    seed: cleanText(world.config.seed, 64),
    tick: simulation.tick,
    era: cleanText(simulation.villages[0]?.era ?? 'Mầm lửa', 48),
    biome: primary?.biome ?? 'đồng cỏ',
    population,
    food,
    happiness,
    resources,
    disaster: simulation.activeStorm ? 'storm' : 'none',
    villages,
    recentGodTools: (Object.entries(simulation.godToolUses) as Array<[ToolId, number]>)
      .filter(([, uses]) => uses > 0)
      .map(([tool, uses]) => ({ tool, uses })),
    objectives: simulation.objectives.map((objective) => ({
      id: objective.id,
      title: cleanText(objective.title, 96),
      completed: objective.completed,
    })),
  }
}

/** Deterministic narration derived only from the supplied seed, tick, and digest. */
export function createProceduralChronicle(digest: ChronicleDigest): ProceduralChronicle {
  const seed = seedToUint32(`${digest.seed}-${digest.tick}-${PROCEDURAL_CHRONICLE_VERSION}`)
  const village = digest.villages[0]
  const isStorm = digest.disaster === 'storm'
  const tone: ChronicleTone = isStorm
    ? 'ominous'
    : digest.happiness >= 76 && digest.food >= Math.max(1, digest.population * 2)
      ? 'triumphant'
      : digest.happiness >= 70
        ? 'hopeful'
        : 'calm'
  const opening = isStorm
    ? `Mây giông phủ xuống ${village?.name ?? 'Aetheria'}, nhưng những ngọn đèn vẫn chưa tắt.`
    : `${village?.name ?? 'Thung lũng đầu tiên'} bước qua ngày ${Math.floor(digest.tick / 6) + 1} với nhịp thở chậm rãi của ${digest.biome}.`
  const legendChoices = ['Ngọn Đèn Sớm Mai', 'Vệt Rễ Thầm', 'Chuông Đá Mưa', 'Lối Mòn Hổ Phách']
  const legend = legendChoices[seed % legendChoices.length] ?? 'Lời Hứa Đầu Tiên'
  const incomplete = digest.objectives.filter((objective) => !objective.completed)
  const godOpportunity = incomplete[seed % Math.max(1, incomplete.length)]?.id ?? null
  const foodInsight = digest.food >= digest.population * 2
    ? 'Lương thực dự trữ vượt nhu cầu dân số, nên hạnh phúc có nền tảng để tăng.'
    : 'Lương thực chưa đủ rộng rãi so với dân số, nên niềm vui và tăng trưởng cần được bảo vệ.'
  const ecologyInsight = village && village.resilience >= 55
    ? 'Sức chống chịu của làng giúp giảm cú sốc và rút ngắn đường hồi phục sau thiên tai.'
    : 'Đất, nước và rừng quanh làng còn cần được nuôi dưỡng để sức chống chịu không tụt khi bão đến.'

  return {
    chronicle: `${opening} Biên niên sử ghi nhận ${digest.population} cư dân, ${digest.food} phần lương thực và dấu ấn của ${digest.recentGodTools.length} quyền năng thần.`,
    causalInsights: [foodInsight, ecologyInsight],
    legend,
    godOpportunity,
    tone,
  }
}
