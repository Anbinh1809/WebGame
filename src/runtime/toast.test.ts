import { describe, expect, it } from 'vitest'
import { gameToast } from './toast'

describe('GameToastService', () => {
  it('dispatches toasts and manages subscription lifecycle', () => {
    gameToast.clear()
    const id1 = gameToast.success('Thành công mỹ mãn!')
    const id2 = gameToast.error('Có lỗi xảy ra!')

    const current = gameToast.getToasts()
    expect(current.length).toBe(2)
    expect(current[0]?.id).toBe(id2)
    expect(current[1]?.id).toBe(id1)

    gameToast.dismiss(id1)
    expect(gameToast.getToasts().some((t) => t.id === id1)).toBe(false)
  })
})
