import type { JSX } from 'react'
import { IS_DESKTOP_EDITION } from '../runtime/edition'
import { appPath } from '../routes'

interface GamePauseMenuProps {
  isOpen: boolean
  onResume: () => void
  onQuickSave: () => void
  onOpenSaveManager?: () => void
  onOpenSettings: () => void
  onOpenWorldControls: () => void
  onOpenProfile: () => void
  onOpenTutorial: () => void
  onOpenDiagnostics?: () => void
  worldSeed: string
  tick: number
  villageName?: string | undefined
  population?: number
}

export function GamePauseMenu({
  isOpen,
  onResume,
  onQuickSave,
  onOpenSaveManager,
  onOpenSettings,
  onOpenWorldControls,
  onOpenProfile,
  onOpenTutorial,
  onOpenDiagnostics,
  worldSeed,
  tick,
  villageName = 'Làng Khởi Đầu',
  population = 0,
}: GamePauseMenuProps): JSX.Element | null {
  if (!isOpen) return null

  return (
    <div
      className="game-pause-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-menu-title"
    >
      <div className="game-pause-backdrop" onClick={onResume} />
      <div className="game-pause-modal">
        <div className="game-pause-header">
          <div className="game-pause-badge">TRÒ CHƠI ĐANG TẠM DỪNG</div>
          <h2 id="pause-menu-title" className="game-pause-title">AETHERIA</h2>
          <p className="game-pause-sub">
            Seed: <strong>{worldSeed}</strong> · Ngày: {Math.floor(tick / 6) + 1}
          </p>
          <div className="game-pause-status-chip">
            <span>{villageName}</span> · <span>{population} cư dân</span>
          </div>
        </div>

        <nav className="game-pause-actions" aria-label="Menu Tạm dừng">
          <button
            type="button"
            className="game-btn game-btn-primary"
            onClick={onResume}
            autoFocus
          >
            <span className="game-btn-icon">▶</span>
            <span className="game-btn-text">Tiếp tục chơi</span>
            <span className="game-btn-hint">[ESC / Space]</span>
          </button>

          <button
            type="button"
            className="game-btn game-btn-secondary"
            onClick={onQuickSave}
          >
            <span className="game-btn-icon">💾</span>
            <span className="game-btn-text">Lưu thế giới nhanh</span>
            <span className="game-btn-hint">[Quick Save]</span>
          </button>

          {onOpenSaveManager ? (
            <button
              type="button"
              className="game-btn game-btn-secondary"
              onClick={onOpenSaveManager}
            >
              <span className="game-btn-icon">🗂️</span>
              <span className="game-btn-text">Quản lý các bản lưu thế giới</span>
            </button>
          ) : null}

          <button
            type="button"
            className="game-btn game-btn-secondary"
            onClick={onOpenSettings}
          >
            <span className="game-btn-icon">⚙</span>
            <span className="game-btn-text">Cài đặt đồ họa & âm thanh</span>
          </button>

          <button
            type="button"
            className="game-btn game-btn-secondary"
            onClick={onOpenWorldControls}
          >
            <span className="game-btn-icon">🌍</span>
            <span className="game-btn-text">Cấu hình & Tái tạo thế giới</span>
          </button>

          <button
            type="button"
            className="game-btn game-btn-secondary"
            onClick={onOpenProfile}
          >
            <span className="game-btn-icon">👤</span>
            <span className="game-btn-text">Hồ sơ Đấng Sáng Tạo</span>
          </button>

          {onOpenDiagnostics ? (
            <button
              type="button"
              className="game-btn game-btn-secondary"
              onClick={onOpenDiagnostics}
            >
              <span className="game-btn-icon">🛠</span>
              <span className="game-btn-text">Nhật ký chẩn đoán & Telemetry</span>
              <span className="game-btn-hint">[F2 / ~]</span>
            </button>
          ) : null}

          <button
            type="button"
            className="game-btn game-btn-secondary"
            onClick={onOpenTutorial}
          >
            <span className="game-btn-icon">📖</span>
            <span className="game-btn-text">Hướng dẫn quyền năng</span>
          </button>

          <div className="game-pause-divider" />

          <a
            href={appPath('/')}
            className="game-btn game-btn-danger"
          >
            <span className="game-btn-icon">⏏</span>
            <span className="game-btn-text">Thoát về Màn hình chính</span>
            <span className="game-btn-hint">[Title Screen]</span>
          </a>
        </nav>

        <footer className="game-pause-footer">
          <p>
            {IS_DESKTOP_EDITION ? (
              <>Bản cài đặt Desktop (Mở khóa 2K/4K/8K) · Nhấn <strong>ESC</strong> để tiếp tục thế giới.</>
            ) : (
              <>Bản chơi thử Web Demo (1K) · <a href={appPath('/')} className="game-link">Xem bản Desktop 2K/4K/8K</a> · Nhấn <strong>ESC</strong> để đóng menu.</>
            )}
          </p>
        </footer>
      </div>
    </div>
  )
}
