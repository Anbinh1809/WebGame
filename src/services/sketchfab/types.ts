export interface SketchfabThumbnail {
  url: string
  width: number
  height: number
  size: number
}

export interface SketchfabUser {
  username: string
  displayName: string
  profileUrl: string
  avatar?: {
    images: SketchfabThumbnail[]
  }
}

export interface SketchfabLicense {
  slug: string
  label: string
  requirements: string
  url?: string
}

export interface SketchfabModelSummary {
  uid: string
  name: string
  description?: string
  viewerUrl: string
  thumbnails: {
    images: SketchfabThumbnail[]
  }
  user: SketchfabUser
  faceCount: number
  vertexCount: number
  isDownloadable: boolean
  isAgeRestricted: boolean
  animationCount: number
  license?: SketchfabLicense
  viewCount?: number
  likeCount?: number
  publishedAt?: string
  categories?: { name: string; slug: string }[]
  tags?: { name: string; slug: string }[]
}

export interface SketchfabSearchResponse {
  next?: string
  previous?: string
  results: SketchfabModelSummary[]
  total?: number
}

export interface SketchfabSearchParams {
  q: string
  categories?: string[]
  tags?: string[]
  downloadable?: boolean
  animated?: boolean
  maxFaceCount?: number
  sortBy?: '-likeCount' | '-viewCount' | '-publishedAt' | 'relevance'
  cursor?: string
}

export interface SketchfabDownloadInfo {
  gltf?: {
    url: string
    size: number
    expires: number
  }
  source?: {
    url: string
    size: number
    expires: number
  }
  usdz?: {
    url: string
    size: number
    expires: number
  }
}

export interface Curated3DAsset {
  id: string
  name: string
  category: 'creature' | 'flora' | 'titan' | 'structure' | 'relic'
  thumbnail: string
  polyCount: number
  author: string
  description: string
  defaultScale: number
  sketchfabUid?: string
  directModelUrl?: string
  tags: string[]
}
