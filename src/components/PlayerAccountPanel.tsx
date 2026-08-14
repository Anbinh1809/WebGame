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
    <section className={`player-account-modern ${className || ''}`} aria-labelledby={headingId}>
      {/* Title */}
      <div className="section-title-box">
        <span className="section-icon">👤</span>
        <div>
          <h2 id={headingId} className="section-title">Hồ Sơ Người Chơi</h2>
          <p className="section-subtitle">Lưu danh hiệu và tiến trình sáng thế cục bộ</p>
        </div>
      </div>

      {session.status === 'authenticated' ? (
        <div className="settings-card">
          <div className="card-header">
            <span className="card-icon">👑</span>
            <span className="card-title">Tài Khoản Đang Hoạt Động</span>
          </div>
          <div className="card-body">
            <div className="profile-active-card">
              <div className="profile-badge-avatar">🛡️</div>
              <div className="profile-info-details">
                <span className="profile-name-text">{session.player.displayName}</span>
                <span className="badge-pill badge-era">Đấng Sáng Thế Hợp Lệ</span>
              </div>
            </div>
            <button type="button" className="game-btn game-btn-danger full-width-btn" onClick={handleSignOut}>
              🚪 Đăng xuất hồ sơ này
            </button>
          </div>
        </div>
      ) : (
        <div className="settings-card">
          <div className="card-header">
            <div className="segmented-switch full-width">
              <button
                type="button"
                className={`segmented-btn ${mode === 'register' ? 'active' : ''}`}
                onClick={() => changeMode('register')}
              >
                ✨ Đăng ký
              </button>
              <button
                type="button"
                className={`segmented-btn ${mode === 'sign-in' ? 'active' : ''}`}
                onClick={() => changeMode('sign-in')}
              >
                🔑 Đăng nhập
              </button>
            </div>
          </div>

          <div className="card-body">
            {savedProfiles.length > 0 && mode === 'sign-in' ? (
              <div className="quick-accounts-box">
                <span className="field-subtext">Tài khoản đã lưu trên máy:</span>
                <div className="quick-accounts-chips">
                  {savedProfiles.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      className="quick-chip-btn"
                      onClick={() => handleSelectQuickAccount(acc.displayName)}
                    >
                      👤 {acc.displayName}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <form className="player-form-body" onSubmit={handleSubmit}>
              <div className="field-group">
                <label className="field-label" htmlFor={nameId}>
                  <span>Tên người chơi</span>
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
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor={passwordId}>
                  <span>Mật khẩu (Tối thiểu 10 ký tự)</span>
                  <input
                    id={passwordId}
                    className="game-text-input"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    minLength={mode === 'register' ? 10 : undefined}
                    maxLength={128}
                    placeholder="••••••••••"
                    required
                  />
                </label>
              </div>

              {mode === 'register' ? (
                <div className="field-group">
                  <label className="field-label" htmlFor={confirmationId}>
                    <span>Xác nhận mật khẩu</span>
                    <input
                      id={confirmationId}
                      className="game-text-input"
                      type="password"
                      value={confirmation}
                      onChange={(event) => setConfirmation(event.target.value)}
                      autoComplete="new-password"
                      minLength={10}
                      maxLength={128}
                      placeholder="••••••••••"
                      required
                    />
                  </label>
                </div>
              ) : null}

              {feedback && (
                <div className="feedback-banner" role="status">
                  {feedback}
                </div>
              )}

              <button type="submit" className="game-btn game-btn-primary full-width-btn" disabled={isSubmitting}>
                {isSubmitting ? 'Đang xử lý…' : mode === 'register' ? '✦ Tạo hồ sơ cục bộ' : '▶ Đăng nhập'}
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
