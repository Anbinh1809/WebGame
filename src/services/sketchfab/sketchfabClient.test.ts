import { beforeEach, describe, expect, it } from 'vitest'
import { CURATED_3D_ASSETS, SketchfabClient } from './sketchfabClient'

describe('Sketchfab API Client', () => {
  let client: SketchfabClient

  beforeEach(() => {
    client = new SketchfabClient()
    client.setStoredToken(null)
  })

  it('manages API token persistence correctly', () => {
    client.setStoredToken('test-token-12345')
    expect(client.getStoredToken()).toBe('test-token-12345')

    client.setStoredToken(null)
    expect(client.getStoredToken()).toBeNull()
  })

  it('builds valid iframe embed URLs for 3D preview', () => {
    const embedUrl = client.buildEmbedUrl('sample-uid-9988', true)
    expect(embedUrl).toContain('https://sketchfab.com/models/sample-uid-9988/embed')
    expect(embedUrl).toContain('autostart=1')
    expect(embedUrl).toContain('ui_controls=1')
  })

  it('searches models returning valid model summaries with uid, name and thumbnails', async () => {
    const res = await client.searchModels({ q: 'dragon' })
    expect(res.results).toBeDefined()
    expect(res.results.length).toBeGreaterThan(0)
    const first = res.results[0]
    expect(first?.uid).toBeDefined()
    expect(first?.name).toBeDefined()
    expect(first?.viewerUrl).toBeDefined()
  })

  it('searches with category or query and returns non-empty result set', async () => {
    const res = await client.searchModels({ q: 'tree' })
    expect(res.results).toBeDefined()
    expect(res.results.length).toBeGreaterThan(0)
    expect(typeof res.results[0]?.name).toBe('string')
  })

  it('contains curated 3D assets with valid metadata', () => {
    expect(CURATED_3D_ASSETS.length).toBeGreaterThanOrEqual(5)
    for (const asset of CURATED_3D_ASSETS) {
      expect(asset.id).toBeDefined()
      expect(asset.name).toBeDefined()
      expect(asset.polyCount).toBeGreaterThan(0)
      expect(asset.thumbnail).toBeDefined()
    }
  })
})
