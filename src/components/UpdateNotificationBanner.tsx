import { useState, useEffect } from 'react'
import type { JSX } from 'react'
import { globalUpdateService } from '../runtime/updateService'
import type { VersionInfo } from '../runtime/updateService'

export function UpdateNotificationBanner(): JSX.Element | null {
  const [update, setUpdate] = useState<VersionInfo | null>(() => globalUpdateService.getPendingUpdate())
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    globalUpdateService.start()
    const unsubscribe = globalUpdateService.subscribe((info) => {
      setUpdate(info)
      setIsDismissed(false)
    })
    return () => {
      unsubscribe()
    }
  }, [])

  if (!update || isDismissed) return null

  return (
    <aside className="update-notification-banner" role="alert" aria-live="polite">
      <div className="update-banner-content">
        <span className="update-banner-icon" aria-hidden="true">🚀</span>
        <div className="update-banner-text">
          <strong>Đã có phiên bản mới v{update.version}!</strong>
          <p>{update.notes || 'Bản cập nhật tối ưu hiệu năng và sửa lỗi.'}</p>
        </div>
      </div>
      <div className="update-banner-actions">
        <button
          type="button"
          className="game-btn game-btn-primary btn-sm"
          onClick={() => globalUpdateService.applyUpdate()}
        >
          Cập nhật ngay
        </button>
        <button
          type="button"
          className="game-btn game-btn-secondary btn-sm"
          onClick={() => setIsDismissed(true)}
          title="Tự động cập nhật vào lần mở game sau"
        >
          Để sau
        </button>
      </div>
    </aside>
  )
}
