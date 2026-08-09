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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSubscriptionState(value: unknown): value is SubscriptionState {
  return value === 'none' || value === 'active' || value === 'grace' || value === 'expired'
}

function isEntitlementId(value: unknown): value is EntitlementId {
  return value === 'desktop-game' || value === 'cinema-8k' || value === 'patron'
}

/**
 * Parses only a server-labelled response. Browser storage and Vite flags are
 * deliberately not accepted as proof that a Cinema 8K purchase exists.
 */
export function parseServerSubscriptionStatus(payload: unknown): SubscriptionStatus {
  if (!isRecord(payload) || !isSubscriptionState(payload.state) || payload.source !== 'server' || !Array.isArray(payload.entitlements) || !payload.entitlements.every(isEntitlementId)) {
    throw new Error('Entitlement response is invalid.')
  }
  if (payload.expiresAt !== undefined && typeof payload.expiresAt !== 'string') throw new Error('Entitlement expiry is invalid.')
  const status = {
    state: payload.state,
    entitlements: payload.entitlements,
    source: 'server' as const,
  }
  return typeof payload.expiresAt === 'string' ? { ...status, expiresAt: payload.expiresAt } : status
}

/** A desktop wrapper can configure this endpoint; an empty value keeps 8K locked. */
export class HttpEntitlementProvider implements EntitlementProvider {
  public constructor(
    private readonly endpoint: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  public async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    const response = await this.fetcher(this.endpoint, {
      cache: 'no-store',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`Entitlement request failed (${response.status}).`)
    return parseServerSubscriptionStatus(await response.json())
  }
}

/**
 * The endpoint URL carries no entitlement. It is only a route to a trusted
 * desktop service that must authenticate the player and sign delivery URLs.
 */
export function productionEntitlementProvider(): EntitlementProvider | undefined {
  const configured = import.meta.env.VITE_AETHERIA_ENTITLEMENT_URL
  if (typeof configured !== 'string' || !configured.trim()) return undefined
  return new HttpEntitlementProvider(configured.trim())
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
 * Desktop 2K/4K is granted by the installed desktop edition. Cinema 8K stays
 * false until a configured server returns both desktop and Cinema access.
 */
export async function resolveDesktopAssetPackEntitlements(
  desktopEdition: boolean,
  provider: EntitlementProvider | undefined = productionEntitlementProvider(),
): Promise<AssetPackEntitlements> {
  const locked = { desktopGame: desktopEdition, cinema8k: false }
  if (!desktopEdition || !provider) return locked
  try {
    const status = await provider.getSubscriptionStatus()
    if (status.source !== 'server') return locked
    const entitlements = assetPackEntitlements(status)
    return {
      desktopGame: true,
      cinema8k: entitlements.desktopGame && entitlements.cinema8k,
    }
  } catch {
    return locked
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
