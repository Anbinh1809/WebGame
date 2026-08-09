import { describe, expect, it } from 'vitest'
import { AssetPackManager, AssetResourceScope, resolveAssetPack } from './AssetPackManager'

const availability = { 'web-1k': true, 'desktop-2k': true, 'desktop-4k': true, 'cinema-8k': true }
const capable = { maxTextureSize: 8192, estimatedVramMiB: 16_384 }

describe('asset pack selection', () => {
  it('keeps the web edition on 1K and uses a 512px fallback on weak WebGL', () => {
    const desktopRequest = {
      edition: 'web-demo' as const,
      requestedPack: 'desktop-4k' as const,
      capabilities: capable,
      entitlements: { desktopGame: true, cinema8k: true },
      availability,
    }
    expect(resolveAssetPack(desktopRequest)).toMatchObject({ selectedPack: 'web-1k', usedFallback: true })
    expect(resolveAssetPack({ ...desktopRequest, capabilities: { maxTextureSize: 512 } })).toMatchObject({ selectedPack: 'web-1k', textureSourceResolution: 512 })
  })

  it('does not equate Cinema 8K with high render quality or a client flag', () => {
    const request = {
      edition: 'desktop' as const,
      requestedPack: 'cinema-8k' as const,
      capabilities: capable,
      entitlements: { desktopGame: true, cinema8k: false },
      availability,
    }
    expect(resolveAssetPack(request)).toMatchObject({ selectedPack: 'desktop-4k', usedFallback: true })
    expect(resolveAssetPack({ ...request, entitlements: { desktopGame: true, cinema8k: true } })).toMatchObject({ selectedPack: 'cinema-8k', usedFallback: false })
    expect(resolveAssetPack({
      ...request,
      capabilities: { maxTextureSize: 8192 },
      entitlements: { desktopGame: true, cinema8k: true },
    })).toMatchObject({ selectedPack: 'cinema-8k', usedFallback: false })
    expect(resolveAssetPack({
      ...request,
      capabilities: { maxTextureSize: 8192, estimatedVramMiB: 8_192 },
      entitlements: { desktopGame: true, cinema8k: true },
    })).toMatchObject({ selectedPack: 'desktop-4k', usedFallback: true })
  })

  it('keeps a desktop player on their requested 1K pack and falls back from missing 4K to 2K then 1K', () => {
    const request = {
      edition: 'desktop' as const,
      requestedPack: 'web-1k' as const,
      capabilities: capable,
      entitlements: { desktopGame: true, cinema8k: false },
      availability,
    }
    expect(resolveAssetPack(request)).toMatchObject({ selectedPack: 'web-1k', usedFallback: false })
    expect(resolveAssetPack({ ...request, requestedPack: 'desktop-4k', availability: { ...availability, 'desktop-4k': false } })).toMatchObject({ selectedPack: 'desktop-2k', usedFallback: true })
    expect(resolveAssetPack({ ...request, requestedPack: 'desktop-4k', availability: { ...availability, 'desktop-4k': false, 'desktop-2k': false } })).toMatchObject({ selectedPack: 'web-1k', usedFallback: true })
  })
})

describe('asset resource lifecycle', () => {
  it('falls back on load error and disposes scoped resources when the pack changes', async () => {
    const manager = new AssetPackManager()
    const fallback = { disposed: 0, dispose() { this.disposed += 1 } }
    let primaryAttempts = 0
    const result = await manager.loadWithFallback(
      { id: 'broken-primary', load: async () => { primaryAttempts += 1; throw new Error('bad file') } },
      { id: 'procedural-fallback', load: async () => fallback },
    )
    expect(result).toMatchObject({ loadedId: 'procedural-fallback', usedFallback: true })
    expect(primaryAttempts).toBe(2)
    expect(manager.loadProgress).toMatchObject({ state: 'fallback', attempts: 3, completed: 1, total: 3 })
    expect(manager.loadUsedFallback).toBe(true)
    manager.transition({ edition: 'web-demo', requestedPack: 'web-1k', capabilities: capable, entitlements: { desktopGame: false, cinema8k: false }, availability })
    manager.transition({ edition: 'desktop', requestedPack: 'desktop-2k', capabilities: capable, entitlements: { desktopGame: true, cinema8k: false }, availability })
    expect(fallback.disposed).toBe(1)
  })

  it('releases an owned resource only once', () => {
    const scope = new AssetResourceScope()
    const resource = { disposed: 0, dispose() { this.disposed += 1 } }
    scope.track('rock', resource)
    scope.release('rock')
    scope.dispose()
    expect(resource.disposed).toBe(1)
  })
})
