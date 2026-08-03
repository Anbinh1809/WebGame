import type { JSX } from 'react'

interface FullscreenButtonProps {
  active: boolean
  onToggle: () => void
}

export function FullscreenButton({ active, onToggle }: FullscreenButtonProps): JSX.Element {
  return (
    <button type="button" className="icon-button" onClick={onToggle} aria-pressed={active} aria-label={active ? 'Thoát toàn màn hình' : 'Bật toàn màn hình'}>
      {active ? '↙' : '⛶'}
    </button>
  )
}
