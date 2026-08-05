import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LandingPage } from './LandingPage'

describe('landing page', () => {
  it('has one H1, accessible demo CTA, truthful commercial states, and no game canvas', () => {
    const markup = renderToStaticMarkup(<LandingPage />)
    expect((markup.match(/<h1/g) ?? [])).toHaveLength(1)
    expect(markup).toContain('href="/play"')
    expect(markup).toContain('Chơi thử miễn phí (Web 1K)')
    expect(markup).toContain('Coming soon')
    expect(markup).toContain('Texture-pack quality')
    expect(markup).toContain('FAQPage')
    expect(markup).not.toContain('<canvas')
  })
})
