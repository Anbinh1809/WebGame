import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TutorialOverlay } from './TutorialOverlay'

describe('tutorial overlay', () => {
  it('offers an accessible, dismissible first-play explanation', () => {
    const markup = renderToStaticMarkup(<TutorialOverlay open onDismiss={() => undefined} />)
    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('Bỏ qua hướng dẫn')
    expect(markup).toContain('Tạo thế giới sống')
  })
})
