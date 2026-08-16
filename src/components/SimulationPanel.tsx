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
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Mô phỏng theo nhịp cố định</span>
            <h2 id="simulation-heading">{village?.name ?? 'Thung lũng trống'}</h2>
          </div>
          <span className={`weather-dot ${simulation.activeStorm ? 'is-stormy' : ''}`}>
            {simulation.activeStorm ? 'Mưa lớn' : 'Trời quang'}
          </span>
        </div>
        {village ? (
          <div className="stat-grid" role="group" aria-label="Chỉ số của làng">
            <div><span>Dân số</span><strong>{village.population}</strong></div>
            <div><span>Lương thực</span><strong>{Math.round(village.food)}</strong></div>
            <div><span>Hạnh phúc</span><strong>{Math.round(village.happiness)}%</strong></div>
            <div><span>Thời đại</span><strong>{villageEraLabel(village.era)}</strong></div>
            <div><span>Kỷ nguyên</span><strong className="text-cyan">{village.epoch ?? 'Kỷ Tiền Cambri (Đơn Bào)'}</strong></div>
            <div><span>Điểm DNA</span><strong className="text-emerald">+{Math.round(village.dnaPoints ?? 15)} DNA</strong></div>
          </div>
        ) : <p className="muted-copy">Chưa có cộng đồng nào trên bản đồ này.</p>}
        {village ? (
          <div className="council-stats" role="group" aria-label="Nghiên cứu, phòng vệ và lãnh thổ">
            <span>Nghiên cứu <strong>{Math.round(village.research)}</strong><small>Tăng thu hoạch</small></span>
            <span>Sinh khối <strong>{Math.round(village.biomass ?? 30)}</strong><small>Sức sống hệ sinh thái</small></span>
            <span>Đa dạng <strong>{village.biodiversity ?? 65}%</strong><small>Hệ động thực vật</small></span>
            <span>Phục hồi <strong>{Math.round(village.resilience)}%</strong><small>Không bị kẹt sau bão</small></span>
          </div>
        ) : null}
        <p className="decision-line">{village?.lastDecision ?? 'Chờ một câu chuyện bắt đầu.'}</p>

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
                    <span>{unlocked ? 'Đã rèn' : current ? 'Kế tiếp' : 'Khoá'}</span>
                    <small>{tool.benefit}</small>
                  </li>
                )
              })}
            </ol>
            {nextTool ? (
              <div className="craft-action">
                <button type="button" onClick={onDevelopVillageTool} disabled={!canDevelopTool}>
                  Rèn {nextTool.label}
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

        <div className="time-controls" role="group" aria-label="Điều khiển thời gian">
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
            <span className="eyebrow">Quan sát thế giới</span>
            <h2 id="lens-heading">Góc nhìn câu chuyện</h2>
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
