import type { JSX } from 'react'
import type { HoveredTile } from '../renderer/WorldRenderer'
import type { SimulationSpeed, SimulationState } from '../simulation/types'
import type { HeatmapMode, World } from '../world/types'

interface SimulationPanelProps {
  world: World
  simulation: SimulationState
  selectedTile: HoveredTile | undefined
  heatmap: HeatmapMode
  onHeatmapChange: (mode: HeatmapMode) => void
  onPauseToggle: () => void
  onSpeedChange: (speed: SimulationSpeed) => void
  onPhoto: () => void
}

const SPEEDS: SimulationSpeed[] = [1, 2, 4, 8]

export function SimulationPanel({
  world,
  simulation,
  selectedTile,
  heatmap,
  onHeatmapChange,
  onPauseToggle,
  onSpeedChange,
  onPhoto,
}: SimulationPanelProps): JSX.Element {
  const village = simulation.villages[0]
  const selected = selectedTile?.tile

  return (
    <aside className="simulation-stack" aria-label="Bảng mô phỏng và lịch sử">
      <section className="panel-surface simulation-panel" aria-labelledby="simulation-heading">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Mô phỏng cố định</span>
            <h2 id="simulation-heading">{village?.name ?? 'Thung lũng trống'}</h2>
          </div>
          <span className={`weather-dot ${simulation.activeStorm ? 'is-stormy' : ''}`}>
            {simulation.activeStorm ? 'Mưa lớn' : 'Trời quang'}
          </span>
        </div>
        {village ? (
          <div className="stat-grid" aria-label="Chỉ số của làng">
            <div><span>Dân số</span><strong>{village.population}</strong></div>
            <div><span>Lương thực</span><strong>{Math.round(village.food)}</strong></div>
            <div><span>Hạnh phúc</span><strong>{Math.round(village.happiness)}%</strong></div>
            <div><span>Thời đại</span><strong>{village.era}</strong></div>
          </div>
        ) : <p className="muted-copy">Chưa có cộng đồng nào trên bản đồ này.</p>}
        <p className="decision-line">{village?.lastDecision ?? 'Chờ một câu chuyện bắt đầu.'}</p>

        <div className="time-controls" aria-label="Điều khiển thời gian">
          <button type="button" className="pause-button" onClick={onPauseToggle} aria-pressed={simulation.paused} aria-keyshortcuts="Space">
            {simulation.paused ? '▶ Tiếp tục' : 'Ⅱ Tạm dừng'}
          </button>
          <div className="speed-buttons" role="group" aria-label="Tốc độ mô phỏng">
            {SPEEDS.map((speed) => (
              <button
                key={speed}
                type="button"
                className={!simulation.paused && simulation.speed === speed ? 'is-active' : ''}
                onClick={() => onSpeedChange(speed)}
                aria-pressed={!simulation.paused && simulation.speed === speed}
              >
                {speed}×
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="panel-surface lens-panel" aria-labelledby="lens-heading">
        <div className="panel-heading compact-heading">
          <div>
            <span className="eyebrow">Story Lens</span>
            <h2 id="lens-heading">Ống kính chuyện kể</h2>
          </div>
          <button type="button" className="icon-button" onClick={onPhoto} aria-label="Chụp ảnh thế giới PNG">⌑</button>
        </div>
        {selected ? (
          <p>
            Ô <strong>{selected.x + 1}, {selected.z + 1}</strong>: {selected.biome}, đất {selected.soil}; tài nguyên {Math.round(selected.resources * 100)}%.
          </p>
        ) : (
          <p>Rê chuột lên thế giới để đọc địa hình. Nhấp để áp dụng quyền năng đang chọn.</p>
        )}
        <div className="heatmap-control" role="group" aria-label="Lớp quan sát">
          {(['địa hình', 'tài nguyên', 'hạnh phúc'] as HeatmapMode[]).map((mode) => (
            <button key={mode} type="button" className={heatmap === mode ? 'is-active' : ''} onClick={() => onHeatmapChange(mode)} aria-pressed={heatmap === mode}>
              {mode}
            </button>
          ))}
        </div>
        <small>Seed hiện tại: <code>{world.config.seed}</code></small>
      </section>

      <section className="panel-surface timeline-panel" aria-labelledby="timeline-heading">
        <div className="panel-heading compact-heading">
          <div>
            <span className="eyebrow">Biên niên sử</span>
            <h2 id="timeline-heading">Tick {simulation.tick}</h2>
          </div>
        </div>
        <ol className="event-list">
          {simulation.events.slice(0, 5).map((event) => (
            <li key={event.id} className={`event-${event.tone}`}>
              <span>T{event.tick}</span>
              <div><strong>{event.title}</strong><p>{event.detail}</p></div>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  )
}
