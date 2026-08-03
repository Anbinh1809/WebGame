import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FullscreenButton } from './FullscreenButton'
import { GameDrawer } from './GameDrawer'

describe('HUD accessibility components', () => {
  it('renders a labelled drawer with a close control', () => {
    const markup = renderToStaticMarkup(<GameDrawer id="world-controls-drawer" label="Điều khiển thế giới" side="left" onClose={() => undefined}><button type="button">Nội dung</button></GameDrawer>)
    expect(markup).toContain('aria-label="Điều khiển thế giới"')
    expect(markup).toContain('aria-label="Đóng Điều khiển thế giới"')
  })

  it('renders the fullscreen state as an accessible pressed button', () => {
    const markup = renderToStaticMarkup(<FullscreenButton active={false} onToggle={() => undefined} />)
    expect(markup).toContain('aria-pressed="false"')
    expect(markup).toContain('aria-label="Bật toàn màn hình"')
  })
})
