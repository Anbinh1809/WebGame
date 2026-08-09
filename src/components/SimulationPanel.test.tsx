import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SimulationPanel } from './SimulationPanel'
import { createSimulation } from '../simulation/engine'
import { generateWorld } from '../world/generator'
import type { WorldConfig } from '../world/types'

const config: WorldConfig = { seed: 'knowledge-panel', size: 28, climate: 'ôn hòa', water: 0.54, resources: 0.62 }

describe('simulation panel knowledge flow', () => {
  it('shows a transparent, player-facing compatibility check and contextual suggestions', () => {
    const world = generateWorld(config)
    const markup = renderToStaticMarkup(
      <SimulationPanel
        world={world}
        simulation={createSimulation(world)}
        selectedTile={undefined}
        heatmap="địa hình"
        onHeatmapChange={() => undefined}
        onPauseToggle={() => undefined}
        onSpeedChange={() => undefined}
        onPhoto={() => undefined}
        onCouncilDecision={() => undefined}
        onDevelopVillageTool={() => undefined}
        onSubmitKnowledge={() => undefined}
      />,
    )

    expect(markup).toContain('Viện tri thức')
    expect(markup).toContain('knowledge-proposal')
    expect(markup).toContain('Thẩm định &amp; truyền')
    expect(markup).toContain('Giữ lửa và hong khô')
    expect(markup).toContain('Thời đồ đá')
    expect(markup).not.toContain('Thời Đồ Đá')
    expect(markup).toContain('Thú &amp; sinh vật')
    expect(markup).toContain('Hệ sinh thái theo seed')
  })
})
