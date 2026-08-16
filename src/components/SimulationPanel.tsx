import { useRef, useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { ChroniclePanel } from './ChroniclePanel'
import type { HoveredTile } from '../renderer/WorldRenderer'
import { assessVillageKnowledge, availableVillageKnowledge, villageKnowledgeDefinition, VILLAGE_KNOWLEDGE_DEFINITIONS } from '../simulation/knowledge'
import { nextVillageTool, villageEraLabel, VILLAGE_TOOL_DEFINITIONS } from '../simulation/progression'
import type { CouncilChoiceId, SimulationSpeed, SimulationState, VillageKnowledgeAssessment } from '../simulation/types'
import { summarizeFauna } from '../world/fauna'
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
  onCouncilDecision: (choice: CouncilChoiceId) => void
  onDevelopVillageTool: () => void
  onSubmitKnowledge: (proposal: string) => void
}

const SPEEDS: SimulationSpeed[] = [1, 2, 4, 8]
const SPEED_LABELS: Record<SimulationSpeed, string> = { 0: '⏸', 1: '▶ 1×', 2: '⏩ 2×', 4: '⏭ 4×', 8: '💨 8×' }

function StatBar({ value, max, color }: { value: number; max: number; color: string }): JSX.Element {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100))
  return (
    <div className="sim-stat-bar-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="sim-stat-bar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

function DayNightIndicator({ tick }: { tick: number }): JSX.Element {
  const phase = (tick % 96) / 96
  const sunAngle = phase * Math.PI * 2
  const sunArc = Math.sin(sunAngle)

  let icon = '☀️'
  let label = 'Ban ngày'
  let cls = 'day'
  if (sunArc < -0.35) { icon = '🌙'; label = 'Đêm tối'; cls = 'night' }
  else if (sunArc < 0 && sunArc >= -0.35) { icon = '🌆'; label = 'Hoàng hôn'; cls = 'dusk' }
  else if (sunArc >= 0 && sunArc < 0.18) { icon = '🌅'; label = 'Bình minh'; cls = 'dawn' }

  const hours = Math.floor(phase * 24)
  const mins = Math.floor((phase * 24 - hours) * 60)
  const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`

  return (
    <span className={`day-night-indicator dn-${cls}`} title={label}>
      <span className="dn-icon">{icon}</span>
      <span className="dn-time">{timeStr}</span>
    </span>
  )
}

export function SimulationPanel({
  world,
  simulation,
  selectedTile,
  heatmap,
  onHeatmapChange,
  onPauseToggle,
  onSpeedChange,
  onPhoto,
  onCouncilDecision,
  onDevelopVillageTool,
  onSubmitKnowledge,
}: SimulationPanelProps): JSX.Element {
  const [knowledgeDraft, setKnowledgeDraft] = useState('')
  const [knowledgeAssessment, setKnowledgeAssessment] = useState<VillageKnowledgeAssessment | undefined>()
  const knowledgeInputRef = useRef<HTMLInputElement>(null)
  const village = simulation.villages[0]
  const selected = selectedTile?.tile
  const nextTool = village ? nextVillageTool(village.tools) : undefined
  const canDevelopTool = Boolean(nextTool && village && village.research >= nextTool.researchCost && village.food >= nextTool.foodCost)
  const availableKnowledge = village ? availableVillageKnowledge(village) : []
  const fauna = summarizeFauna(world)

  const handleKnowledgeSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (!village) return
    const assessment = assessVillageKnowledge(village, knowledgeDraft)
    setKnowledgeAssessment(assessment)
    if (assessment.status !== 'accepted') return
    onSubmitKnowledge(knowledgeDraft)
    setKnowledgeDraft('')
  }

  return (
    <div className="simulation-stack">
      <section className="panel-surface simulation-panel" aria-labelledby="simulation-heading">

        {/* ── Village Header ── */}
        <div className="sim-village-header">
          <div className="sim-village-title">
            <span className="eyebrow">Mô phỏng theo nhịp cố định</span>
            <h2 id="simulation-heading">{village?.name ?? 'Thung lũng trống'}</h2>
          </div>
          <div className="sim-header-badges">
            <DayNightIndicator tick={simulation.tick} />
            <span className={`weather-dot ${simulation.activeStorm ? 'is-stormy' : ''}`}>
              {simulation.activeStorm ? '⛈️ Mưa lớn' : '☀️ Trời quang'}
            </span>
          </div>
        </div>

        {village ? (
          <>
            {/* ── Era Badge ── */}
            <div className="sim-era-badge">
              <span className="era-epoch">{village.epoch ?? 'Kỷ Tiền Cambri'}</span>
              <span className="era-label">⚔️ {villageEraLabel(village.era)}</span>
              <span className="era-dna">🧬 +{Math.round(village.dnaPoints ?? 15)} DNA</span>
            </div>

            {/* ── Stat Cards ── */}
            <div className="sim-stat-cards" role="group" aria-label="Chỉ số của làng">
              <div className="sim-stat-card">
                <div className="ssc-header">
                  <span className="ssc-icon">👥</span>
                  <span className="ssc-label">Dân số</span>
                  <strong className="ssc-value">{village.population}</strong>
                </div>
              </div>
              <div className="sim-stat-card">
                <div className="ssc-header">
                  <span className="ssc-icon">🍖</span>
                  <span className="ssc-label">Lương thực</span>
                  <strong className="ssc-value">{Math.round(village.food)}</strong>
                </div>
                <StatBar value={village.food} max={500} color="linear-gradient(90deg, #f59e0b, #fbbf24)" />
              </div>
              <div className="sim-stat-card">
                <div className="ssc-header">
                  <span className="ssc-icon">😊</span>
                  <span className="ssc-label">Hạnh phúc</span>
                  <strong className="ssc-value" style={{ color: village.happiness >= 70 ? '#4ade80' : village.happiness >= 40 ? '#fbbf24' : '#f87171' }}>
                    {Math.round(village.happiness)}%
                  </strong>
                </div>
                <StatBar
                  value={village.happiness}
                  max={100}
                  color={village.happiness >= 70 ? 'linear-gradient(90deg, #22c55e, #4ade80)' : village.happiness >= 40 ? 'linear-gradient(90deg, #d97706, #fbbf24)' : 'linear-gradient(90deg, #dc2626, #f87171)'}
                />
              </div>
              <div className="sim-stat-card">
                <div className="ssc-header">
                  <span className="ssc-icon">🔬</span>
                  <span className="ssc-label">Nghiên cứu</span>
                  <strong className="ssc-value ssc-cyan">{Math.round(village.research)}</strong>
                </div>
                <StatBar value={village.research} max={nextTool?.researchCost ?? 200} color="linear-gradient(90deg, #0ea5e9, #38bdf8)" />
              </div>
              <div className="sim-stat-card">
                <div className="ssc-header">
                  <span className="ssc-icon">🌿</span>
                  <span className="ssc-label">Sinh khối</span>
                  <strong className="ssc-value ssc-emerald">{Math.round(village.biomass ?? 30)}</strong>
                </div>
                <StatBar value={village.biomass ?? 30} max={200} color="linear-gradient(90deg, #16a34a, #4ade80)" />
              </div>
              <div className="sim-stat-card">
                <div className="ssc-header">
                  <span className="ssc-icon">🦋</span>
                  <span className="ssc-label">Đa dạng</span>
                  <strong className="ssc-value ssc-violet">{village.biodiversity ?? 65}%</strong>
                </div>
                <StatBar value={village.biodiversity ?? 65} max={100} color="linear-gradient(90deg, #7c3aed, #c084fc)" />
              </div>
            </div>
          </>
        ) : <p className="muted-copy">Chưa có cộng đồng nào trên bản đồ này.</p>}

        <p className="decision-line">{village?.lastDecision ?? 'Chờ một câu chuyện bắt đầu.'}</p>

        {/* ── Fauna Roster ── */}
        <section className="fauna-roster" aria-labelledby="fauna-heading">
          <div className="panel-heading compact-heading">
            <div>
              <span className="eyebrow">Hệ sinh thái theo seed</span>
              <h3 id="fauna-heading">Thú &amp; sinh vật</h3>
            </div>
            <span className="fauna-badge">{fauna.animals} thú · {fauna.monsters} quái</span>
          </div>
          <p>{fauna.species.map((species) => `${species.label} ×${species.count}`).join(' · ')}</p>
        </section>

        {village ? (
          <section className="progression-panel" aria-labelledby="progression-heading">
            <div className="panel-heading compact-heading">
              <div>
                <span className="eyebrow">Tiến hoá cộng đồng</span>
                <h3 id="progression-heading">Xưởng công cụ · {village.tools.length}/{VILLAGE_TOOL_DEFINITIONS.length}</h3>
              </div>
            </div>
            <ol className="tool-inventory" aria-label="Chuỗi công cụ của làng">
              {VILLAGE_TOOL_DEFINITIONS.map((tool, index) => {
                const unlocked = village.tools.includes(tool.id)
                const current = !unlocked && index === village.tools.length
                return (
                  <li key={tool.id} className={unlocked ? 'is-unlocked' : current ? 'is-current' : ''}>
                    <strong>{tool.label}</strong>
                    <span>{unlocked ? '✅ Đã rèn' : current ? '⚒️ Kế tiếp' : '🔒 Khoá'}</span>
                    <small>{tool.benefit}</small>
                  </li>
                )
              })}
            </ol>
            {nextTool ? (
              <div className="craft-action">
                <button type="button" onClick={onDevelopVillageTool} disabled={!canDevelopTool}>
                  {canDevelopTool ? '⚒️' : '🔒'} Rèn {nextTool.label}
                </button>
                <small>Cần {nextTool.researchCost} nghiên cứu · {nextTool.foodCost} lương thực</small>
              </div>
            ) : (
              <p className="muted-copy">Chuỗi công cụ hoàn tất: làng đã trở thành một thị trấn tự lực.</p>
            )}
          </section>
        ) : null}

        {village ? (
          <section className="knowledge-panel" aria-labelledby="knowledge-heading">
            <div className="panel-heading compact-heading">
              <div>
                <span className="eyebrow">Viện tri thức</span>
                <h3 id="knowledge-heading">Truyền đạt cho {village.name}</h3>
              </div>
              <span className="knowledge-count">{village.knowledge.length}/{VILLAGE_KNOWLEDGE_DEFINITIONS.length}</span>
            </div>
            <p id="knowledge-compatibility-note" className="knowledge-rule">Hội đồng đối chiếu công cụ đang có, tri thức tiền đề và kỹ thuật vượt thời đại. Chỉ đề xuất phù hợp mới tác động vào mô phỏng.</p>
            <form className="knowledge-form" onSubmit={handleKnowledgeSubmit}>
              <label htmlFor="knowledge-proposal">
                <span>Kiến thức muốn truyền</span>
                <input
                  ref={knowledgeInputRef}
                  id="knowledge-proposal"
                  value={knowledgeDraft}
                  onChange={(event) => setKnowledgeDraft(event.target.value)}
                  maxLength={160}
                  placeholder="Ví dụ: Giữ lửa và hong khô"
                  aria-describedby="knowledge-compatibility-note knowledge-rule"
                />
              </label>
              <button type="submit" disabled={!knowledgeDraft.trim()}>Thẩm định &amp; truyền</button>
            </form>
            <p id="knowledge-rule" className={`knowledge-assessment ${knowledgeAssessment ? `is-${knowledgeAssessment.status}` : ''}`} role="status" aria-live="polite">
              {knowledgeAssessment ? <><strong>{knowledgeAssessment.title}</strong><span>{knowledgeAssessment.detail}</span></> : 'Chưa có đề xuất nào được thẩm định.'}
            </p>
            {village.knowledge.length > 0 ? (
              <ul className="knowledge-ledger" aria-label="Tri thức đã được truyền đạt">
                {village.knowledge.map((knowledgeId) => {
                  const knowledge = villageKnowledgeDefinition(knowledgeId)
                  return <li key={knowledge.id}><strong>{knowledge.label}</strong><span>{knowledge.summary}</span></li>
                })}
              </ul>
            ) : <p className="muted-copy">Chưa có tri thức nào được xác nhận. Hãy bắt đầu từ kỹ thuật đá và lửa.</p>}
            {availableKnowledge.length > 0 ? (
              <div className="knowledge-suggestions" role="group" aria-label="Gợi ý tri thức phù hợp">
                <span>Gợi ý phù hợp lúc này</span>
                <div>
                  {availableKnowledge.slice(0, 3).map((knowledge) => (
                    <button
                      key={knowledge.id}
                      type="button"
                      onClick={() => {
                        setKnowledgeDraft(knowledge.label)
                        setKnowledgeAssessment(undefined)
                        window.requestAnimationFrame(() => knowledgeInputRef.current?.focus())
                      }}
                    >
                      {knowledge.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : <p className="muted-copy">Rèn thêm công cụ hoặc hoàn thiện tri thức tiền đề để mở đề xuất mới.</p>}
          </section>
        ) : null}

        <section className="objective-board" aria-labelledby="objective-heading">
          <div className="panel-heading compact-heading">
            <div>
              <span className="eyebrow">Mục tiêu theo seed</span>
              <h3 id="objective-heading">Dấu mốc thời đại</h3>
            </div>
          </div>
          <ol>
            {simulation.objectives.map((objective) => {
              const percentage = Math.min(100, Math.round((objective.progress / Math.max(1, objective.target)) * 100))
              return (
                <li key={objective.id} className={objective.completed ? 'is-complete' : ''}>
                  <div><strong>{objective.title}</strong><small>{objective.detail}</small></div>
                  <span>{Math.round(objective.progress)}/{objective.target}</span>
                  <progress value={percentage} max={100} aria-label={`${objective.title}: ${percentage}%`} />
                </li>
              )
            })}
          </ol>
        </section>

        {simulation.pendingCouncil ? (
          <section className="council-decision" aria-labelledby="council-heading">
            <span className="eyebrow">Quyết định nhỏ</span>
            <h3 id="council-heading">{simulation.pendingCouncil.title}</h3>
            <p>{simulation.pendingCouncil.detail}</p>
            <div className="council-actions">
              <button type="button" onClick={() => onCouncilDecision('stockpile')}>Niêm phong kho <small>−lương thực, −hạnh phúc, +phục hồi</small></button>
              <button type="button" onClick={() => onCouncilDecision('raise-ward')}>Gia cố <small>−lương thực, −hạnh phúc, +phòng vệ</small></button>
            </div>
          </section>
        ) : null}

        {/* ── Time Controls (redesigned) ── */}
        <div className="time-controls" role="group" aria-label="Điều khiển thời gian">
          <button
            type="button"
            className={`pause-button ${simulation.paused ? 'is-paused' : ''}`}
            onClick={onPauseToggle}
            aria-pressed={simulation.paused}
            aria-keyshortcuts="Space"
          >
            {simulation.paused ? '▶ Tiếp tục' : '⏸ Tạm dừng'}
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
                {SPEED_LABELS[speed]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="panel-surface lens-panel" aria-labelledby="lens-heading">
        <div className="panel-heading compact-heading">
          <div>
            <span className="eyebrow">Quan sát thế giới</span>
            <h2 id="lens-heading">Góc nhìn câu chuyện</h2>
          </div>
          <button type="button" className="icon-button" onClick={onPhoto} aria-label="Chụp ảnh thế giới PNG">📷</button>
        </div>
        {selected ? (
          <div className="tile-inspector-card">
            <div className="tic-row">
              <span className="tic-label">📍 Vị trí</span>
              <strong>Ô {selected.x + 1}, {selected.z + 1}</strong>
            </div>
            <div className="tic-row">
              <span className="tic-label">🗺️ Biome</span>
              <strong>{selected.biome}</strong>
            </div>
            <div className="tic-row">
              <span className="tic-label">🌱 Đất</span>
              <strong>{selected.soil}</strong>
            </div>
            <div className="tic-row">
              <span className="tic-label">💎 Tài nguyên</span>
              <strong>{Math.round(selected.resources * 100)}%</strong>
            </div>
          </div>
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

      <ChroniclePanel world={world} simulation={simulation} />

      <section className="panel-surface timeline-panel" aria-labelledby="timeline-heading">
        <div className="panel-heading compact-heading">
          <div>
            <span className="eyebrow">Biên niên sử</span>
            <h2 id="timeline-heading">Nhịp {simulation.tick}</h2>
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
    </div>
  )
}
