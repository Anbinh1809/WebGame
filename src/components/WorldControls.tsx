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
}

export function WorldControls({
  draft,
  activeSeed,
  onDraftChange,
  onGenerate,
  onRandomWorld,
  onCopySeed,
}: WorldControlsProps): JSX.Element {
  const updateText = (event: ChangeEvent<HTMLInputElement>): void => {
    onDraftChange({ ...draft, seed: event.target.value })
  }

  const updateNumber = (key: 'water' | 'resources') => (event: ChangeEvent<HTMLInputElement>): void => {
    onDraftChange({ ...draft, [key]: Number(event.target.value) })
  }

  return (
    <section className="world-controls panel-surface" aria-labelledby="world-heading">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Khởi tạo</span>
          <h2 id="world-heading">Mầm thế giới</h2>
        </div>
        <span className="seed-chip" title="Seed của thế giới đang quan sát">{activeSeed}</span>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onGenerate()
        }}
      >
        <label className="field-label" htmlFor="world-seed">Seed</label>
        <div className="seed-row">
          <input id="world-seed" value={draft.seed} onChange={updateText} maxLength={64} spellCheck="false" />
          <button type="button" className="icon-button" onClick={onCopySeed} aria-label="Sao chép seed của thế giới hiện tại">⧉</button>
        </div>

        <div className="field-grid">
          <label className="field-label" htmlFor="world-size">
            Kích thước
            <select
              id="world-size"
              value={draft.size}
              onChange={(event) => onDraftChange({ ...draft, size: Number(event.target.value) })}
            >
              {WORLD_SIZES.map((size) => <option key={size} value={size}>{size} × {size}</option>)}
            </select>
          </label>
          <label className="field-label" htmlFor="world-climate">
            Khí hậu
            <select
              id="world-climate"
              value={draft.climate}
              onChange={(event) => onDraftChange({ ...draft, climate: event.target.value as WorldConfig['climate'] })}
            >
              <option value="ôn hòa">Ôn hòa</option>
              <option value="ấm">Ấm</option>
              <option value="lạnh">Lạnh</option>
            </select>
          </label>
        </div>

        <label className="range-field" htmlFor="world-water">
          <span><span>Nước</span><output>{Math.round(draft.water * 100)}%</output></span>
          <input id="world-water" type="range" min="0.2" max="0.82" step="0.02" value={draft.water} onChange={updateNumber('water')} />
        </label>
        <label className="range-field" htmlFor="world-resources">
          <span><span>Tài nguyên</span><output>{Math.round(draft.resources * 100)}%</output></span>
          <input id="world-resources" type="range" min="0.2" max="1" step="0.02" value={draft.resources} onChange={updateNumber('resources')} />
        </label>

        <div className="form-actions">
          <button type="submit" className="primary-button">Tái tạo</button>
          <button type="button" className="secondary-button" onClick={onRandomWorld}>Seed mới</button>
        </div>
      </form>
    </section>
  )
}
