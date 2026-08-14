import { useState } from 'react'
import type { ChangeEvent, JSX } from 'react'
import type { AssetPackQuality } from '../assets/types'
import { MOTION_PREFERENCE_LABELS } from '../renderer/MotionPreference'
import type { MotionPreference } from '../renderer/MotionPreference'
import type { DesktopPackAvailability } from '../assets/desktopPackManifest'
import { ASSET_PACK_LABELS, DESKTOP_TEXTURE_PACKS } from '../runtime/edition'
import {
  FPS_LIMIT_LABELS,
  FPS_LIMIT_OPTIONS,
  GRAPHICS_COMPONENT_LABELS,
  GRAPHICS_QUALITY_COMPONENTS,
  QUALITY_LABELS,
} from '../renderer/quality'
import type {
  EffectiveQuality,
  FpsLimit,
  GraphicsQualityComponent,
  GraphicsQualityOverride,
  GraphicsQualityOverrides,
  QualityProfile,
} from '../renderer/quality'

interface GraphicsSettingsProps {
  quality: QualityProfile
  fpsLimit?: FpsLimit | undefined
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
  onFpsLimitChange?: (limit: FpsLimit) => void
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
  inherit: 'Mặc định',
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
    <div className="override-select-row">
      <label htmlFor={id} className="override-label">{GRAPHICS_COMPONENT_LABELS[component]}</label>
      <select
        id={id}
        className="game-select-compact"
        value={value}
        onChange={(event) => onChange(component, event.target.value as GraphicsQualityOverride)}
      >
        <option value="inherit">{OVERRIDE_LABELS.inherit}</option>
        {EFFECTIVE_QUALITY_OPTIONS.map((profile) => (
          <option key={profile} value={profile}>{OVERRIDE_LABELS[profile]}</option>
        ))}
      </select>
    </div>
  )
}

export function GraphicsSettings({
  quality,
  fpsLimit = 'auto',
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
  onFpsLimitChange,
  onMotionPreferenceChange,
  onSoundEnabledChange,
  onMasterVolumeChange,
  onMusicVolumeChange,
  onSfxVolumeChange,
  onOpenTutorial,
  onOverridesChange,
  onAssetPackQualityChange,
}: GraphicsSettingsProps): JSX.Element {
  const [showAdvanced, setShowAdvanced] = useState(false)

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
    if (pack === 'cinema-8k' && !cinema8kEntitled) return isCheckingCinemaEntitlement ? ' · đang kiểm tra' : ' · cần mua'
    if (!desktopPackAvailability[pack]) return isCheckingDesktopPacks ? ' · đang tải' : ' · chưa tải'
    return ' · đã cài'
  }

  return (
    <section className="graphics-settings-modern panel-surface" aria-labelledby="graphics-settings-heading">
      {/* Header */}
      <div className="section-title-box">
        <span className="section-icon">⚙️</span>
        <div>
          <h2 id="graphics-settings-heading" className="section-title">Tùy chỉnh đồ họa & âm thanh</h2>
          <p className="section-subtitle">Hiệu năng hiển thị và âm thanh thế giới sống động</p>
        </div>
      </div>

      {/* Card 1: Performance & Display */}
      <div className="settings-card">
        <div className="card-header">
          <span className="card-icon">🖥️</span>
          <span className="card-title">Hiệu Năng & Khung Hình</span>
        </div>

        <div className="card-body">
          <div className="field-group">
            <label className="field-label" htmlFor="graphics-global-quality">
              <span>Chất lượng tổng thể</span>
              <select
                id="graphics-global-quality"
                className="game-select"
                value={quality}
                onChange={(event) => onQualityChange(event.target.value as QualityProfile)}
              >
                {(Object.keys(QUALITY_LABELS) as QualityProfile[]).map((profile) => (
                  <option key={profile} value={profile}>{QUALITY_LABELS[profile]}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="graphics-fps-limit">
              <span>Giới hạn khung hình (FPS)</span>
              <select
                id="graphics-fps-limit"
                className="game-select"
                value={fpsLimit}
                onChange={(event) => onFpsLimitChange?.(event.target.value as FpsLimit)}
              >
                {FPS_LIMIT_OPTIONS.map((limit) => (
                  <option key={limit} value={limit}>
                    {FPS_LIMIT_LABELS[limit]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="graphics-motion-preference">
              <span>Chuyển động & Hiệu ứng</span>
              <select
                id="graphics-motion-preference"
                className="game-select"
                value={motionPreference}
                onChange={(event) => onMotionPreferenceChange(event.target.value as MotionPreference)}
              >
                {(Object.keys(MOTION_PREFERENCE_LABELS) as MotionPreference[]).map((preference) => (
                  <option key={preference} value={preference}>{MOTION_PREFERENCE_LABELS[preference]}</option>
                ))}
              </select>
            </label>
          </div>

          {desktopEdition && (
            <div className="field-group">
              <label className="field-label" htmlFor="graphics-texture-pack">
                <span>Gói texture Poly Haven</span>
                <select
                  id="graphics-texture-pack"
                  className="game-select"
                  value={assetPackQuality}
                  onChange={updateTexturePack}
                >
                  {DESKTOP_TEXTURE_PACKS.map((pack) => (
                    <option key={pack} value={pack} disabled={!canSelectTexturePack(pack)}>
                      {ASSET_PACK_LABELS[pack]} · {TEXTURE_PACK_DESCRIPTIONS[pack]}{texturePackAccessLabel(pack)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Card 2: Audio & Immersion */}
      <div className="settings-card">
        <div className="card-header">
          <span className="card-icon">🔊</span>
          <span className="card-title">Âm Thanh Không Gian</span>
        </div>

        <div className="card-body">
          <label className="modern-toggle-row">
            <span>Bật âm thanh & nhạc nền</span>
            <input
              type="checkbox"
              className="game-checkbox"
              checked={soundEnabled}
              onChange={(event) => onSoundEnabledChange(event.target.checked)}
            />
          </label>

          {soundEnabled ? (
            <div className="audio-sliders-grid">
              <div className="slider-row">
                <div className="slider-info">
                  <span>Âm lượng tổng</span>
                  <span className="slider-badge">{Math.round(masterVolume * 100)}%</span>
                </div>
                <input
                  id="audio-master-volume"
                  type="range"
                  className="game-slider"
                  min="0"
                  max="100"
                  step="5"
                  value={Math.round(masterVolume * 100)}
                  onChange={(e) => onMasterVolumeChange?.(Number(e.target.value) / 100)}
                />
              </div>

              <div className="slider-row">
                <div className="slider-info">
                  <span>Nhạc nền (BGM)</span>
                  <span className="slider-badge">{Math.round(musicVolume * 100)}%</span>
                </div>
                <input
                  id="audio-music-volume"
                  type="range"
                  className="game-slider"
                  min="0"
                  max="100"
                  step="5"
                  value={Math.round(musicVolume * 100)}
                  onChange={(e) => onMusicVolumeChange?.(Number(e.target.value) / 100)}
                />
              </div>

              <div className="slider-row">
                <div className="slider-info">
                  <span>Hiệu ứng (SFX)</span>
                  <span className="slider-badge">{Math.round(sfxVolume * 100)}%</span>
                </div>
                <input
                  id="audio-sfx-volume"
                  type="range"
                  className="game-slider"
                  min="0"
                  max="100"
                  step="5"
                  value={Math.round(sfxVolume * 100)}
                  onChange={(e) => onSfxVolumeChange?.(Number(e.target.value) / 100)}
                />
              </div>
            </div>
          ) : null}

          <button
            type="button"
            className="secondary-button full-width-btn"
            style={{ marginTop: '0.75rem' }}
            onClick={onOpenTutorial}
          >
            📖 Xem lại hướng dẫn chơi
          </button>
        </div>
      </div>

      {/* Card 3: Advanced Overrides */}
      <div className="settings-card">
        <button
          type="button"
          className="card-header card-accordion-toggle"
          onClick={() => setShowAdvanced(!showAdvanced)}
          aria-expanded={showAdvanced}
        >
          <div className="card-title-group">
            <span className="card-icon">🛠️</span>
            <span className="card-title">Tùy Chỉnh Nâng Cao</span>
          </div>
          <span className="accordion-arrow">{showAdvanced ? '▲' : '▼'}</span>
        </button>

        <div className="card-body accordion-content" style={{ display: showAdvanced ? 'flex' : 'none' }}>
          <div className="overrides-list">
            {GRAPHICS_QUALITY_COMPONENTS.map((component) => (
              <GraphicsOverrideSelect
                key={component}
                component={component}
                value={overrides[component]}
                onChange={updateOverride}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
