export type QualityProfile = 'auto' | 'low' | 'medium' | 'high'
export type EffectiveQuality = Exclude<QualityProfile, 'auto'>

export interface QualitySettings {
  maxDpr: number
  shadowMapSize: number
  shadows: boolean
  cloudCount: number
  rainDropCount: number
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

export function qualitySettings(profile: EffectiveQuality): QualitySettings {
  if (profile === 'low') return { maxDpr: 1, shadowMapSize: 512, shadows: false, cloudCount: 4, rainDropCount: 110 }
  if (profile === 'high') return { maxDpr: 2, shadowMapSize: 2048, shadows: true, cloudCount: 8, rainDropCount: 360 }
  return { maxDpr: 1.5, shadowMapSize: 1024, shadows: true, cloudCount: 6, rainDropCount: 240 }
}
