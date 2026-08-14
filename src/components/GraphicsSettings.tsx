import type { ChangeEvent, JSX } from 'react'
import type { AssetPackQuality } from '../assets/types'
import { MOTION_PREFERENCE_LABELS } from '../renderer/MotionPreference'
import type { MotionPreference } from '../renderer/MotionPreference'
import type { DesktopPackAvailability } from '../assets/desktopPackManifest'
import { ASSET_PACK_LABELS, DESKTOP_TEXTURE_PACKS } from '../runtime/edition'
import {
  GRAPHICS_COMPONENT_LABELS,
  GRAPHICS_QUALITY_COMPONENTS,
  QUALITY_LABELS,
} from '../renderer/quality'
import type {
  EffectiveQuality,
  GraphicsQualityComponent,
  GraphicsQualityOverride,
  GraphicsQualityOverrides,
  QualityProfile,
} from '../renderer/quality'

interface GraphicsSettingsProps {
  quality: QualityProfile
  motionPreference: MotionPreference
  soundEnabled: boolean
  masterVolume?: number
  musicVolume?: number
  sfxVolume?: number
  overrides: GraphicsQualityOverrides
  assetPackQuality: AssetPackQuality
  desktopEdition: boolean
  desktopPackAvailability?: DesktopPackAvailability
  cinema8kEntitled?: boolean
  isCheckingDesktopPacks?: boolean
  isCheckingCinemaEntitlement?: boolean
  onQualityChange: (quality: QualityProfile) => void
  onMotionPreferenceChange: (preference: MotionPreference) => void
  onSoundEnabledChange: (enabled: boolean) => void
  onMasterVolumeChange?: (volume: number) => void
  onMusicVolumeChange?: (volume: number) => void
  onSfxVolumeChange?: (volume: number) => void
  onOpenTutorial: () => void
  onOverridesChange: (overrides: GraphicsQualityOverrides) => void
  onAssetPackQualityChange: (pack: AssetPackQuality) => void
}

const EFFECTIVE_QUALITY_OPTIONS: readonly EffectiveQuality[] = ['low', 'medium', 'high', 'ultra']

const OVERRIDE_LABELS: Record<GraphicsQualityOverride, string> = {
  inherit: 'Theo cấu hình chung',
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  ultra: 'Cực cao',
}

const TEXTURE_PACK_DESCRIPTIONS: Record<AssetPackQuality, string> = {
  'web-1k': 'Thấp · texture nguồn 1K',
  'desktop-2k': 'Trung bình · texture nguồn 2K',
  'desktop-4k': 'Cao · texture nguồn 4K',
  'cinema-8k': 'Cực cao · texture nguồn 8K',
}

const EMPTY_DESKTOP_PACK_AVAILABILITY: DesktopPackAvailability = {
  'desktop-2k': false,
  'desktop-4k': false,
  'cinema-8k': false,
}

function GraphicsOverrideSelect({
  component,
  value,
  onChange,
}: {
  component: GraphicsQualityComponent
  value: GraphicsQualityOverride
  onChange: (component: GraphicsQualityComponent, value: GraphicsQualityOverride) => void
}): JSX.Element {
  const id = `graphics-${component}-quality`
  return (
    <label className="field-label" htmlFor={id}>
      <span>{GRAPHICS_COMPONENT_LABELS[component]}</span>
      <select id={id} value={value} onChange={(event) => onChange(component, event.target.value as GraphicsQualityOverride)}>
        <option value="inherit">{OVERRIDE_LABELS.inherit}</option>
        {EFFECTIVE_QUALITY_OPTIONS.map((profile) => <option key={profile} value={profile}>{OVERRIDE_LABELS[profile]}</option>)}
      </select>
    </label>
  )
}

export function GraphicsSettings({
  quality,
  motionPreference,
  soundEnabled,
  masterVolume = 1.0,
  musicVolume = 0.55,
  sfxVolume = 0.85,
  overrides,
  assetPackQuality,
  desktopEdition,
  desktopPackAvailability = EMPTY_DESKTOP_PACK_AVAILABILITY,
  cinema8kEntitled = false,
  isCheckingDesktopPacks = false,
  isCheckingCinemaEntitlement = false,
  onQualityChange,
  onMotionPreferenceChange,
  onSoundEnabledChange,
  onMasterVolumeChange,
  onMusicVolumeChange,
  onSfxVolumeChange,
  onOpenTutorial,
  onOverridesChange,
  onAssetPackQualityChange,
}: GraphicsSettingsProps): JSX.Element {
  const updateOverride = (component: GraphicsQualityComponent, value: GraphicsQualityOverride): void => {
    onOverridesChange({ ...overrides, [component]: value })
  }

  const updateTexturePack = (event: ChangeEvent<HTMLSelectElement>): void => {
    onAssetPackQualityChange(event.target.value as AssetPackQuality)
  }

  const canSelectTexturePack = (pack: AssetPackQuality): boolean => {
    if (pack === 'web-1k') return true
    if (!desktopPackAvailability[pack]) return false
    return pack !== 'cinema-8k' || cinema8kEntitled
  }

  const texturePackAccessLabel = (pack: AssetPackQuality): string => {
    if (pack === 'web-1k') return ''
    if (pack === 'cinema-8k' && !cinema8kEntitled) return isCheckingCinemaEntitlement ? ' · đang xác minh quyền mua' : ' · cần mua'
    if (!desktopPackAvailability[pack]) return isCheckingDesktopPacks ? ' · đang kiểm tra cục bộ' : ' · chưa tải về'
    return ' · đã cài đặt'
  }

  return (
    <section className="graphics-settings panel-surface" aria-labelledby="graphics-settings-heading">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Đồ họa 3D & Âm thanh</span>
          <h2 id="graphics-settings-heading">Tùy chỉnh đồ họa & âm thanh</h2>
        </div>
      </div>

      <p className="graphics-settings-intro">Chọn mức tổng thể, rồi chỉ nâng phần cần thiết. Gói texture độc lập với độ phân giải màn hình.</p>

      <label className="field-label" htmlFor="graphics-global-quality">
        <span>Chất lượng tổng thể</span>
        <select id="graphics-global-quality" value={quality} onChange={(event) => onQualityChange(event.target.value as QualityProfile)}>
          {(Object.keys(QUALITY_LABELS) as QualityProfile[]).map((profile) => <option key={profile} value={profile}>{QUALITY_LABELS[profile]}</option>)}
        </select>
      </label>

      <fieldset className="graphics-experience-controls">
        <legend>Âm thanh & Trải nghiệm</legend>
        <label className="field-label" htmlFor="graphics-motion-preference">
          <span>Chuyển động</span>
          <select id="graphics-motion-preference" value={motionPreference} onChange={(event) => onMotionPreferenceChange(event.target.value as MotionPreference)}>
            {(Object.keys(MOTION_PREFERENCE_LABELS) as MotionPreference[]).map((preference) => <option key={preference} value={preference}>{MOTION_PREFERENCE_LABELS[preference]}</option>)}
          </select>
        </label>
        <label className="toggle-field">
          <input type="checkbox" checked={soundEnabled} onChange={(event) => onSoundEnabledChange(event.target.checked)} />
          <span>Bật toàn bộ âm thanh & nhạc nền không gian</span>
        </label>

        {soundEnabled ? (
          <div className="audio-sliders-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
            <label className="field-label" htmlFor="audio-master-volume">
              <span>Âm lượng tổng: <strong>{Math.round(masterVolume * 100)}%</strong></span>
              <input
                id="audio-master-volume"
                type="range"
                min="0"
                max="100"
                step="5"
                value={Math.round(masterVolume * 100)}
                onChange={(e) => onMasterVolumeChange?.(Number(e.target.value) / 100)}
              />
            </label>

            <label className="field-label" htmlFor="audio-music-volume">
              <span>Nhạc nền (BGM): <strong>{Math.round(musicVolume * 100)}%</strong></span>
              <input
                id="audio-music-volume"
                type="range"
                min="0"
                max="100"
                step="5"
                value={Math.round(musicVolume * 100)}
                onChange={(e) => onMusicVolumeChange?.(Number(e.target.value) / 100)}
              />
            </label>

            <label className="field-label" htmlFor="audio-sfx-volume">
              <span>Hiệu ứng thao tác (SFX): <strong>{Math.round(sfxVolume * 100)}%</strong></span>
              <input
                id="audio-sfx-volume"
                type="range"
                min="0"
                max="100"
                step="5"
                value={Math.round(sfxVolume * 100)}
                onChange={(e) => onSfxVolumeChange?.(Number(e.target.value) / 100)}
              />
            </label>
          </div>
        ) : null}

        <button type="button" className="secondary-button" style={{ marginTop: '0.5rem' }} onClick={onOpenTutorial}>Xem lại hướng dẫn chơi</button>
      </fieldset>

      {desktopEdition ? (
        <label className="field-label graphics-texture-pack" htmlFor="graphics-texture-pack">
          <span>Gói texture Poly Haven</span>
          <select id="graphics-texture-pack" value={assetPackQuality} onChange={updateTexturePack}>
            {DESKTOP_TEXTURE_PACKS.map((pack) => <option key={pack} value={pack} disabled={!canSelectTexturePack(pack)}>{ASSET_PACK_LABELS[pack]} · {TEXTURE_PACK_DESCRIPTIONS[pack]}{texturePackAccessLabel(pack)}</option>)}
          </select>
        </label>
      ) : (
        <p className="graphics-settings-note">Bản web chỉ dùng gói 1K để tải nhanh; không tải, mở hoặc nạp sẵn gói 2K, 4K hay 8K.</p>
      )}

      <fieldset className="graphics-component-grid">
        <legend>Ghi đè theo hạng mục</legend>
        {GRAPHICS_QUALITY_COMPONENTS.map((component) => (
          <GraphicsOverrideSelect key={component} component={component} value={overrides[component]} onChange={updateOverride} />
        ))}
      </fieldset>

      {desktopEdition ? (
        <p className="graphics-settings-note">2K/4K chỉ mở khi bản cài đặt phát hiện manifest gói đã tải cục bộ. Aetheria Cinema 8K cần quyền mua được xác minh, gói 8K cục bộ và GPU hỗ trợ texture 8192 px; nếu thiếu điều kiện, game giữ 4K/2K/1K mà không làm dừng mô phỏng.</p>
      ) : (
        <p className="graphics-settings-note">Các lựa chọn kết xuất theo từng hạng mục không tải thêm texture desktop: Bản web vẫn giữ nguồn asset 1K, hoặc dùng bản dự phòng 512 px khi GPU/WebGL yếu.</p>
      )}
    </section>
  )
}
