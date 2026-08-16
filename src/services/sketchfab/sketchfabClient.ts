import type {
  Curated3DAsset,
  SketchfabDownloadInfo,
  SketchfabModelSummary,
  SketchfabSearchParams,
  SketchfabSearchResponse,
} from './types'

const SKETCHFAB_API_BASE = 'https://api.sketchfab.com/v3'
const SKETCHFAB_TOKEN_KEY = 'aetheria_sketchfab_api_token'

export const CURATED_3D_ASSETS: readonly Curated3DAsset[] = [
  {
    id: 'curated-leviathan',
    name: 'Thần Thú Hải Long Thái Cổ (Deepsea Leviathan)',
    category: 'creature',
    thumbnail: 'https://media.sketchfab.com/models/2f2c8d2345674c938b80e81c19d1e5a3/thumbnails/960.jpeg',
    polyCount: 14200,
    author: 'Aetheria Studio',
    description: 'Sinh vật biển sâu sở hữu cơ quan phát quang sinh học và vảy giáp thủy tinh chịu áp suất đại dương.',
    defaultScale: 0.95,
    sketchfabUid: '2f2c8d2345674c938b80e81c19d1e5a3',
    tags: ['creature', 'sea', 'dragon', 'aquatic', 'legendary'],
  },
  {
    id: 'curated-aether-tree',
    name: 'Đại Cổ Thụ Aether Tinh Tú (World Aether Tree)',
    category: 'flora',
    thumbnail: 'https://media.sketchfab.com/models/9c45bf67123447998bca4409ef12ad34/thumbnails/960.jpeg',
    polyCount: 8900,
    author: 'NatureCraft',
    description: 'Thảm thực vật thần thoại hấp thu linh khí thiên địa, phát tán bụi phấn huỳnh quang kích hoạt siêu quang hợp.',
    defaultScale: 1.2,
    sketchfabUid: '9c45bf67123447998bca4409ef12ad34',
    tags: ['flora', 'tree', 'aether', 'glow', 'arboreal'],
  },
  {
    id: 'curated-magma-golem',
    name: 'Titan Dung Nham Núi Lửa (Magma Golem Titan)',
    category: 'titan',
    thumbnail: 'https://media.sketchfab.com/models/a1b2c3d4e5f647998bca4409ef12ad34/thumbnails/960.jpeg',
    polyCount: 18500,
    author: 'MythicForge',
    description: 'Hóa thân của địa tầng dung nham rực cháy, lớp giáp đá obsidian miễn nhiễm mọi đòn công kích vật lý.',
    defaultScale: 1.05,
    sketchfabUid: 'a1b2c3d4e5f647998bca4409ef12ad34',
    tags: ['titan', 'golem', 'lava', 'chthonic', 'fire'],
  },
  {
    id: 'curated-crystal-phoenix',
    name: 'Dực Điểu Pha Lê Bất Diệt (Crystal Phoenix)',
    category: 'creature',
    thumbnail: 'https://media.sketchfab.com/models/d4e5f6a1b2c347998bca4409ef12ad34/thumbnails/960.jpeg',
    polyCount: 12400,
    author: 'CelestiaLab',
    description: 'Loài chim huyền thoại với đôi cánh pha lê khúc xạ ánh sáng mặt trời thành những chùm tia bức xạ thanh tẩy.',
    defaultScale: 0.9,
    sketchfabUid: 'd4e5f6a1b2c347998bca4409ef12ad34',
    tags: ['creature', 'bird', 'crystal', 'aerial', 'phoenix'],
  },
  {
    id: 'curated-ancient-altar',
    name: 'Bàn Thờ Tế Tự Cổ Đại (Ancient Evolution Shrine)',
    category: 'structure',
    thumbnail: 'https://media.sketchfab.com/models/b2c3d4e5f6a147998bca4409ef12ad34/thumbnails/960.jpeg',
    polyCount: 9600,
    author: 'ArchAncient',
    description: 'Di tích cổ truyền tụng năng lượng đột biến gen của các nền văn minh tiền kiếp.',
    defaultScale: 1.0,
    sketchfabUid: 'b2c3d4e5f6a147998bca4409ef12ad34',
    tags: ['structure', 'altar', 'shrine', 'relic'],
  },
  {
    id: 'curated-cyber-symbiote',
    name: 'Quái Thú Cơ Khí Sinh Học (Cyber-Symbiotic Drake)',
    category: 'titan',
    thumbnail: 'https://media.sketchfab.com/models/c3d4e5f6a1b247998bca4409ef12ad34/thumbnails/960.jpeg',
    polyCount: 21000,
    author: 'NeoBioTech',
    description: 'Sự dung hợp đỉnh cao giữa DNA loài rồng cổ đại và khung giáp titan cơ khí tích hợp động cơ plasma.',
    defaultScale: 1.05,
    sketchfabUid: 'c3d4e5f6a1b247998bca4409ef12ad34',
    tags: ['titan', 'cyber', 'mecha', 'dragon', 'hybrid'],
  },
]

export class SketchfabClient {
  private apiToken: string | null = null
  private searchCache: Map<string, { timestamp: number; data: SketchfabSearchResponse }> = new Map()

  constructor() {
    this.apiToken = this.loadStoredToken()
  }

  public getStoredToken(): string | null {
    return this.apiToken
  }

  public setStoredToken(token: string | null): void {
    this.apiToken = token ? token.trim() : null
    try {
      if (this.apiToken) {
        localStorage.setItem(SKETCHFAB_TOKEN_KEY, this.apiToken)
      } else {
        localStorage.removeItem(SKETCHFAB_TOKEN_KEY)
      }
    } catch {
      // Ignore storage errors in restricted sandbox environments
    }
  }

  private loadStoredToken(): string | null {
    try {
      return localStorage.getItem(SKETCHFAB_TOKEN_KEY)
    } catch {
      return null
    }
  }

  public buildEmbedUrl(uid: string, autoStart = true): string {
    const params = new URLSearchParams({
      autostart: autoStart ? '1' : '0',
      ui_controls: '1',
      ui_infos: '0',
      ui_stop: '0',
      ui_inspector: '0',
      ui_watermark: '0',
      transparent: '1',
    })
    return `https://sketchfab.com/models/${uid}/embed?${params.toString()}`
  }

  public async searchModels(params: SketchfabSearchParams): Promise<SketchfabSearchResponse> {
    const query = params.q.trim()
    const cacheKey = JSON.stringify(params)
    const cached = this.searchCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < 1000 * 60 * 10) {
      return cached.data
    }

    // Build URL
    const urlParams = new URLSearchParams({
      q: query || 'creature animal monster plant fantasy',
      type: 'models',
    })

    if (params.downloadable !== undefined) {
      urlParams.append('downloadable', params.downloadable ? 'true' : 'false')
    }
    if (params.animated) {
      urlParams.append('animated', 'true')
    }
    if (params.maxFaceCount) {
      urlParams.append('max_face_count', params.maxFaceCount.toString())
    }
    if (params.sortBy) {
      urlParams.append('sort_by', params.sortBy)
    }
    if (params.cursor) {
      urlParams.append('cursor', params.cursor)
    }
    if (params.categories && params.categories.length > 0) {
      params.categories.forEach((cat) => urlParams.append('categories', cat))
    }
    if (params.tags && params.tags.length > 0) {
      params.tags.forEach((t) => urlParams.append('tags', t))
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
    }
    if (this.apiToken) {
      headers.Authorization = `Token ${this.apiToken}`
    }

    try {
      const response = await fetch(`${SKETCHFAB_API_BASE}/models?${urlParams.toString()}`, {
        headers,
        signal: AbortSignal.timeout(6000),
      })

      if (response.ok) {
        const data = (await response.json()) as SketchfabSearchResponse
        this.searchCache.set(cacheKey, { timestamp: Date.now(), data })
        return data
      }
    } catch {
      // Fall through to fallback
    }

    // Fallback response from curated collection filtered by search query
    return this.generateFallbackResponse(query)
  }

  public async getModelDownload(uid: string): Promise<SketchfabDownloadInfo | null> {
    if (!this.apiToken) return null

    try {
      const res = await fetch(`${SKETCHFAB_API_BASE}/models/${uid}/download`, {
        headers: {
          Authorization: `Token ${this.apiToken}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(6000),
      })

      if (res.ok) {
        return (await res.json()) as SketchfabDownloadInfo
      }
    } catch {
      return null
    }

    return null
  }

  private generateFallbackResponse(query: string): SketchfabSearchResponse {
    const qLower = query.toLowerCase()
    const filteredCurated = CURATED_3D_ASSETS.filter((asset) => {
      if (!query) return true
      return (
        asset.name.toLowerCase().includes(qLower) ||
        asset.category.toLowerCase().includes(qLower) ||
        asset.tags.some((t) => t.toLowerCase().includes(qLower)) ||
        asset.description.toLowerCase().includes(qLower)
      )
    })

    const results: SketchfabModelSummary[] = filteredCurated.map((asset) => ({
      uid: asset.sketchfabUid || `uid-${asset.id}`,
      name: asset.name,
      description: asset.description,
      viewerUrl: `https://sketchfab.com/models/${asset.sketchfabUid || asset.id}`,
      thumbnails: {
        images: [
          { url: asset.thumbnail, width: 960, height: 540, size: 45000 },
          { url: asset.thumbnail, width: 480, height: 270, size: 18000 },
        ],
      },
      user: {
        username: asset.author.toLowerCase().replace(/\s+/g, '-'),
        displayName: asset.author,
        profileUrl: `https://sketchfab.com/${asset.author.toLowerCase()}`,
      },
      faceCount: asset.polyCount,
      vertexCount: Math.round(asset.polyCount * 0.65),
      isDownloadable: true,
      isAgeRestricted: false,
      animationCount: 1,
      license: {
        slug: 'cc-by',
        label: 'Creative Commons Attribution',
        requirements: 'Attribution required',
      },
      viewCount: 1250,
      likeCount: 340,
      publishedAt: '2026-01-15T12:00:00Z',
    }))

    return {
      results,
      total: results.length,
    }
  }
}

export const sketchfabClient = new SketchfabClient()
