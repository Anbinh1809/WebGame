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
          <h2 id="chronicle-heading">Biên niên sử thế giới</h2>
        </div>
      </div>

      <div className="chronicle-status" role="status" aria-live="polite" aria-atomic="true">
        <strong>Biên niên sử theo quy tắc</strong>
        <p>Dựa trên seed, nhịp mô phỏng, chỉ số làng và những dấu ấn hiện tại của người chơi; không thay đổi mô phỏng.</p>
      </div>

      <div className="chronicle-actions">
        <button type="button" className="primary-button" onClick={() => setGeneratedTick(digest.tick)}>
          Tạo biên niên sử
        </button>
      </div>

      <article className={`chronicle-result chronicle-${chronicle.tone}`} aria-label="Biên niên sử theo quy tắc">
        <span className="eyebrow">{chronicle.legend}</span>
        <p>{chronicle.chronicle}</p>
        <ul>
          {chronicle.causalInsights.map((insight) => <li key={insight}>{insight}</li>)}
        </ul>
        {chronicle.godOpportunity ? <small>Cơ hội thần linh: {worldObjectiveLabel(chronicle.godOpportunity)}</small> : null}
        {generatedTick === digest.tick ? <small className="chronicle-generated">Đã tạo lại ở nhịp {digest.tick}.</small> : null}
      </article>
    </section>
  )
}

function worldObjectiveLabel(id: 'rooted-grove' | 'full-granary' | 'stormward'): string {
  if (id === 'rooted-grove') return 'Nuôi dưỡng rừng gốc'
  if (id === 'full-granary') return 'Lấp đầy kho lương'
  return 'Củng cố lá chắn bão'
}
