export type QualityProfile = 'auto' | 'low' | 'medium' | 'high'
export type EffectiveQuality = Exclude<QualityProfile, 'auto'>
export const AUTO_QUALITY_CHANGE_COOLDOWN_MS = 3_000

export interface QualitySettings {
  maxDpr: number
  shadowMapSize: number
  shadows: boolean
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
}

export function effectiveQualityFor(profile: QualityProfile, fps: number, current: EffectiveQuality = 'medium'): EffectiveQuality {
  if (profile !== 'auto') return profile
  if (fps < 38) return 'low'
  if (fps > 56 && current !== 'high') return current === 'low' ? 'medium' : 'high'
  if (fps < 48 && current === 'high') return 'medium'
  return current
}

/**
 * Auto starts from Low and uses measured FPS to promote one step at a time.
 * This avoids a long first-frame hitch on a weak device before telemetry exists.
 */
export function qualityForProfileChange(next: QualityProfile, previous: QualityProfile, current: EffectiveQuality): EffectiveQuality {
  if (next !== 'auto') return next
  return previous === 'auto' ? current : 'low'
}

/** High is capped on compact viewports to keep input and WebGL responsive. */
export function capQualityForMobile(profile: EffectiveQuality, mobileViewport: boolean): EffectiveQuality {
  return mobileViewport && profile === 'high' ? 'medium' : profile
}

/** Avoid visual quality oscillation while still responding to sustained FPS loss. */
export function canApplyAutoQualityChange(timestamp: number, lastChangeAt: number): boolean {
  return timestamp - lastChangeAt >= AUTO_QUALITY_CHANGE_COOLDOWN_MS
}

export function qualitySettings(profile: EffectiveQuality): QualitySettings {
  if (profile === 'low') {
    return {
      maxDpr: 0.8,
      shadowMapSize: 512,
      shadows: false,
      cloudCount: 2,
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

  if (profile === 'high') {
    return {
      maxDpr: 2,
      shadowMapSize: 2048,
      shadows: true,
      cloudCount: 8,
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
    cloudCount: 4,
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
