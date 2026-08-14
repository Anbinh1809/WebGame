import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ToastContainer } from './ToastContainer'
import { gameToast } from '../runtime/toast'

describe('ToastContainer component', () => {
  it('renders active toasts with accessibility attributes', () => {
    gameToast.clear()
    gameToast.success('Cập nhật bản đồ thành công')
    const markup = renderToStaticMarkup(<ToastContainer />)
    expect(markup).toContain('game-toast-container')
    expect(markup).toContain('Cập nhật bản đồ thành công')
    expect(markup).toContain('role="status"')
  })
})
