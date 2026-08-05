export type AppRoute = 'landing' | 'play'

export function routeForPathname(pathname: string): AppRoute {
  return pathname === '/play' || pathname === '/play/' ? 'play' : 'landing'
}
