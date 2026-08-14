import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'

interface TutorialOverlayProps {
  open: boolean
  onDismiss: () => void
}

const STEPS = [
  {
    eyebrow: 'Chào mừng đến Aetheria',
    title: 'Tạo thế giới sống',
    detail: 'Chọn một quyền năng ở thanh dưới, rồi nhấp vào đất. Kéo để xoay bản đồ và cuộn để thu phóng.',
  },
  {
    eyebrow: 'Nhìn phản hồi',
    title: 'Mỗi quyền năng để lại dấu vết',
    detail: 'Rừng, nước, độ phì và cư dân sẽ thay đổi tài nguyên, thức ăn, hạnh phúc và cách làng hoạt động.',
  },
  {
    eyebrow: 'Làm chủ nhịp độ',
    title: 'Mở Biên niên sử để tạm dừng',
    detail: 'Dùng phím Space để dừng/tiếp tục. Trong cài đặt đồ họa, bạn có thể chọn chuyển động đầy đủ hoặc giảm chuyển động.',
  },
] as const

export function TutorialOverlay({ open, onDismiss }: TutorialOverlayProps): JSX.Element | null {
  const [step, setStep] = useState(0)
  const continueRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => continueRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [open])

  const dismiss = (): void => {
    setStep(0)
    onDismiss()
  }

  if (!open) return null
  const current = STEPS[step]
  if (!current) return null
  const last = step === STEPS.length - 1

  return (
    <div className="tutorial-overlay" role="presentation">
      <section className="tutorial-card" role="dialog" aria-modal="true" aria-labelledby="tutorial-title" aria-describedby="tutorial-detail">
        <span className="eyebrow">{current.eyebrow}</span>
        <p className="tutorial-progress" aria-label={`Bước ${step + 1} trên ${STEPS.length}`}>{step + 1} / {STEPS.length}</p>
        <h2 id="tutorial-title">{current.title}</h2>
        <p id="tutorial-detail">{current.detail}</p>
        <div className="tutorial-actions">
          <button type="button" className="secondary-button" onClick={dismiss}>Bỏ qua hướng dẫn</button>
          <button
            ref={continueRef}
            type="button"
            className="primary-button"
            onClick={() => last ? dismiss() : setStep((value) => value + 1)}
          >
            {last ? 'Bắt đầu tạo thế giới' : 'Tiếp tục'}
          </button>
        </div>
      </section>
    </div>
  )
}
