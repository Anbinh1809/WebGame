import { useSyncExternalStore } from 'react'
import type { JSX } from 'react'
import { gameToast } from '../runtime/toast'
import type { ToastItem, ToastType } from '../runtime/toast'

const TOAST_ICONS: Record<ToastType, string> = {
  info: 'ℹ️',
  success: '✨',
  warning: '⚠️',
  error: '❌',
}

function subscribe(callback: () => void): () => void {
  return gameToast.subscribe(() => callback())
}

function getSnapshot(): readonly ToastItem[] {
  return gameToast.getToasts()
}

export function ToastContainer(): JSX.Element | null {
  const toasts = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  if (toasts.length === 0) return null

  return (
    <aside className="game-toast-container" aria-live="polite" aria-label="Thông báo trò chơi">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`game-toast-pill toast-${toast.type}`}
          role={toast.type === 'error' ? 'alert' : 'status'}
        >
          <span className="toast-icon">{TOAST_ICONS[toast.type]}</span>
          <span className="toast-msg">{toast.message}</span>
          <button
            type="button"
            className="toast-dismiss-btn"
            onClick={() => gameToast.dismiss(toast.id)}
            aria-label="Đóng thông báo"
          >
            ✕
          </button>
        </div>
      ))}
    </aside>
  )
}
