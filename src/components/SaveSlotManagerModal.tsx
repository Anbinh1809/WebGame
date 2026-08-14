import { useState } from 'react'
import type { ChangeEvent, JSX } from 'react'
import {
  listSaveSlots,
  deleteSaveSlot,
  renameSaveSlot,
  saveGameToSlot,
  decodeSave,
  SAVE_SLOT_KEY_PREFIX,
} from '../game/save'
import type { SaveSlotMeta } from '../game/save'
import { appPath } from '../routes'

interface SaveSlotManagerModalProps {
  isOpen: boolean
  onClose: () => void
  onLoadWorld?: (slotId: string) => void
}

function SaveSlotDialogBody({
  onClose,
  onLoadWorld,
}: {
  onClose: () => void
  onLoadWorld?: ((slotId: string) => void) | undefined
}): JSX.Element {
  const [slots, setSlots] = useState<SaveSlotMeta[]>(() => {
    try {
      return listSaveSlots()
    } catch {
      return []
    }
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const refreshSlots = (): void => {
    try {
      setSlots(listSaveSlots())
    } catch {
      setSlots([])
    }
  }

  const handleStartRename = (slot: SaveSlotMeta): void => {
    setEditingId(slot.slotId)
    setEditName(slot.worldName)
  }

  const handleSaveRename = (slotId: string): void => {
    if (!editName.trim()) return
    renameSaveSlot(slotId, editName)
    setEditingId(null)
    refreshSlots()
    setNotice(`Đã đổi tên bản lưu thành "${editName.trim()}".`)
  }

  const handleDelete = (slot: SaveSlotMeta): void => {
    const confirmed = window.confirm(`Bạn có chắc chắn muốn xóa bản lưu "${slot.worldName}"? Hành động này không thể hoàn tác.`)
    if (!confirmed) return
    deleteSaveSlot(slot.slotId)
    refreshSlots()
    setNotice(`Đã xóa bản lưu "${slot.worldName}".`)
  }

  const handleExportSlot = (slot: SaveSlotMeta): void => {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(`${SAVE_SLOT_KEY_PREFIX}${slot.slotId}`) : null
    if (!raw) {
      setNotice('Không tìm thấy dữ liệu bản lưu này để xuất.')
      return
    }
    const blob = new Blob([raw], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `aetheria-${slot.seed}-${new Date(slot.savedAt).toISOString().slice(0, 10)}.save`
    link.click()
    URL.revokeObjectURL(url)
    setNotice(`Đã xuất tệp lưu "${slot.worldName}".`)
  }

  const handleImportNewSlot = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const result = decodeSave(text)
      if (!result.ok) {
        setNotice(result.reason)
        return
      }
      const importedVillage = result.game.session.simulation.villages[0]
      const defaultName = importedVillage?.name ? `Nhập: ${importedVillage.name}` : `Nhập: ${result.game.session.world.config.seed}`
      const meta = saveGameToSlot(result.game, defaultName)
      refreshSlots()
      setNotice(`Đã nhập thành công bản lưu mới: "${meta.worldName}".`)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Tệp lưu không hợp lệ.')
    }
  }

  const handleEnterWorld = (slotId: string): void => {
    if (onLoadWorld) {
      onLoadWorld(slotId)
      onClose()
    } else {
      window.location.assign(`${appPath('/play')}?slot=${encodeURIComponent(slotId)}`)
    }
  }

  return (
    <div
      className="game-pause-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-manager-title"
    >
      <div className="game-pause-backdrop" onClick={onClose} />
      <div className="game-pause-modal modal-wide">
        <div className="game-pause-header">
          <div className="game-pause-badge">DANH MỤC THẾ GIỚI</div>
          <h2 id="save-manager-title" className="game-pause-title">QUẢN LÝ BẢN LƯU</h2>
          <p className="game-pause-sub">
            Mỗi thế giới lưu trữ độc lập trên trình duyệt của bạn. Bạn có thể nạp, đổi tên, xuất file hoặc xóa.
          </p>
        </div>

        {notice ? <div className="game-alert-banner" role="status">{notice}</div> : null}

        <div className="save-manager-actions-top">
          <label className="game-btn game-btn-secondary file-label">
            <span>📥 Nhập tệp .save vào danh sách</span>
            <input type="file" accept=".save,.json,text/plain" onChange={handleImportNewSlot} hidden />
          </label>
        </div>

        <div className="save-slots-list">
          {slots.length === 0 ? (
            <div className="empty-save-state">
              <p>Chưa có bản lưu nào trên thiết bị này.</p>
              <span>Hãy khởi tạo một thế giới mới hoặc nhập tệp lưu từ máy tính.</span>
            </div>
          ) : (
            slots.map((slot) => {
              const isEditing = editingId === slot.slotId
              return (
                <article key={slot.slotId} className="save-slot-card">
                  <div className="save-slot-main">
                    {isEditing ? (
                      <div className="save-rename-row">
                        <input
                          type="text"
                          className="game-text-input"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          maxLength={48}
                          autoFocus
                        />
                        <button
                          type="button"
                          className="game-btn game-btn-primary btn-sm"
                          onClick={() => handleSaveRename(slot.slotId)}
                        >
                          Lưu
                        </button>
                        <button
                          type="button"
                          className="game-btn game-btn-secondary btn-sm"
                          onClick={() => setEditingId(null)}
                        >
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <div className="save-card-header">
                        <h3 className="save-card-title">{slot.worldName}</h3>
                        <button
                          type="button"
                          className="icon-edit-btn"
                          onClick={() => handleStartRename(slot)}
                          title="Đổi tên bản lưu này"
                          aria-label={`Đổi tên ${slot.worldName}`}
                        >
                          ✏️
                        </button>
                      </div>
                    )}

                    <div className="save-card-badges">
                      <span className="badge-pill badge-seed">Seed: {slot.seed}</span>
                      <span className="badge-pill badge-era">{slot.era}</span>
                      <span className="badge-pill badge-pop">{slot.population} cư dân</span>
                      <span className="badge-pill badge-days">Ngày {slot.days}</span>
                    </div>

                    <div className="save-card-date">
                      Lưu lúc: {new Date(slot.savedAt).toLocaleString('vi-VN')}
                    </div>
                  </div>

                  <div className="save-slot-buttons">
                    <button
                      type="button"
                      className="game-btn game-btn-primary"
                      onClick={() => handleEnterWorld(slot.slotId)}
                    >
                      ▶ Vào chơi
                    </button>
                    <button
                      type="button"
                      className="game-btn game-btn-secondary"
                      onClick={() => handleExportSlot(slot)}
                      title="Tải xuống tệp .save về máy"
                    >
                      💾 Xuất
                    </button>
                    <button
                      type="button"
                      className="game-btn game-btn-danger"
                      onClick={() => handleDelete(slot)}
                      title="Xóa vĩnh viễn bản lưu này"
                      aria-label={`Xóa bản lưu ${slot.worldName}`}
                    >
                      🗑️
                    </button>
                  </div>
                </article>
              )
            })
          )}
        </div>

        <div className="game-pause-divider" style={{ margin: '18px 0 12px' }} />

        <div className="game-pause-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="game-btn game-btn-secondary" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

export function SaveSlotManagerModal({
  isOpen,
  onClose,
  onLoadWorld,
}: SaveSlotManagerModalProps): JSX.Element | null {
  if (!isOpen) return null

  return (
    <SaveSlotDialogBody
      onClose={onClose}
      onLoadWorld={onLoadWorld}
    />
  )
}
