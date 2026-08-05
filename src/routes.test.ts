import { describe, expect, it } from 'vitest'
import { routeForPathname } from './routes'

describe('application routes', () => {
  it('keeps marketing at the root and loads the game only for /play', () => {
    expect(routeForPathname('/')).toBe('landing')
    expect(routeForPathname('/play')).toBe('play')
    expect(routeForPathname('/play/')).toBe('play')
    expect(routeForPathname('/unknown')).toBe('landing')
  })
})
