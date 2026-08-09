import { describe, expect, it } from 'vitest'
import { createSimulation } from './engine'
import { assessVillageKnowledge, availableVillageKnowledge, isVillageKnowledgeLedger } from './knowledge'
import type { VillageKnowledgeId } from './types'
import { generateWorld } from '../world/generator'
import type { WorldConfig } from '../world/types'

const config: WorldConfig = {
  seed: 'knowledge-compatibility',
  size: 28,
  climate: 'ôn hòa',
  water: 0.54,
  resources: 0.62,
}

describe('village knowledge compatibility', () => {
  it('matches player wording to a finite, transparent catalogue', () => {
    const village = createSimulation(generateWorld(config)).villages[0]!

    expect(assessVillageKnowledge(village, 'Giữ lửa và hong khô')).toMatchObject({
      status: 'accepted',
      knowledgeId: 'fire-stewardship',
    })
    expect(assessVillageKnowledge(village, 'Giữ lửa và hong khô').detail).toContain('Thời đồ đá')
    expect(availableVillageKnowledge(village).map((knowledge) => knowledge.id)).toContain('fire-stewardship')
  })

  it('rejects an idea when its tool or knowledge prerequisite is not present', () => {
    const village = createSimulation(generateWorld(config)).villages[0]!

    expect(assessVillageKnowledge(village, 'Dẫn nước ruộng')).toMatchObject({ status: 'too-advanced', knowledgeId: 'irrigation-channel' })
    const afterFire = { ...village, knowledge: ['fire-stewardship'] as VillageKnowledgeId[] }
    expect(assessVillageKnowledge(afterFire, 'Đan giỏ và dự trữ')).toMatchObject({
      status: 'accepted',
      knowledgeId: 'weaving-and-storage',
    })
  })

  it('calls out future technology and rejects forged knowledge ledgers', () => {
    const village = createSimulation(generateWorld(config)).villages[0]!

    const futureTechnology = assessVillageKnowledge(village, 'máy tính')
    expect(futureTechnology).toMatchObject({ status: 'too-advanced' })
    expect(futureTechnology.detail).toContain('Thời đồ đá')
    expect(isVillageKnowledgeLedger(['masonry'], village.tools)).toBe(false)
    expect(isVillageKnowledgeLedger(['fire-stewardship', 'fire-stewardship'], village.tools)).toBe(false)
  })
})
