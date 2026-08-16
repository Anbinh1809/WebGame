import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Minimap } from './Minimap'
import { generateWorld } from '../world/generator'
import { createSimulation } from '../simulation/engine'
import { DEFAULT_WORLD_CONFIG } from '../world/types'

describe('Minimap component', () => {
  it('renders the minimap header, weather indicator, and navigation canvas', () => {
    const world = generateWorld(DEFAULT_WORLD_CONFIG)
    const simulation = createSimulation(world)

    const markup = renderToStaticMarkup(
      <Minimap world={world} simulation={simulation} onSelectTile={() => undefined} />,
    )

    expect(markup).toContain('aetheria-minimap-container')
    expect(markup).toContain('minimap-header')
    expect(markup).toContain('minimap-canvas')
    expect(markup).toContain('minimap-footer')
  })

  it('renders hovered tile information when a tile is provided', () => {
    const world = generateWorld(DEFAULT_WORLD_CONFIG)
    const simulation = createSimulation(world)
    const sampleTile = world.tiles[0]!

    const markup = renderToStaticMarkup(
      <Minimap
        world={world}
        simulation={simulation}
        hoveredTile={{ index: 0, tile: sampleTile }}
        onSelectTile={() => undefined}
      />,
    )

    expect(markup).toContain('biome-tag')
    expect(markup).toContain('coord-tag')
    expect(markup).toContain('[0, 0]')
  })
})
