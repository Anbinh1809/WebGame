import type { AssetPackQuality } from '../assets/types'
import type { AssetPackEntitlements } from '../renderer/AssetPackManager'

export type SubscriptionState = 'none' | 'active' | 'grace' | 'expired'
export type EntitlementId = 'desktop-game' | 'cinema-8k' | 'patron'

export interface SubscriptionStatus {
  state: SubscriptionState
  entitlements: readonly EntitlementId[]
  expiresAt?: string
  source: 'server' | 'demo'
}

/** Server implementations must validate subscriptions and signed downloads. */
export interface EntitlementProvider {
  getSubscriptionStatus(): Promise<SubscriptionStatus>
}

export interface AssetPackAccess {
  canAccess(pack: AssetPackQuality, status: SubscriptionStatus): boolean
}

export interface DownloadManifestEntry {
  id: string
  version: string
  platform: 'windows' | 'macos' | 'linux'
  sha256: string
  bytes: number
  url: string
  expiresAt: string
}

export interface DownloadManifest {
  generatedAt: string
  entries: readonly DownloadManifestEntry[]
}

export interface DownloadManifestProvider {
  getDownloadManifest(): Promise<DownloadManifest>
}

export const defaultAssetPackAccess: AssetPackAccess = {
  canAccess(pack, status) {
    if (pack === 'web-1k') return true
    if (!status.entitlements.includes('desktop-game')) return false
    return pack !== 'cinema-8k' || status.entitlements.includes('cinema-8k')
  },
}

export function assetPackEntitlements(status: SubscriptionStatus): AssetPackEntitlements {
  return {
    desktopGame: status.entitlements.includes('desktop-game'),
    cinema8k: status.entitlements.includes('cinema-8k'),
  }
}

/**
 * Demo status is intentionally opt-in and cannot be constructed for a
 * production build. It documents UI states; it is never a security boundary.
 */
export class DemoEntitlementProvider implements EntitlementProvider {
  public constructor(private readonly status: SubscriptionStatus, productionBuild: boolean) {
    if (productionBuild) throw new Error('Demo entitlement provider must not run in a production build.')
    if (status.source !== 'demo') throw new Error('Demo entitlement status must be labelled demo.')
  }

  public async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    return this.status
  }
}
