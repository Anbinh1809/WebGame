export type MotionPreference = 'system' | 'full' | 'reduced'

export const MOTION_PREFERENCE_LABELS: Record<MotionPreference, string> = {
  system: 'Theo cài đặt thiết bị',
  full: 'Đầy đủ',
  reduced: 'Giảm chuyển động',
}

/** Keeps accessibility as the default while allowing an explicit player choice. */
export function isReducedMotion(preference: MotionPreference, systemReduced: boolean): boolean {
  return preference === 'reduced' || (preference === 'system' && systemReduced)
}
