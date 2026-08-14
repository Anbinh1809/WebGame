import React from 'react'
import type { AvatarCameraPerspective } from '../renderer/AvatarController'

interface AvatarHudOverlayProps {
  perspective: AvatarCameraPerspective
  stamina: number
  maxStamina: number
  onTogglePerspective: () => void
  onExitAvatar: () => void
}

export const AvatarHudOverlay: React.FC<AvatarHudOverlayProps> = ({
  perspective,
  stamina,
  maxStamina,
  onTogglePerspective,
  onExitAvatar,
}) => {
  const staminaPercent = Math.max(0, Math.min(100, (stamina / maxStamina) * 100))

  return (
    <div className="avatar-hud-overlay" role="region" aria-label="Bảng điều khiển Hóa thân Thần linh">
      <div className="avatar-header">
        <div className="avatar-badge">
          <span className="avatar-icon">👑</span>
          <div className="avatar-title-group">
            <span className="avatar-eyebrow">Trạng Thái Hạ Phàm</span>
            <strong className="avatar-title">Hóa Thân Sáng Thế</strong>
          </div>
        </div>

        <div className="avatar-actions">
          <button
            type="button"
            className="avatar-btn perspective-btn"
            onClick={onTogglePerspective}
            title="Đổi góc nhìn (Phím V)"
          >
            <span>{perspective === 'third-person' ? '🎥 Góc Nhìn Thứ 3' : '👁️ Góc Nhìn Thứ 1'}</span>
            <kbd>V</kbd>
          </button>
          <button
            type="button"
            className="avatar-btn exit-btn"
            onClick={onExitAvatar}
            title="Trở lại góc nhìn Thượng đế"
          >
            <span>☁️ Về Trời (Thần Linh)</span>
            <kbd>ESC</kbd>
          </button>
        </div>
      </div>

      <div className="avatar-footer">
        <div className="avatar-stamina-card">
          <div className="stamina-header">
            <span>⚡ Thể Lực Hóa Thân</span>
            <span>{Math.round(staminaPercent)}%</span>
          </div>
          <div className="stamina-bar-track">
            <div
              className="stamina-bar-fill"
              style={{ width: `${staminaPercent}%` }}
            />
          </div>
        </div>

        <div className="avatar-controls-guide">
          <div className="guide-item"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> <span>Di chuyển</span></div>
          <div className="guide-item"><kbd>Shift</kbd> <span>Chạy nhanh</span></div>
          <div className="guide-item"><kbd>Space</kbd> <span>Nhảy cao</span></div>
          <div className="guide-item"><kbd>Chuột</kbd> <span>Xoay góc nhìn 360°</span></div>
        </div>
      </div>
    </div>
  )
}
