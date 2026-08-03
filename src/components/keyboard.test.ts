import { describe, expect, it } from 'vitest'
import { isInteractiveShortcutTarget } from './keyboard'

describe('global keyboard shortcut guard', () => {
  it('does not steal text entry from native controls or contenteditable regions', () => {
    expect(isInteractiveShortcutTarget({ tagName: 'INPUT' })).toBe(true)
    expect(isInteractiveShortcutTarget({ tagName: 'TEXTAREA' })).toBe(true)
    expect(isInteractiveShortcutTarget({ isContentEditable: true })).toBe(true)
    expect(isInteractiveShortcutTarget({ tagName: 'DIV' })).toBe(false)
  })
})
