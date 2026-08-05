import type { AssetPackQuality } from '../assets/types'

export type GameEdition = 'web-demo' | 'desktop'
export type ResolvedAssetPack = AssetPackQuality | 'procedural'

export interface AssetPackCapabilities {
  maxTextureSize: number
  estimatedVramMiB?: number
}

export interface AssetPackEntitlements {
  desktopGame: boolean
  cinema8k: boolean
}

export interface AssetPackAvailability {
  'web-1k': boolean
  'desktop-2k': boolean
  'desktop-4k': boolean
  'cinema-8k': boolean
}

export interface AssetPackRequest {
  edition: GameEdition
  requestedPack: AssetPackQuality
  capabilities: AssetPackCapabilities
  entitlements: AssetPackEntitlements
  availability: AssetPackAvailability
}

export interface AssetPackSelection {
  requestedPack: AssetPackQuality
  selectedPack: ResolvedAssetPack
  textureSourceResolution: 512 | 1024 | 2048 | 4096 | 8192
  usedFallback: boolean
  reason: string
}

export interface DisposableResource {
  dispose: () => void
}

export interface AssetLoadCandidate<T extends DisposableResource> {
  id: string
  load: () => Promise<T>
}

export interface AssetLoadResult<T extends DisposableResource> {
  value: T
  loadedId: string
  usedFallback: boolean
  durationMs: number
}

export interface AssetLoadProgress {
  state: 'idle' | 'loading' | 'ready' | 'fallback' | 'error'
  attempts: number
  completed: number
  total: number
}

const PACK_RESOLUTION: Record<AssetPackQuality, 1024 | 2048 | 4096 | 8192> = {
  'web-1k': 1024,
  'desktop-2k': 2048,
  'desktop-4k': 4096,
  'cinema-8k': 8192,
}

function isSupported(pack: AssetPackQuality, capabilities: AssetPackCapabilities): boolean {
  if (capabilities.maxTextureSize < PACK_RESOLUTION[pack]) return false
  return pack !== 'cinema-8k' || (capabilities.estimatedVramMiB ?? 0) >= 12_288
}

function desktopFallback(request: AssetPackRequest, originalRequestedPack = request.requestedPack): AssetPackSelection {
  const candidates: AssetPackQuality[] = request.requestedPack === 'desktop-4k'
    ? ['desktop-4k', 'desktop-2k', 'web-1k']
    : request.requestedPack === 'desktop-2k'
      ? ['desktop-2k', 'web-1k']
      : ['web-1k']
  for (const candidate of candidates) {
    const hasAccess = candidate === 'web-1k' || request.entitlements.desktopGame
    if (request.availability[candidate] && hasAccess && isSupported(candidate, request.capabilities)) {
      return {
        requestedPack: originalRequestedPack,
        selectedPack: candidate,
        textureSourceResolution: PACK_RESOLUTION[candidate],
        usedFallback: candidate !== originalRequestedPack,
        reason: candidate === originalRequestedPack ? 'Requested desktop pack is available.' : `Fell back safely to ${candidate}.`,
      }
    }
  }
  return {
    requestedPack: originalRequestedPack,
    selectedPack: 'procedural',
    textureSourceResolution: 512,
    usedFallback: true,
    reason: 'No entitled desktop pack is available; procedural materials remain playable.',
  }
}

/**
 * Resolves legitimate access, capability, and file availability separately.
 * It is not a DRM boundary: server-backed entitlement is required for a real
 * desktop distribution.
 */
export function resolveAssetPack(request: AssetPackRequest): AssetPackSelection {
  if (request.edition === 'web-demo') {
    if (!request.availability['web-1k']) {
      return {
        requestedPack: request.requestedPack,
        selectedPack: 'procedural',
        textureSourceResolution: 512,
        usedFallback: true,
        reason: 'Web 1K asset is unavailable; procedural material fallback is active.',
      }
    }
    const textureSourceResolution = request.capabilities.maxTextureSize < 1024 ? 512 : 1024
    return {
      requestedPack: request.requestedPack,
      selectedPack: 'web-1k',
      textureSourceResolution,
      usedFallback: request.requestedPack !== 'web-1k' || textureSourceResolution === 512,
      reason: textureSourceResolution === 512
        ? 'Weak WebGL capability uses the 512px fallback inside the Web 1K demo.'
        : request.requestedPack === 'web-1k'
          ? 'Web demo is limited to the 1K asset pack.'
          : 'Web demo cannot select desktop or cinematic asset packs.',
    }
  }

  if (request.requestedPack === 'cinema-8k') {
    if (!request.entitlements.cinema8k) return desktopFallback({ ...request, requestedPack: 'desktop-4k' }, request.requestedPack)
    if (!request.availability['cinema-8k'] || !isSupported('cinema-8k', request.capabilities)) return desktopFallback({ ...request, requestedPack: 'desktop-4k' }, request.requestedPack)
    return {
      requestedPack: request.requestedPack,
      selectedPack: 'cinema-8k',
      textureSourceResolution: 8192,
      usedFallback: false,
      reason: 'Cinema 8K is enabled only for a capable, entitled desktop session.',
    }
  }

  return desktopFallback(request)
}

/** Explicit ownership scope for textures, materials, and geometry loaded by a pack. */
export class AssetResourceScope {
  private readonly resources = new Map<string, DisposableResource>()

  public track<T extends DisposableResource>(key: string, resource: T): T {
    this.release(key)
    this.resources.set(key, resource)
    return resource
  }

  public release(key: string): void {
    const resource = this.resources.get(key)
    if (!resource) return
    this.resources.delete(key)
    resource.dispose()
  }

  public dispose(): void {
    for (const resource of this.resources.values()) resource.dispose()
    this.resources.clear()
  }

  public get size(): number {
    return this.resources.size
  }
}

export class AssetPackManager {
  private readonly scope = new AssetResourceScope()
  private selection: AssetPackSelection | undefined
  private lastLoadDurationMs = 0
  private latestLoadUsedFallback = false
  private progress: AssetLoadProgress = { state: 'idle', attempts: 0, completed: 0, total: 0 }

  public transition(request: AssetPackRequest): AssetPackSelection {
    const next = resolveAssetPack(request)
    if (this.selection && this.selection.selectedPack !== next.selectedPack) this.scope.dispose()
    this.selection = next
    return next
  }

  /**
   * Loading retries a primary asset at most twice, then makes one explicit
   * fallback attempt. Callers can render `loadProgress` without coupling
   * simulation to texture arrival.
   */
  public async loadWithFallback<T extends DisposableResource>(primary: AssetLoadCandidate<T>, fallback: AssetLoadCandidate<T>, maximumPrimaryAttempts = 2): Promise<AssetLoadResult<T>> {
    const startedAt = performance.now()
    const retryLimit = Math.max(1, Math.min(2, Math.floor(maximumPrimaryAttempts)))
    this.latestLoadUsedFallback = false
    this.progress = { state: 'loading', attempts: 0, completed: 0, total: retryLimit + 1 }
    for (let attempt = 1; attempt <= retryLimit; attempt += 1) {
      this.progress = { ...this.progress, attempts: attempt }
      try {
        const value = this.scope.track(primary.id, await primary.load())
        this.lastLoadDurationMs = performance.now() - startedAt
        this.progress = { state: 'ready', attempts: attempt, completed: 1, total: retryLimit + 1 }
        return { value, loadedId: primary.id, usedFallback: false, durationMs: this.lastLoadDurationMs }
      } catch {
        // A corrupt/missing binary may recover on a bounded retry. Do not loop indefinitely.
      }
    }
    try {
      this.progress = { ...this.progress, state: 'loading', attempts: retryLimit + 1 }
      const value = this.scope.track(fallback.id, await fallback.load())
      this.lastLoadDurationMs = performance.now() - startedAt
      this.latestLoadUsedFallback = true
      this.progress = { state: 'fallback', attempts: retryLimit + 1, completed: 1, total: retryLimit + 1 }
      return { value, loadedId: fallback.id, usedFallback: true, durationMs: this.lastLoadDurationMs }
    } catch (error) {
      this.lastLoadDurationMs = performance.now() - startedAt
      this.progress = { state: 'error', attempts: retryLimit + 1, completed: 0, total: retryLimit + 1 }
      throw error
    }
  }

  public get currentSelection(): AssetPackSelection | undefined {
    return this.selection
  }

  public get resourceCount(): number {
    return this.scope.size
  }

  public get loadDurationMs(): number {
    return this.lastLoadDurationMs
  }

  /** True when the selected pack resolved but its binary load used the procedural fallback. */
  public get loadUsedFallback(): boolean {
    return this.latestLoadUsedFallback
  }

  public get loadProgress(): AssetLoadProgress {
    return this.progress
  }

  public dispose(): void {
    this.scope.dispose()
    this.selection = undefined
    this.latestLoadUsedFallback = false
    this.progress = { state: 'idle', attempts: 0, completed: 0, total: 0 }
  }
}
