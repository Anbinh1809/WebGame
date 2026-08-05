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
    return <Suspense fallback={<main className="play-route-loading" role="status" aria-live="polite"><strong>Đang mở Web Demo 1K…</strong><span>Three.js chỉ được tải sau khi bạn vào trang chơi thử.</span></main>}><GameApp /></Suspense>
  }

  return <LandingPage />
}
