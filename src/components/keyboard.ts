/** Returns true when a global game shortcut would steal ordinary text entry. */
export function isInteractiveShortcutTarget(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false
  const element = target as { tagName?: unknown; isContentEditable?: unknown }
  if (element.isContentEditable === true) return true
  if (typeof element.tagName !== 'string') return false
  return ['input', 'select', 'textarea', 'button', 'a'].includes(element.tagName.toLowerCase())
}
