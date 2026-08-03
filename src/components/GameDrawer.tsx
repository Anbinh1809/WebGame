import { useEffect, useRef } from 'react'
import type { PropsWithChildren, JSX } from 'react'

interface GameDrawerProps extends PropsWithChildren {
  id: string
  label: string
  side: 'left' | 'right'
  onClose: () => void
}

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  ))
}

export function GameDrawer({ id, label, side, onClose, children }: GameDrawerProps): JSX.Element {
  const drawerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const drawer = drawerRef.current
    if (!drawer) return undefined
    const first = focusableElements(drawer)[0]
    first?.focus()

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const elements = focusableElements(drawer)
      if (elements.length === 0) return
      const firstElement = elements[0]
      const lastElement = elements.at(-1)
      if (!firstElement || !lastElement) return
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    drawer.addEventListener('keydown', handleKeyDown)
    return () => drawer.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <aside ref={drawerRef} id={id} className={`game-drawer game-drawer-${side}`} aria-label={label} tabIndex={-1}>
      <div className="drawer-topline">
        <span>{label}</span>
        <button type="button" className="icon-button" onClick={onClose} aria-label={`Đóng ${label}`}>×</button>
      </div>
      {children}
    </aside>
  )
}
