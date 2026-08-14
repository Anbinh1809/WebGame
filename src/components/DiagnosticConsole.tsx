import { useEffect, useMemo, useState } from 'react'
import type { JSX } from 'react'
import { gameLogger } from '../runtime/logger'
import type { LogEntry, LogLevel } from '../runtime/logger'

interface DiagnosticConsoleProps {
  isOpen: boolean
  onClose: () => void
}

export function DiagnosticConsole({ isOpen, onClose }: DiagnosticConsoleProps): JSX.Element | null {
  const [logs, setLogs] = useState<readonly LogEntry[]>(() => gameLogger.getEntries())
  const [filterLevel, setFilterLevel] = useState<LogLevel | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (!isOpen) return undefined

    const unsubscribe = gameLogger.subscribe(() => {
      setLogs([...gameLogger.getEntries()])
    })

    return unsubscribe
  }, [isOpen])

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterLevel !== 'all' && log.level !== filterLevel) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return log.message.toLowerCase().includes(q) || log.category.toLowerCase().includes(q)
      }
      return true
    })
  }, [logs, filterLevel, searchQuery])

  const handleExport = (): void => {
    const report = gameLogger.exportDiagnosticReport()
    const blob = new Blob([report], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `aetheria-diagnostic-${Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleClear = (): void => {
    gameLogger.clear()
    setLogs([])
  }

  if (!isOpen) return null

  return (
    <div className="diagnostic-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="diag-title">
      <div className="diagnostic-modal-backdrop" onClick={onClose} />
      <div className="diagnostic-console-window">
        <header className="diagnostic-console-header">
          <div className="diagnostic-title-group">
            <span className="diag-icon">🛠</span>
            <h2 id="diag-title" className="diagnostic-title">BẢNG ĐIỀU KHIỂN CHẨN ĐOÁN &amp; NHẬT KÝ LỖI (F2 / ~)</h2>
          </div>
          <button type="button" className="diag-close-btn" onClick={onClose} aria-label="Đóng bảng chẩn đoán">
            ✕
          </button>
        </header>

        <div className="diagnostic-toolbar">
          <div className="diag-filters">
            {(['all', 'debug', 'info', 'warn', 'error'] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                className={`diag-filter-btn filter-${lvl} ${filterLevel === lvl ? 'active' : ''}`}
                onClick={() => setFilterLevel(lvl)}
              >
                {lvl.toUpperCase()}
              </button>
            ))}
          </div>

          <input
            type="text"
            className="diag-search-input"
            placeholder="Tìm theo nội dung, category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="diag-actions">
            <button type="button" className="game-btn game-btn-secondary btn-sm" onClick={handleExport}>
              📥 Xuất báo cáo JSON
            </button>
            <button type="button" className="game-btn game-btn-danger btn-sm" onClick={handleClear}>
              🗑 Xóa
            </button>
          </div>
        </div>

        <div className="diagnostic-log-list" tabIndex={0} role="log" aria-live="polite">
          {filteredLogs.length === 0 ? (
            <div className="diag-empty-state">
              <span>Không có nhật ký nào phù hợp với bộ lọc hiện tại.</span>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className={`diag-log-item log-level-${log.level}`}>
                <span className="log-time">{log.timestamp.slice(11, 19)}</span>
                <span className={`log-badge badge-${log.level}`}>{log.level.toUpperCase()}</span>
                <span className="log-category">[{log.category}]</span>
                <span className="log-msg">{log.message}</span>
                {log.details && (
                  <pre className="log-details">{JSON.stringify(log.details, null, 2)}</pre>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
