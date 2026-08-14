import { createReadStream, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, sep } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import type { Connect, Plugin } from 'vite'

const DESKTOP_PACK_URL_PREFIX = '/assets/polyhaven/'
const DESKTOP_PACK_DIRECTORY = fileURLToPath(new URL('./desktop-packs/polyhaven', import.meta.url))
const LOCAL_DESKTOP_PACKS = new Set(['desktop-2k', 'desktop-4k', 'cinema-8k'])

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.glb': 'model/gltf-binary',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.json': 'application/json; charset=utf-8',
  '.ktx2': 'image/ktx2',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

/**
 * Installed packs intentionally live outside public/ so a normal Web Demo
 * cannot discover them. Desktop mode mounts only the local staging directory
 * during Vite dev/preview; a real desktop wrapper uses the same URL contract.
 */
function localDesktopPackPlugin(): Plugin {
  const serveDesktopPack: Connect.NextHandleFunction = (request, response, next) => {
    const requestPath = new URL(request.url ?? '/', 'http://aetheria.local').pathname
    if (!requestPath.startsWith(DESKTOP_PACK_URL_PREFIX)) {
      next()
      return
    }

    let relativePath: string
    try {
      relativePath = decodeURIComponent(requestPath.slice(DESKTOP_PACK_URL_PREFIX.length))
    } catch {
      response.statusCode = 400
      response.end('Invalid desktop pack path.')
      return
    }
    const requestedPack = relativePath.split('/', 1)[0]
    // Web 1K belongs to Vite's public directory. Let the normal static
    // handler serve it instead of treating it as an installed desktop pack.
    if (!requestedPack || !LOCAL_DESKTOP_PACKS.has(requestedPack)) {
      next()
      return
    }
    const localPath = resolve(DESKTOP_PACK_DIRECTORY, relativePath)
    const localRoot = `${DESKTOP_PACK_DIRECTORY}${sep}`
    if (!localPath.startsWith(localRoot)) {
      response.statusCode = 403
      response.end('Desktop pack path is outside the local bundle.')
      return
    }

    try {
      if (!statSync(localPath).isFile()) {
        response.statusCode = 404
        response.end('Desktop pack asset was not found.')
        return
      }
    } catch {
      response.statusCode = 404
      response.end('Desktop pack asset was not found.')
      return
    }

    const extension = localPath.slice(localPath.lastIndexOf('.')).toLowerCase()
    response.setHeader('Content-Type', CONTENT_TYPES[extension] ?? 'application/octet-stream')
    response.setHeader('Cache-Control', 'no-store')
    const stream = createReadStream(localPath)
    stream.on('error', next)
    stream.pipe(response)
  }

  return {
    name: 'aetheria-local-desktop-packs',
    configureServer(server) {
      server.middlewares.use(serveDesktopPack)
    },
    configurePreviewServer(server) {
      server.middlewares.use(serveDesktopPack)
    },
  }
}

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '')
  const isDesktopMode = environment.VITE_AETHERIA_EDITION === 'desktop'

  return {
    // Defaults to a custom-domain root. CI can set VITE_PUBLIC_BASE to the
    // repository path so static hosts also resolve /play and its assets.
    base: environment.VITE_PUBLIC_BASE || '/',
    plugins: [react(), ...(isDesktopMode ? [localDesktopPackPlugin()] : [])],
    // Loopback hosting keeps local browser smoke tests deterministic.
    server: { host: '127.0.0.1' },
    preview: { host: '127.0.0.1' },
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules/three/')) return 'three'
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) return 'react-vendor'
            return undefined
          },
        },
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }
})
