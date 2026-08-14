import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DiagnosticConsole } from './DiagnosticConsole'

describe('DiagnosticConsole component', () => {
  it('renders modal dialog with filters and action buttons when open', () => {
    const markup = renderToStaticMarkup(<DiagnosticConsole isOpen={true} onClose={() => undefined} />)
    expect(markup).toContain('BẢNG ĐIỀU KHIỂN CHẨN ĐOÁN')
    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('Xuất báo cáo JSON')
  })

  it('renders null when closed', () => {
    const markup = renderToStaticMarkup(<DiagnosticConsole isOpen={false} onClose={() => undefined} />)
    expect(markup).toBe('')
  })
})
