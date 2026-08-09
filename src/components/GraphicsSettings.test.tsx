import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createGraphicsQualityOverrides } from '../renderer/quality'
import { GraphicsSettings } from './GraphicsSettings'

describe('graphics settings', () => {
  it('exposes independent 3D component controls and the 1K through 8K texture mapping', () => {
    const markup = renderToStaticMarkup(
      <GraphicsSettings
        quality="ultra"
        overrides={createGraphicsQualityOverrides({ shadows: 'ultra', water: 'low' })}
        assetPackQuality="cinema-8k"
        desktopEdition
        desktopPackAvailability={{ 'desktop-2k': true, 'desktop-4k': true, 'cinema-8k': false }}
        cinema8kEntitled={false}
        onQualityChange={() => undefined}
        onOverridesChange={() => undefined}
        onAssetPackQualityChange={() => undefined}
      />,
    )

    expect(markup).toContain('Tùy chỉnh đồ họa')
    expect(markup).toContain('graphics-shadows-quality')
    expect(markup).toContain('graphics-water-quality')
    expect(markup).toContain('Gói texture Poly Haven')
    expect(markup).toContain('value="cinema-8k" disabled=""')
    expect(markup).toContain('Cực cao · texture nguồn 8K')
  })
})
