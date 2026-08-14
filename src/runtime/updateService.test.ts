import { describe, expect, it, vi } from 'vitest'
import { UpdateService, CURRENT_CLIENT_VERSION, CURRENT_BUILD_TIME } from './updateService'

describe('updateService', () => {
  it('detects new version without throwing and notifies subscribers', async () => {
    const service = new UpdateService(100_000)
    let notifiedVersion: string | undefined

    const unsubscribe = service.subscribe((info) => {
      notifiedVersion = info.version
    })

    // Mock global fetch to return a newer version
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        version: '0.2.0',
        buildTime: '2026-09-01T00:00:00.000Z',
        channel: 'stable',
        notes: 'Bản cập nhật lớn.',
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await service.checkForUpdates()
    expect(result?.version).toBe('0.2.0')
    expect(notifiedVersion).toBe('0.2.0')
    expect(service.getPendingUpdate()?.version).toBe('0.2.0')

    unsubscribe()
    vi.unstubAllGlobals()
  })

  it('ignores when remote version is identical', async () => {
    const service = new UpdateService(100_000)

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        version: CURRENT_CLIENT_VERSION,
        buildTime: CURRENT_BUILD_TIME,
        channel: 'stable',
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await service.checkForUpdates()
    expect(result).toBeNull()

    vi.unstubAllGlobals()
  })
})
