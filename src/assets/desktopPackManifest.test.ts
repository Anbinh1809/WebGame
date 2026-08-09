import { afterEach, describe, expect, it, vi } from 'vitest'
import { ASSET_MANIFEST } from './manifest'
import { normalizeDesktopPackManifest, probeDesktopPackAvailability } from './desktopPackManifest'

afterEach(() => vi.unstubAllGlobals())

describe('desktop asset manifest normalization', () => {
  it('maps relative pack files to a local desktop bundle path', () => {
    const source = ASSET_MANIFEST.map((entry) => ({
      ...entry,
      runtime: { ...entry.runtime, files: entry.runtime.files.map((file) => ({ ...file, path: `./${file.path.split('/').at(-2)}/${file.path.split('/').at(-1)}` })) },
    }))
    const normalized = normalizeDesktopPackManifest(source, 'desktop-2k')
    expect(normalized.every((entry) => entry.pack === 'desktop-2k')).toBe(true)
    expect(normalized.flatMap((entry) => entry.runtime.files).every((file) => file.path.startsWith('/assets/polyhaven/desktop-2k/'))).toBe(true)
  })

  it('accepts the local Cinema 8K manifest path without permitting a remote URL', () => {
    const [first] = ASSET_MANIFEST
    expect(first).toBeDefined()
    const normalized = normalizeDesktopPackManifest([first!], 'cinema-8k')
    expect(normalized[0]?.pack).toBe('cinema-8k')
    expect(normalized[0]?.runtime.files.every((file) => file.path.startsWith('/assets/polyhaven/cinema-8k/'))).toBe(true)
  })

  it('rejects a manifest that tries to use a remote runtime URL', () => {
    const [first] = ASSET_MANIFEST
    expect(first).toBeDefined()
    const remote = {
      ...first!,
      runtime: { ...first!.runtime, files: [{ ...first!.runtime.files[0]!, path: 'https://cdn.polyhaven.com/not-allowed.webp' }, ...first!.runtime.files.slice(1)] },
    }
    expect(() => normalizeDesktopPackManifest([remote], 'desktop-2k')).toThrow(/stay local/)
  })

  it('opens only desktop packs with a valid local manifest', async () => {
    const [first] = ASSET_MANIFEST
    expect(first).toBeDefined()
    const local = {
      ...first!,
      runtime: {
        ...first!.runtime,
        files: first!.runtime.files.map((file) => ({ ...file, path: `./${file.path.split('/').at(-1) ?? 'asset.webp'}` })),
      },
    }
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/desktop-2k/')) return new Response(JSON.stringify([local]), { status: 200 })
      return new Response(null, { status: 404 })
    }))

    await expect(probeDesktopPackAvailability(['desktop-2k', 'desktop-4k'])).resolves.toEqual({
      'desktop-2k': true,
      'desktop-4k': false,
      'cinema-8k': false,
    })
  })
})
