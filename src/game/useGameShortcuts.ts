import { useEffect } from 'react'
import { isInteractiveShortcutTarget } from '../components/keyboard'
import type { ToolId } from '../world/types'

interface UseGameShortcutsOptions {
  tutorialOpen: boolean
  openDrawer: 'left' | 'right' | null
  pauseMenuOpen: boolean
  isAvatarMode?: boolean
  onDismissTutorial: () => void
  onCloseDrawer: () => void
  onTogglePauseMenu: () => void
  onToggleFullscreen: () => void
  onPauseToggle: () => void
  onUndo: () => void
  onRedo: () => void
  onToolSelect: (tool: ToolId) => void
  onToggleDiagnosticConsole?: () => void
  onToggleAvatarMode?: () => void
  onToggleCivTree?: () => void
  onToggleRankedArena?: () => void
  onToggleEvolutionTree?: () => void
  onToggleSketchfabExplorer?: () => void
  onToggleArchipelago?: () => void
}

const TOOLS_BY_NUMBER: ToolId[] = [
  'raise',
  'lower',
  'water',
  'forest',
  'fertile',
  'barren',
  'settler',
  'storm',
]

export function useGameShortcuts({
  tutorialOpen,
  openDrawer,
  pauseMenuOpen,
  isAvatarMode = false,
  onDismissTutorial,
  onCloseDrawer,
  onTogglePauseMenu,
  onToggleFullscreen,
  onPauseToggle,
  onUndo,
  onRedo,
  onToolSelect,
  onToggleDiagnosticConsole,
  onToggleAvatarMode,
  onToggleCivTree,
  onToggleRankedArena,
  onToggleEvolutionTree,
  onToggleSketchfabExplorer,
  onToggleArchipelago,
}: UseGameShortcutsOptions): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      // Toggle Diagnostic Console on `F2` or `~` (Backquote)
      if (event.key === 'F2' || event.key === '`' || event.key === '~') {
        if (!isInteractiveShortcutTarget(event.target)) {
          event.preventDefault()
          onToggleDiagnosticConsole?.()
          return
        }
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        if (isAvatarMode && onToggleAvatarMode) {
          onToggleAvatarMode()
          return
        }
        if (tutorialOpen) {
          onDismissTutorial()
          return
        }
        if (openDrawer) {
          onCloseDrawer()
          return
        }
        onTogglePauseMenu()
        return
      }

      if (isInteractiveShortcutTarget(event.target)) return

      if (event.key === ' ' && !pauseMenuOpen && !isAvatarMode) {
        event.preventDefault()
        onPauseToggle()
        return
      }

      if (event.key.toLowerCase() === 'v' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        onToggleAvatarMode?.()
        return
      }

      if (event.key.toLowerCase() === 'e' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        onToggleEvolutionTree?.()
        return
      }

      if (event.key.toLowerCase() === 's' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        onToggleSketchfabExplorer?.()
        return
      }

      if (event.key.toLowerCase() === 'a' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        onToggleArchipelago?.()
        return
      }

      if (event.key.toLowerCase() === 'c' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        onToggleCivTree?.()
        return
      }

      if (event.key.toLowerCase() === 'r' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        onToggleRankedArena?.()
        return
      }

      if (event.key.toLowerCase() === 'f' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        onToggleFullscreen()
        return
      }

      if (event.key.toLowerCase() === 'z' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        if (event.shiftKey) onRedo()
        else onUndo()
        return
      }

      if (event.key.toLowerCase() === 'y' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        onRedo()
        return
      }

      const numeric = Number(event.key)
      if (numeric >= 1 && numeric <= TOOLS_BY_NUMBER.length) {
        const nextTool = TOOLS_BY_NUMBER[numeric - 1]
        if (nextTool) onToolSelect(nextTool)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    tutorialOpen,
    openDrawer,
    pauseMenuOpen,
    isAvatarMode,
    onDismissTutorial,
    onCloseDrawer,
    onTogglePauseMenu,
    onToggleFullscreen,
    onPauseToggle,
    onUndo,
    onRedo,
    onToolSelect,
    onToggleDiagnosticConsole,
    onToggleAvatarMode,
    onToggleCivTree,
    onToggleRankedArena,
    onToggleEvolutionTree,
    onToggleSketchfabExplorer,
    onToggleArchipelago,
  ])
}
