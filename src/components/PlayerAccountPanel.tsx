import { useId, useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { usePlayerAuth } from '../auth/usePlayerAuth'

type AccountMode = 'register' | 'sign-in'

interface PlayerAccountPanelProps {
  className?: string
}

export function PlayerAccountPanel({ className }: PlayerAccountPanelProps): JSX.Element {
  const { session, register, signIn, signOut } = usePlayerAuth()
  const [mode, setMode] = useState<AccountMode>('register')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const identifier = useId()
  const headingId = `${identifier}-heading`
  const nameId = `${identifier}-name`
  const passwordId = `${identifier}-password`
  const confirmationId = `${identifier}-confirmation`
  const privacyId = `${identifier}-privacy`
  const panelClassName = ['player-account-panel', 'panel-surface', className].filter(Boolean).join(' ')

  const changeMode = (nextMode: AccountMode): void => {
    setMode(nextMode)
    setPassword('')
    setConfirmation('')
    setFeedback('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (isSubmitting) return
    if (mode === 'register' && password !== confirmation) {
      setFeedback('Hai lần nhập mật khẩu chưa khớp.')
      return
    }

    setIsSubmitting(true)
    try {
      const result = mode === 'register'
        ? await register({ displayName, password })
        : await signIn({ displayName, password })
      if (result.ok) {
        setPassword('')
        setConfirmation('')
        setFeedback(`Đã mở hồ sơ cục bộ cho ${result.player.displayName}.`)
      } else {
        setFeedback(result.message)
      }
    } catch {
      setFeedback('Không thể hoàn tất thao tác hồ sơ cục bộ. Hãy thử lại.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignOut = (): void => {
    const result = signOut()
    setFeedback(result.ok ? 'Đã đăng xuất khỏi hồ sơ cục bộ trên thiết bị này.' : result.message)
  }

  return (
    <section className={panelClassName} aria-labelledby={headingId}>
      <div className="panel-heading compact-heading">
        <div>
          <span className="eyebrow">Hồ sơ tùy chọn</span>
          <h2 id={headingId}>Người chơi</h2>
        </div>
      </div>

      {session.status === 'unavailable' ? (
        <p className="player-account-copy" role="status">{session.message} Game vẫn chơi được không cần đăng nhập.</p>
      ) : null}

      {session.status === 'authenticated' ? (
        <div className="player-account-signed-in">
          <p className="player-account-copy">Đang chơi với <strong>{session.player.displayName}</strong>.</p>
          <button type="button" className="secondary-button" onClick={handleSignOut}>Đăng xuất hồ sơ này</button>
        </div>
      ) : null}

      {session.status === 'anonymous' ? (
        <>
          <p className="player-account-copy">Tạo hồ sơ để giữ tên người chơi trong phiên trình duyệt này.</p>
          <div className="player-account-switch" role="group" aria-label="Chọn thao tác hồ sơ">
            <button type="button" className="secondary-button" aria-pressed={mode === 'register'} onClick={() => changeMode('register')}>Đăng ký</button>
            <button type="button" className="secondary-button" aria-pressed={mode === 'sign-in'} onClick={() => changeMode('sign-in')}>Đăng nhập</button>
          </div>
          <form className="player-account-form" onSubmit={handleSubmit}>
            <label className="field-label" htmlFor={nameId}>
              Tên người chơi
              <input
                id={nameId}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                autoComplete="username"
                maxLength={32}
                required
              />
            </label>
            <label className="field-label" htmlFor={passwordId}>
              Mật khẩu
              <input
                id={passwordId}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                minLength={mode === 'register' ? 10 : undefined}
                maxLength={128}
                required
              />
            </label>
            {mode === 'register' ? (
              <label className="field-label" htmlFor={confirmationId}>
                Nhập lại mật khẩu
                <input
                  id={confirmationId}
                  type="password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={128}
                  required
                />
              </label>
            ) : null}
            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? 'Đang xử lý…' : mode === 'register' ? 'Tạo hồ sơ cục bộ' : 'Đăng nhập'}
            </button>
          </form>
        </>
      ) : null}

      <p id={privacyId} className="player-account-privacy">Mật khẩu không được lưu nguyên văn; trình duyệt chỉ lưu mã kiểm tra có muối trên thiết bị này. Hồ sơ không đồng bộ save, không gửi dữ liệu lên mạng và không mở gói 8K trả phí.</p>
      <p className="player-account-feedback" role="status" aria-live="polite" aria-atomic="true">{feedback}</p>
    </section>
  )
}
