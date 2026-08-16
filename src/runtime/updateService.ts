export interface VersionInfo {
  version: string
  buildTime: string
  channel: string
  notes?: string
}

export const CURRENT_CLIENT_VERSION = '0.2.0'
export const CURRENT_BUILD_TIME = '2026-08-16T16:00:00.000Z'

export type UpdateCallback = (newVersion: VersionInfo) => void

export class UpdateService {
  private timer: ReturnType<typeof setInterval> | undefined
  private startupTimeout: ReturnType<typeof setTimeout> | undefined
  private listeners = new Set<UpdateCallback>()
  private updateAvailable: VersionInfo | null = null

  public constructor(private readonly checkIntervalMs = 60_000) {}

  public start(): void {
    if (typeof window === 'undefined') return
    if (this.timer || this.startupTimeout) return

    // Run first check after 10s to let game load smoothly
    this.startupTimeout = setTimeout(() => {
      this.startupTimeout = undefined
      void this.checkForUpdates()
    }, 10_000)

    this.timer = setInterval(() => {
      void this.checkForUpdates()
    }, this.checkIntervalMs)
  }

  public stop(): void {
    if (this.startupTimeout) {
      clearTimeout(this.startupTimeout)
      this.startupTimeout = undefined
    }
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = undefined
    }
  }

  public subscribe(callback: UpdateCallback): () => void {
    this.listeners.add(callback)
    if (this.updateAvailable) {
      callback(this.updateAvailable)
    }
    return () => {
      this.listeners.delete(callback)
    }
  }

  public async checkForUpdates(): Promise<VersionInfo | null> {
    if (typeof fetch === 'undefined') return null

    try {
      // Fetch with cache-busting timestamp
      const response = await fetch(`/version.json?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })
      if (!response.ok) return null

      const remote = (await response.json()) as VersionInfo
      if (
        remote &&
        typeof remote.version === 'string' &&
        (remote.version !== CURRENT_CLIENT_VERSION || remote.buildTime > CURRENT_BUILD_TIME)
      ) {
        this.updateAvailable = remote
        this.notifyAll(remote)
        return remote
      }
    } catch {
      // Safe degrade on network error
    }

    return null
  }

  public applyUpdate(): void {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  public getPendingUpdate(): VersionInfo | null {
    return this.updateAvailable
  }

  private notifyAll(info: VersionInfo): void {
    for (const listener of this.listeners) {
      try {
        listener(info)
      } catch {
        // Safe listener execution
      }
    }
  }
}

export const globalUpdateService = new UpdateService()
