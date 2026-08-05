import { useMemo, useState } from 'react'
import type { JSX } from 'react'
import { createChronicleDigest, createProceduralChronicle } from '../game/chronicle'
import type { SimulationState } from '../simulation/types'
import type { World } from '../world/types'

interface ChroniclePanelProps {
  world: World
  simulation: SimulationState
}

export function ChroniclePanel({ world, simulation }: ChroniclePanelProps): JSX.Element {
  const digest = useMemo(() => createChronicleDigest(world, simulation), [simulation, world])
  const chronicle = useMemo(() => createProceduralChronicle(digest), [digest])
  const [generatedTick, setGeneratedTick] = useState<number | undefined>()

  return (
    <section className="panel-surface chronicle-panel" aria-labelledby="chronicle-heading">
      <div className="panel-heading compact-heading">
        <div>
          <span className="eyebrow">Ký ức theo seed</span>
          <h2 id="chronicle-heading">Biên Niên Sử Thế Giới</h2>
        </div>
      </div>

      <div className="chronicle-status" role="status" aria-live="polite" aria-atomic="true">
        <strong>Biên niên sử procedural</strong>
        <p>Dựa trên seed, tick, chỉ số làng và các dấu ấn thần hiện tại; không thay đổi gameplay.</p>
      </div>

      <div className="chronicle-actions">
        <button type="button" className="primary-button" onClick={() => setGeneratedTick(digest.tick)}>
          Tạo Biên Niên Sử
        </button>
      </div>

      <article className={`chronicle-result chronicle-${chronicle.tone}`} aria-label="Biên niên sử procedural">
        <span className="eyebrow">{chronicle.legend}</span>
        <p>{chronicle.chronicle}</p>
        <ul>
          {chronicle.causalInsights.map((insight) => <li key={insight}>{insight}</li>)}
        </ul>
        {chronicle.godOpportunity ? <small>Cơ hội thần linh: {worldObjectiveLabel(chronicle.godOpportunity)}</small> : null}
        {generatedTick === digest.tick ? <small className="chronicle-generated">Đã tạo lại từ tick {digest.tick}.</small> : null}
      </article>
    </section>
  )
}

function worldObjectiveLabel(id: 'rooted-grove' | 'full-granary' | 'stormward'): string {
  if (id === 'rooted-grove') return 'Nuôi dưỡng rừng gốc'
  if (id === 'full-granary') return 'Lấp đầy kho lương'
  return 'Củng cố lá chắn bão'
}
