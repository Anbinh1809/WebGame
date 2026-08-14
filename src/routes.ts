export type AppRoute = 'landing' | 'play'

function normalizedBasePath(baseUrl: string): string {
  const withLeadingSlash = baseUrl.startsWith('/') ? baseUrl : `/${baseUrl}`
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/u, '')
  return withoutTrailingSlash === '' ? '/' : withoutTrailingSlash
}

/**
 * Vite exposes the deployment base at build time. Keeping route construction
 * here means a project-hosted build (for example GitHub Pages) and a custom
 * domain use exactly the same React routes.
 */
export const APP_BASE_PATH = normalizedBasePath(import.meta.env.BASE_URL)

export function appPath(route: '/' | '/play'): string {
  if (route === '/') return APP_BASE_PATH === '/' ? '/' : `${APP_BASE_PATH}/`
  return APP_BASE_PATH === '/' ? route : `${APP_BASE_PATH}${route}`
}

export function routeForPathname(pathname: string, basePath = APP_BASE_PATH): AppRoute {
  const normalizedBase = normalizedBasePath(basePath)
  const routePath = normalizedBase !== '/' && (pathname === normalizedBase || pathname.startsWith(`${normalizedBase}/`))
    ? pathname.slice(normalizedBase.length) || '/'
    : pathname
  return routePath === '/play' || routePath === '/play/' ? 'play' : 'landing'
}
