import { lazy, Suspense, useEffect, useState } from 'react'
import type { JSX } from 'react'
import { routeForPathname } from '../routes'
import { LandingPage } from './LandingPage'

const GameApp = lazy(() => import('../App'))

export function AetheriaRouter(): JSX.Element {
  const [route, setRoute] = useState(() => routeForPathname(window.location.pathname))

  useEffect(() => {
    const onPopState = (): void => setRoute(routeForPathname(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  if (route === 'play') {
    return (
      <Suspense
        fallback={(
          <main className="play-route-loading">
            <h1 className="sr-only">Aetheria: World Shaper</h1>
            <div role="status" aria-live="polite" aria-atomic="true">
              <strong>Đang mở bản chơi thử Web 1K…</strong>
              <span>Three.js chỉ được tải khi bạn mở màn chơi.</span>
            </div>
          </main>
        )}
      >
        <GameApp />
      </Suspense>
    )
  }

  return <LandingPage />
}
