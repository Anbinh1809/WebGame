import { describe, expect, it } from 'vitest'
import { DemoEntitlementProvider, assetPackEntitlements, defaultAssetPackAccess, parseServerSubscriptionStatus, resolveDesktopAssetPackEntitlements } from './entitlements'

const activeDemo = { state: 'active' as const, entitlements: ['desktop-game', 'cinema-8k'] as const, source: 'demo' as const }

describe('entitlement boundaries', () => {
  it('maps server-shaped status to pack access without trusting storage flags', async () => {
    const provider = new DemoEntitlementProvider(activeDemo, false)
    const status = await provider.getSubscriptionStatus()
    expect(defaultAssetPackAccess.canAccess('desktop-4k', status)).toBe(true)
    expect(defaultAssetPackAccess.canAccess('cinema-8k', status)).toBe(true)
    expect(assetPackEntitlements(status)).toEqual({ desktopGame: true, cinema8k: true })
  })

  it('refuses a demo provider in production and never revokes base desktop access for expiry data alone', () => {
    expect(() => new DemoEntitlementProvider(activeDemo, true)).toThrow('must not run')
    const expired = { state: 'expired' as const, entitlements: ['desktop-game'] as const, source: 'server' as const }
    expect(defaultAssetPackAccess.canAccess('desktop-2k', expired)).toBe(true)
    expect(defaultAssetPackAccess.canAccess('cinema-8k', expired)).toBe(false)
  })

  it('keeps Cinema 8K locked unless a server confirms a purchased desktop entitlement', async () => {
    const unavailableProvider = { getSubscriptionStatus: async () => { throw new Error('offline') } }
    await expect(resolveDesktopAssetPackEntitlements(true, unavailableProvider)).resolves.toEqual({ desktopGame: true, cinema8k: false })
    await expect(resolveDesktopAssetPackEntitlements(true, { getSubscriptionStatus: async () => activeDemo })).resolves.toEqual({ desktopGame: true, cinema8k: false })
    await expect(resolveDesktopAssetPackEntitlements(true, {
      getSubscriptionStatus: async () => ({ state: 'active' as const, entitlements: ['desktop-game', 'cinema-8k'] as const, source: 'server' as const }),
    })).resolves.toEqual({ desktopGame: true, cinema8k: true })
    expect(() => parseServerSubscriptionStatus({ state: 'active', entitlements: ['cinema-8k'], source: 'demo' })).toThrow('invalid')
  })
})
