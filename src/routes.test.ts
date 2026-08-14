import { describe, expect, it } from 'vitest'
import { appPath, routeForPathname } from './routes'

describe('application routes', () => {
  it('keeps marketing at the root and loads the game only for /play', () => {
    expect(routeForPathname('/')).toBe('landing')
    expect(routeForPathname('/play')).toBe('play')
    expect(routeForPathname('/play/')).toBe('play')
    expect(routeForPathname('/unknown')).toBe('landing')
  })

  it('keeps game links inside a configured static-host base path', () => {
    expect(routeForPathname('/WebGame/play', '/WebGame/')).toBe('play')
    expect(routeForPathname('/WebGame/play/', '/WebGame/')).toBe('play')
    expect(routeForPathname('/WebGame/', '/WebGame/')).toBe('landing')
    expect(routeForPathname('/other/play', '/WebGame/')).toBe('landing')
    expect(appPath('/')).toMatch(/\/$/u)
    expect(appPath('/play')).toMatch(/\/play$/u)
  })
})
