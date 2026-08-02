import type { JSX } from 'react'
import type { ToolId } from '../world/types'

interface ToolDockProps {
  activeTool: ToolId
  onToolChange: (tool: ToolId) => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
}

const TOOL_OPTIONS: Array<{ id: ToolId; key: string; symbol: string; label: string; hint: string }> = [
  { id: 'raise', key: '1', symbol: '↟', label: 'Nâng đất', hint: 'Đẩy cao một ô địa hình' },
  { id: 'lower', key: '2', symbol: '↡', label: 'Hạ đất', hint: 'Hạ thấp một ô địa hình' },
  { id: 'water', key: '3', symbol: '≈', label: 'Gọi nước', hint: 'Mở một vũng nước mới' },
  { id: 'forest', key: '4', symbol: '♣', label: 'Gieo rừng', hint: 'Gieo cây ở vùng đất phù hợp' },
  { id: 'fertile', key: '5', symbol: '✦', label: 'Làm màu mỡ', hint: 'Tăng ẩm và tài nguyên' },
  { id: 'barren', key: '6', symbol: '◌', label: 'Làm cằn cỗi', hint: 'Rút dinh dưỡng khỏi đất' },
  { id: 'settler', key: '7', symbol: '●', label: 'Thả cư dân', hint: 'Mời người lữ hành vào làng' },
  { id: 'storm', key: '8', symbol: 'ϟ', label: 'Mưa lớn', hint: 'Gọi một đợt thiên tai' },
]

export function ToolDock({ activeTool, onToolChange, onUndo, onRedo, canUndo, canRedo }: ToolDockProps): JSX.Element {
  return (
    <section className="tool-dock panel-surface" aria-labelledby="tools-heading">
      <div className="panel-heading compact-heading">
        <div>
          <span className="eyebrow">Quyền năng</span>
          <h2 id="tools-heading">Nắn thế giới</h2>
        </div>
        <div className="history-actions" aria-label="Lịch sử thao tác">
          <button type="button" className="icon-button" onClick={onUndo} disabled={!canUndo} aria-label="Hoàn tác thao tác gần nhất">
            ↶
          </button>
          <button type="button" className="icon-button" onClick={onRedo} disabled={!canRedo} aria-label="Làm lại thao tác vừa hoàn tác">
            ↷
          </button>
        </div>
      </div>
      <div className="tool-grid" role="toolbar" aria-label="Các quyền năng trên bản đồ">
        {TOOL_OPTIONS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            className={`tool-button ${activeTool === tool.id ? 'is-active' : ''}`}
            onClick={() => onToolChange(tool.id)}
            aria-pressed={activeTool === tool.id}
            aria-label={`${tool.label}. Phím tắt ${tool.key}. ${tool.hint}`}
          >
            <span className="tool-symbol" aria-hidden="true">{tool.symbol}</span>
            <span>{tool.label}</span>
            <kbd>{tool.key}</kbd>
          </button>
        ))}
      </div>
    </section>
  )
}
