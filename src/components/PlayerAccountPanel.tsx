import { useId, useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { usePlayerAuth } from '../auth/usePlayerAuth'
import { listSavedAccountProfiles } from '../auth/localPlayerAuth'

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
  const [savedProfiles, setSavedProfiles] = useState<Array<{ id: string; displayName: string }>>(() => {
    try {
      return listSavedAccountProfiles()
    } catch {
      return []
    }
  })
  
  const identifier = useId()
  const headingId = `${identifier}-heading`
  const nameId = `${identifier}-name`
  const passwordId = `${identifier}-password`
  const confirmationId = `${identifier}-confirmation`
  const privacyId = `${identifier}-privacy`
  const panelClassName = ['player-account-panel', 'panel-surface', className].filter(Boolean).join(' ')

  const refreshSavedProfiles = (): void => {
    try {
      setSavedProfiles(listSavedAccountProfiles())
    } catch {
      setSavedProfiles([])
    }
  }

  const changeMode = (nextMode: AccountMode): void => {
    setMode(nextMode)
    setPassword('')
    setConfirmation('')
    setFeedback('')
    refreshSavedProfiles()
  }

  const handleSelectQuickAccount = (name: string): void => {
    setDisplayName(name)
    setMode('sign-in')
    setFeedback(`Đã chọn tài khoản "${name}". Hãy nhập mật khẩu để đăng nhập.`)
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
        refreshSavedProfiles()
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
    refreshSavedProfiles()
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
          <div className="profile-active-card">
            <span className="profile-avatar-crest">👑</span>
            <div>
              <p className="player-account-copy">Đang chơi với <strong>{session.player.displayName}</strong>.</p>
              <span className="badge-pill badge-era">Đấng Sáng Thế Hợp Lệ</span>
            </div>
          </div>
          <button type="button" className="game-btn game-btn-danger" onClick={handleSignOut}>
            Đăng xuất hồ sơ này
          </button>
        </div>
      ) : null}

      {session.status === 'anonymous' ? (
        <>
          <p className="player-account-copy">Tạo hồ sơ để giữ tên người chơi trong phiên trình duyệt này.</p>
          
          {savedProfiles.length > 0 ? (
            <div className="quick-accounts-section">
              <span className="eyebrow">Tài khoản đã có trên máy:</span>
              <div className="quick-accounts-list">
                {savedProfiles.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    className="quick-account-chip"
                    onClick={() => handleSelectQuickAccount(acc.displayName)}
                  >
                    👤 {acc.displayName}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="player-account-switch" role="group" aria-label="Chọn thao tác hồ sơ">
            <button
              type="button"
              className={`game-btn ${mode === 'register' ? 'game-btn-primary' : 'game-btn-secondary'}`}
              aria-pressed={mode === 'register'}
              onClick={() => changeMode('register')}
            >
              Đăng ký
            </button>
            <button
              type="button"
              className={`game-btn ${mode === 'sign-in' ? 'game-btn-primary' : 'game-btn-secondary'}`}
              aria-pressed={mode === 'sign-in'}
              onClick={() => changeMode('sign-in')}
            >
              Đăng nhập
            </button>
          </div>

          <form className="player-account-form" onSubmit={handleSubmit}>
            <label className="field-label" htmlFor={nameId}>
              Tên người chơi
              <input
                id={nameId}
                className="game-text-input"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                autoComplete="username"
                maxLength={32}
                placeholder="VD: Thần Ánh Sáng..."
                required
              />
            </label>
            <label className="field-label" htmlFor={passwordId}>
              Mật khẩu (Tối thiểu 10 ký tự)
              <input
                id={passwordId}
                className="game-text-input"
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
                  className="game-text-input"
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
            <button type="submit" className="game-btn game-btn-primary full-width" disabled={isSubmitting}>
              {isSubmitting ? 'Đang xử lý…' : mode === 'register' ? '✦ Tạo hồ sơ cục bộ' : '▶ Đăng nhập'}
            </button>
          </form>
        </>
      ) : null}

      <p id={privacyId} className="player-account-privacy">
        Mật khẩu không được lưu nguyên văn; trình duyệt chỉ lưu mã kiểm tra có muối trên thiết bị này. Hồ sơ không đồng bộ save, không gửi dữ liệu lên mạng và không mở gói 8K trả phí.
      </p>
      <p className="player-account-feedback" role="status" aria-live="polite" aria-atomic="true">{feedback}</p>
    </section>
  )
}
