import type { ChangeEvent, JSX } from 'react'
import type { AssetPackQuality } from '../assets/types'
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
  overrides: GraphicsQualityOverrides
  assetPackQuality: AssetPackQuality
  desktopEdition: boolean
  desktopPackAvailability?: DesktopPackAvailability
  cinema8kEntitled?: boolean
  isCheckingDesktopPacks?: boolean
  isCheckingCinemaEntitlement?: boolean
  onQualityChange: (quality: QualityProfile) => void
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
  overrides,
  assetPackQuality,
  desktopEdition,
  desktopPackAvailability = EMPTY_DESKTOP_PACK_AVAILABILITY,
  cinema8kEntitled = false,
  isCheckingDesktopPacks = false,
  isCheckingCinemaEntitlement = false,
  onQualityChange,
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
          <span className="eyebrow">Đồ họa 3D</span>
          <h2 id="graphics-settings-heading">Tùy chỉnh đồ họa</h2>
        </div>
      </div>

      <p className="graphics-settings-intro">Chọn mức tổng thể, rồi chỉ nâng phần cần thiết. Gói texture độc lập với độ phân giải màn hình.</p>

      <label className="field-label" htmlFor="graphics-global-quality">
        <span>Chất lượng tổng thể</span>
        <select id="graphics-global-quality" value={quality} onChange={(event) => onQualityChange(event.target.value as QualityProfile)}>
          {(Object.keys(QUALITY_LABELS) as QualityProfile[]).map((profile) => <option key={profile} value={profile}>{QUALITY_LABELS[profile]}</option>)}
        </select>
      </label>

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
