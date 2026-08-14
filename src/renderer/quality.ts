export type QualityProfile = 'auto' | 'low' | 'medium' | 'high' | 'ultra'
export type EffectiveQuality = Exclude<QualityProfile, 'auto'>

/** A component can inherit the global profile or keep an intentional local tier. */
export type GraphicsQualityOverride = 'inherit' | EffectiveQuality

export const GRAPHICS_QUALITY_COMPONENTS = ['scene', 'shadows', 'nature', 'water', 'effects'] as const
export type GraphicsQualityComponent = (typeof GRAPHICS_QUALITY_COMPONENTS)[number]
export type GraphicsQualityOverrides = Record<GraphicsQualityComponent, GraphicsQualityOverride>

export const DEFAULT_GRAPHICS_QUALITY_OVERRIDES: GraphicsQualityOverrides = {
  scene: 'inherit',
  shadows: 'inherit',
  nature: 'inherit',
  water: 'inherit',
  effects: 'inherit',
}

export const AUTO_QUALITY_CHANGE_COOLDOWN_MS = 3_000

export interface QualitySettings {
  maxDpr: number
  shadowMapSize: number
  shadows: boolean
  /** Shadow rendering is costly on the CPU as well as the GPU, so it has its own cadence. */
  shadowUpdateIntervalMs: number
  /** Small distant actors remain fluid enough at this cadence without rewriting matrices every display refresh. */
  motionUpdateIntervalMs: number
  cloudCount: number
  rainDropCount: number
  vegetationDensity: number
  rockDensity: number
  resourceDensity: number
  groundDetailDensity: number
  settlementDensity: number
  maxSettlers: number
  waterSegmentScale: number
  minimumWaterSegments: number
  maximumWaterSegments: number
  waterWaveInterval: number
  waterNormalInterval: number
}

export const QUALITY_LABELS: Record<QualityProfile, string> = {
  auto: 'Tự động',
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  ultra: 'Cực cao',
}

export const GRAPHICS_COMPONENT_LABELS: Record<GraphicsQualityComponent, string> = {
  scene: 'Khung hình & độ sắc nét',
  shadows: 'Bóng & ánh sáng',
  nature: 'Cảnh quan & vật thể 3D',
  water: 'Nước & địa hình động',
  effects: 'Thời tiết & hiệu ứng',
}

export function createGraphicsQualityOverrides(
  values: Partial<GraphicsQualityOverrides> = {},
): GraphicsQualityOverrides {
  return {
    ...DEFAULT_GRAPHICS_QUALITY_OVERRIDES,
    ...values,
  }
}

export function resolveGraphicsQuality(
  override: GraphicsQualityOverride,
  globalQuality: EffectiveQuality,
): EffectiveQuality {
  return override === 'inherit' ? globalQuality : override
}

export function effectiveQualityFor(profile: QualityProfile, fps: number, current: EffectiveQuality = 'medium'): EffectiveQuality {
  if (profile !== 'auto') return profile
  if (fps < 38) return 'low'
  if (fps > 56 && current !== 'high') return current === 'low' ? 'medium' : 'high'
  if (fps < 48 && (current === 'high' || current === 'ultra')) return 'medium'
  return current === 'ultra' ? 'high' : current
}

/**
 * Auto starts from Low and uses measured FPS to promote one step at a time.
 * Ultra is deliberately opt-in: it can allocate large shadow maps and scene density.
 */
export function qualityForProfileChange(next: QualityProfile, previous: QualityProfile, current: EffectiveQuality): EffectiveQuality {
  if (next !== 'auto') return next
  return previous === 'auto' ? current : 'low'
}

/** Compact viewports remain usable by capping explicit High and Ultra at Medium. */
export function capQualityForMobile(profile: EffectiveQuality, mobileViewport: boolean): EffectiveQuality {
  return mobileViewport && (profile === 'high' || profile === 'ultra') ? 'medium' : profile
}

export type FpsLimit = 'auto' | 'uncapped' | 'vsync' | '240' | '144' | '120' | '60' | '30'

export const FPS_LIMIT_OPTIONS: readonly FpsLimit[] = [
  'auto',
  'uncapped',
  'vsync',
  '240',
  '144',
  '120',
  '60',
  '30',
]

export const FPS_LIMIT_LABELS: Record<FpsLimit, string> = {
  auto: 'Tự động (Thích ứng theo máy & màn hình)',
  uncapped: 'Không giới hạn (Tối đa phần cứng / PUBG, LMHT)',
  vsync: 'Khớp màn hình (V-Sync)',
  '240': '240 FPS (Esports 240Hz)',
  '144': '144 FPS (Gaming 144Hz)',
  '120': '120 FPS (Màn hình 120Hz)',
  '60': '60 FPS (Tiêu chuẩn cân bằng)',
  '30': '30 FPS (Tiết kiệm pin)',
}

/** Avoid visual quality oscillation while still responding to sustained FPS loss. */
export function canApplyAutoQualityChange(timestamp: number, lastChangeAt: number): boolean {
  return timestamp - lastChangeAt >= AUTO_QUALITY_CHANGE_COOLDOWN_MS
}

/**
 * Dynamic frame pacing supporting uncapped high-refresh monitors (144Hz/240Hz/360Hz)
 * like competitive games (PUBG, League of Legends) or specific player-configured caps.
 */
export function renderFrameIntervalMs(
  fpsLimit: FpsLimit = 'auto',
  profile: QualityProfile = 'auto',
  sceneQuality: EffectiveQuality = 'high',
): number {
  if (fpsLimit === 'uncapped' || fpsLimit === 'vsync') return 0
  if (fpsLimit === '240') return 1000 / 240
  if (fpsLimit === '144') return 1000 / 144
  if (fpsLimit === '120') return 1000 / 120
  if (fpsLimit === '60') return 1000 / 60
  if (fpsLimit === '30') return 1000 / 30

  // 'auto': dynamic rate matching monitor and device capabilities
  if (profile === 'auto') return 0
  if (sceneQuality === 'low') return 1000 / 30
  if (sceneQuality === 'medium') return 1000 / 60
  return 0
}

export function qualitySettings(profile: EffectiveQuality): QualitySettings {
  if (profile === 'low') {
    return {
      maxDpr: 0.8,
      shadowMapSize: 512,
      shadows: false,
      shadowUpdateIntervalMs: 1_000,
      motionUpdateIntervalMs: 100,
      cloudCount: 3,
      rainDropCount: 80,
      vegetationDensity: 0.48,
      rockDensity: 0.55,
      resourceDensity: 0.58,
      groundDetailDensity: 0,
      settlementDensity: 0.55,
      maxSettlers: 24,
      waterSegmentScale: 0.25,
      minimumWaterSegments: 6,
      maximumWaterSegments: 10,
      waterWaveInterval: 8,
      waterNormalInterval: 24,
    }
  }

  if (profile === 'ultra') {
    return {
      // A fixed cap protects high-DPR desktop panels from quadratic buffer growth.
      maxDpr: 2,
      shadowMapSize: 4096,
      shadows: true,
      shadowUpdateIntervalMs: 100,
      motionUpdateIntervalMs: 33,
      cloudCount: 12,
      rainDropCount: 640,
      vegetationDensity: 1.25,
      rockDensity: 1.25,
      resourceDensity: 1.2,
      groundDetailDensity: 1.35,
      settlementDensity: 1.15,
      maxSettlers: 96,
      waterSegmentScale: 1.3,
      minimumWaterSegments: 24,
      maximumWaterSegments: 72,
      waterWaveInterval: 1,
      waterNormalInterval: 2,
    }
  }

  if (profile === 'high') {
    return {
      maxDpr: 2,
      shadowMapSize: 2048,
      shadows: true,
      shadowUpdateIntervalMs: 125,
      motionUpdateIntervalMs: 33,
      cloudCount: 10,
      rainDropCount: 360,
      vegetationDensity: 1,
      rockDensity: 1,
      resourceDensity: 1,
      groundDetailDensity: 1,
      settlementDensity: 1,
      maxSettlers: 70,
      waterSegmentScale: 1,
      minimumWaterSegments: 16,
      maximumWaterSegments: 48,
      waterWaveInterval: 1,
      waterNormalInterval: 3,
    }
  }

  return {
    maxDpr: 1.25,
    shadowMapSize: 1024,
    shadows: true,
    shadowUpdateIntervalMs: 250,
    motionUpdateIntervalMs: 50,
    cloudCount: 5,
    rainDropCount: 180,
    vegetationDensity: 0.78,
    rockDensity: 0.76,
    resourceDensity: 0.8,
    groundDetailDensity: 0.58,
    settlementDensity: 0.78,
    maxSettlers: 44,
    waterSegmentScale: 0.55,
    minimumWaterSegments: 10,
    maximumWaterSegments: 24,
    waterWaveInterval: 3,
    waterNormalInterval: 9,
  }
}

/** Keeps the water mesh proportional to the map while making low quality meaningfully cheaper. */
export function waterSegmentsFor(profile: EffectiveQuality, mapSize: number): number {
  const settings = qualitySettings(profile)
  const normalizedSize = Math.max(1, Math.floor(Number.isFinite(mapSize) ? mapSize : 1))
  const requested = Math.round(normalizedSize * settings.waterSegmentScale)
  return Math.min(settings.maximumWaterSegments, Math.max(settings.minimumWaterSegments, requested))
}
