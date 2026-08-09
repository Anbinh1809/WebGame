import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PlayerAuthProvider } from '../auth/PlayerAuthContext'
import { LandingPage } from './LandingPage'

describe('landing page', () => {
  it('has one H1, accessible demo CTA, truthful commercial states, and no game canvas', () => {
    const markup = renderToStaticMarkup(<PlayerAuthProvider><LandingPage /></PlayerAuthProvider>)
    expect((markup.match(/<h1/g) ?? [])).toHaveLength(1)
    expect(markup).toContain('href="/play"')
    expect(markup).toContain('Chơi thử miễn phí (bản web 1K)')
    expect(markup).toContain('Sắp ra mắt')
    expect(markup).toContain('Độ phân giải texture độc lập với chất lượng kết xuất')
    expect(markup).not.toContain('God-simulator')
    expect(markup).toContain('FAQPage')
    expect(markup).toContain('id="player-account"')
    expect(markup).toContain('Hồ sơ tùy chọn')
    expect(markup).not.toContain('<canvas')
  })
})
