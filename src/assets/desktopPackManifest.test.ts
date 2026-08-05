import { describe, expect, it } from 'vitest'
import { ASSET_MANIFEST } from './manifest'
import { normalizeDesktopPackManifest } from './desktopPackManifest'

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

  it('rejects a manifest that tries to use a remote runtime URL', () => {
    const [first] = ASSET_MANIFEST
    expect(first).toBeDefined()
    const remote = {
      ...first!,
      runtime: { ...first!.runtime, files: [{ ...first!.runtime.files[0]!, path: 'https://cdn.polyhaven.com/not-allowed.webp' }, ...first!.runtime.files.slice(1)] },
    }
    expect(() => normalizeDesktopPackManifest([remote], 'desktop-2k')).toThrow(/stay local/)
  })
})
