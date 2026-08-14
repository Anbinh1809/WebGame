import type { ChangeEvent, JSX } from 'react'
import { WORLD_SIZES } from '../world/types'
import type { WorldConfig } from '../world/types'

interface WorldControlsProps {
  draft: WorldConfig
  activeSeed: string
  onDraftChange: (config: WorldConfig) => void
  onGenerate: () => void
  onRandomWorld: () => void
  onCopySeed: () => void
  onSave: () => void
  onLoad: () => void
  onReset: () => void
  onExport: () => void
  onImport: () => void
}

export function WorldControls({
  draft,
  activeSeed,
  onDraftChange,
  onGenerate,
  onRandomWorld,
  onCopySeed,
  onSave,
  onLoad,
  onReset,
  onExport,
  onImport,
}: WorldControlsProps): JSX.Element {
  const updateText = (event: ChangeEvent<HTMLInputElement>): void => {
    onDraftChange({ ...draft, seed: event.target.value })
  }

  const updateNumber = (key: 'water' | 'resources') => (event: ChangeEvent<HTMLInputElement>): void => {
    onDraftChange({ ...draft, [key]: Number(event.target.value) })
  }

  return (
    <section className="world-controls-modern" aria-labelledby="world-heading">
      {/* Title Header */}
      <div className="section-title-box">
        <span className="section-icon">🌍</span>
        <div style={{ flex: 1 }}>
          <h2 id="world-heading" className="section-title">Khởi Tạo Thế Giới</h2>
          <p className="section-subtitle">Tùy biến mầm số, khí hậu và tài nguyên lục địa</p>
        </div>
        <span className="slider-badge" title="Seed đang quan sát">{activeSeed}</span>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          onGenerate()
        }}
      >
        {/* Card 1: Seed & Map Generation */}
        <div className="settings-card">
          <div className="card-header">
            <span className="card-icon">🎲</span>
            <span className="card-title">Mầm Thế Giới (Seed)</span>
          </div>
          <div className="card-body">
            <div className="seed-input-group">
              <input
                id="world-seed"
                className="game-text-input"
                value={draft.seed}
                onChange={updateText}
                maxLength={64}
                spellCheck="false"
                placeholder="Nhập seed tùy ý..."
              />
              <button
                type="button"
                className="game-btn-icon"
                onClick={onCopySeed}
                title="Sao chép seed hiện tại"
                aria-label="Sao chép seed"
              >
                📋
              </button>
            </div>

            <div className="two-col-grid">
              <div className="field-group">
                <label className="field-label" htmlFor="world-size">
                  <span>Kích thước bản đồ</span>
                  <select
                    id="world-size"
                    className="game-select"
                    value={draft.size}
                    onChange={(event) => onDraftChange({ ...draft, size: Number(event.target.value) })}
                  >
                    {WORLD_SIZES.map((size) => (
                      <option key={size} value={size}>{size} × {size} ô</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="world-climate">
                  <span>Khí hậu</span>
                  <select
                    id="world-climate"
                    className="game-select"
                    value={draft.climate}
                    onChange={(event) => onDraftChange({ ...draft, climate: event.target.value as WorldConfig['climate'] })}
                  >
                    <option value="ôn hòa">Ôn hòa 🌤️</option>
                    <option value="ấm">Ấm áp ☀️</option>
                    <option value="lạnh">Hàn đới ❄️</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Environmental Ratios */}
        <div className="settings-card">
          <div className="card-header">
            <span className="card-icon">💧</span>
            <span className="card-title">Địa Hình & Tài Nguyên</span>
          </div>
          <div className="card-body">
            <div className="slider-row">
              <div className="slider-info">
                <span>Tỉ lệ Nước & Biển</span>
                <span className="slider-badge">{Math.round(draft.water * 100)}%</span>
              </div>
              <input
                id="world-water"
                type="range"
                className="game-slider"
                min="0.2"
                max="0.82"
                step="0.02"
                value={draft.water}
                onChange={updateNumber('water')}
              />
            </div>

            <div className="slider-row">
              <div className="slider-info">
                <span>Độ trù phú Tài nguyên</span>
                <span className="slider-badge">{Math.round(draft.resources * 100)}%</span>
              </div>
              <input
                id="world-resources"
                type="range"
                className="game-slider"
                min="0.2"
                max="1"
                step="0.02"
                value={draft.resources}
                onChange={updateNumber('resources')}
              />
            </div>

            {/* Primary Action Buttons */}
            <div className="primary-actions-row">
              <button type="submit" className="game-btn game-btn-primary flex-1">
                ⚡ Tái tạo thế giới
              </button>
              <button type="button" className="game-btn game-btn-secondary flex-1" onClick={onRandomWorld}>
                ✨ Thế giới ngẫu nhiên
              </button>
            </div>
          </div>
        </div>

        {/* Card 3: Storage & Files */}
        <div className="settings-card">
          <div className="card-header">
            <span className="card-icon">💾</span>
            <span className="card-title">Lưu Trữ & Xuất Nhập</span>
          </div>
          <div className="card-body">
            <div className="action-buttons-grid">
              <button type="button" className="quick-action-btn" onClick={onSave}>
                <span>💾</span>
                <span>Lưu nhanh</span>
              </button>
              <button type="button" className="quick-action-btn" onClick={onLoad}>
                <span>📂</span>
                <span>Nạp file</span>
              </button>
              <button type="button" className="quick-action-btn" onClick={onReset}>
                <span>🔄</span>
                <span>Đặt lại</span>
              </button>
              <button type="button" className="quick-action-btn" onClick={onExport}>
                <span>📤</span>
                <span>Xuất JSON</span>
              </button>
              <button type="button" className="quick-action-btn" onClick={onImport}>
                <span>📥</span>
                <span>Nhập JSON</span>
              </button>
            </div>
          </div>
        </div>
      </form>
    </section>
  )
}
