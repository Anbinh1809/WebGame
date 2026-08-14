/**
 * Aetheria High-Performance Game Toast & Notification Dispatcher.
 */
export type ToastType = 'info' | 'success' | 'warning' | 'error'

export interface ToastItem {
  id: string
  message: string
  type: ToastType
  durationMs: number
  createdAt: number
}

export type ToastListener = (toasts: ToastItem[]) => void

class GameToastService {
  private toasts: ToastItem[] = []
  private listeners = new Set<ToastListener>()
  private counter = 0

  public show(message: string, type: ToastType = 'info', durationMs = 4200): string {
    this.counter += 1
    const id = `toast-${Date.now()}-${this.counter}`
    const item: ToastItem = {
      id,
      message,
      type,
      durationMs,
      createdAt: Date.now(),
    }

    // Keep max 5 active toasts on screen
    this.toasts = [item, ...this.toasts].slice(0, 5)
    this.notify()

    if (durationMs > 0) {
      setTimeout(() => {
        this.dismiss(id)
      }, durationMs)
    }

    return id
  }

  public success(message: string, durationMs?: number): string {
    return this.show(message, 'success', durationMs)
  }

  public info(message: string, durationMs?: number): string {
    return this.show(message, 'info', durationMs)
  }

  public warn(message: string, durationMs?: number): string {
    return this.show(message, 'warning', durationMs)
  }

  public error(message: string, durationMs?: number): string {
    return this.show(message, 'error', durationMs)
  }

  public dismiss(id: string): void {
    this.toasts = this.toasts.filter((t) => t.id !== id)
    this.notify()
  }

  public clear(): void {
    this.toasts = []
    this.notify()
  }

  public getToasts(): readonly ToastItem[] {
    return this.toasts
  }

  public subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener)
    listener(this.toasts)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.toasts)
      } catch {
        // Safe dispatch
      }
    }
  }
}

export const gameToast = new GameToastService()
