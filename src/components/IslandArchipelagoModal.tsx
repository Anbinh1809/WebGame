import { useState } from 'react'
import type { PlayerIsland } from '../game/islandManager'
import type { Climate, WorldConfig } from '../world/types'
import { WORLD_SIZES } from '../world/types'
import { ARCHETYPE_DESCRIPTIONS } from '../simulation/evolution/types'

interface IslandArchipelagoModalProps {
  isOpen: boolean
  islands: readonly PlayerIsland[]
  activeIslandId: string
  onClose: () => void
  onSwitchIsland: (id: string) => void
  onCreateIsland: (name: string, config: WorldConfig) => void
}

export function IslandArchipelagoModal({
  isOpen,
  islands,
  activeIslandId,
  onClose,
  onSwitchIsland,
  onCreateIsland,
}: IslandArchipelagoModalProps) {
  const [activeTab, setActiveTab] = useState<'islands' | 'create' | 'convergences'>('islands')
  const [newName, setNewName] = useState('')
  const [newSeed, setNewSeed] = useState('aetheria-seed-9842')
  const [newSize, setNewSize] = useState<number>(48)
  const [newClimate, setNewClimate] = useState<Climate>('ôn hòa')
  const [newWater, setNewWater] = useState(0.54)
  const [newResources, setNewResources] = useState(0.62)

  if (!isOpen) return null

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    const name = newName.trim() || `Đảo Aetheria #${islands.length + 1}`
    onCreateIsland(name, {
      seed: newSeed.trim() || `seed-${Date.now()}`,
      size: newSize,
      climate: newClimate,
      water: newWater,
      resources: newResources,
    })
    setNewName('')
    setNewSeed(`aetheria-seed-${Math.floor(Math.random() * 9999)}`)
    setActiveTab('islands')
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window archipelago-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="archipelago-header">
          <div className="archipelago-title-group">
            <span className="archipelago-icon">🏝️</span>
            <div>
              <h2>Quần Đảo Độc Bản & Các Nhánh Tiến Hóa Độc Lập</h2>
              <p className="archipelago-subtitle">
                Quản lý các hòn đảo riêng biệt của người chơi • Mỗi đảo sở hữu hệ sinh thái, sinh vật và nhánh tiến hóa riêng
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Đóng">✕</button>
        </div>

        {/* Tab Navigation */}
        <div className="archipelago-tabs">
          <button
            className={`archipelago-tab-btn ${activeTab === 'islands' ? 'active' : ''}`}
            onClick={() => setActiveTab('islands')}
          >
            🗺️ Danh Sách Các Hòn Đảo ({islands.length})
          </button>
          <button
            className={`archipelago-tab-btn ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            ✨ Kiến Tạo Hòn Đảo Mới
          </button>
          <button
            className={`archipelago-tab-btn ${activeTab === 'convergences' ? 'active' : ''}`}
            onClick={() => setActiveTab('convergences')}
          >
            🌌 Mạng Lưới Đồng Quy Tiến Hóa (0.5%)
          </button>
        </div>

        {/* Tab 1: Island List */}
        {activeTab === 'islands' && (
          <div className="archipelago-island-grid">
            {islands.map((island) => {
              const isActive = island.id === activeIslandId
              const arch = ARCHETYPE_DESCRIPTIONS[island.evolution.dominantArchetype] || {
                name: island.evolution.dominantArchetype,
                icon: '🧬',
              }
              const totalPop = island.simulation.villages.reduce((sum, v) => sum + v.population, 0)
              const highestEra = island.simulation.villages[0]?.era ?? 'Thời Đồ Đá'

              return (
                <div key={island.id} className={`island-card ${isActive ? 'active-island' : ''}`}>
                  <div className="island-card-header">
                    <div className="island-badge-icon">{arch.icon}</div>
                    <div className="island-header-titles">
                      <div className="island-name">{island.name}</div>
                      <div className="island-clade-code">{island.evolution.cladeSignature.lineageCode}</div>
                    </div>
                    {isActive && <span className="active-badge">Đang quản lý</span>}
                  </div>

                  <div className="island-stats-summary">
                    <div className="island-stat-item">
                      <span>🌍 Kích thước:</span>
                      <strong>{island.config.size}x{island.config.size}</strong>
                    </div>
                    <div className="island-stat-item">
                      <span>🌦️ Khí hậu:</span>
                      <strong>{island.config.climate}</strong>
                    </div>
                    <div className="island-stat-item">
                      <span>👥 Dân cư:</span>
                      <strong>{totalPop} người</strong>
                    </div>
                    <div className="island-stat-item">
                      <span>🏛️ Thời đại:</span>
                      <strong>{highestEra}</strong>
                    </div>
                    <div className="island-stat-item">
                      <span>🧬 Điểm DNA:</span>
                      <strong>{Math.round(island.evolution.dnaPoints)}</strong>
                    </div>
                    <div className="island-stat-item">
                      <span>🌿 Sinh khối:</span>
                      <strong>{Math.round(island.evolution.biomassPoints)}</strong>
                    </div>
                  </div>

                  <div className="island-actions">
                    {isActive ? (
                      <button className="island-btn active-btn" disabled>Đang ở hòn đảo này</button>
                    ) : (
                      <button
                        className="island-btn switch-btn"
                        onClick={() => {
                          onSwitchIsland(island.id)
                          onClose()
                        }}
                      >
                        Chuyển Đến Đảo Này 🚀
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Tab 2: Create New Island Form */}
        {activeTab === 'create' && (
          <form className="archipelago-create-form" onSubmit={handleCreate}>
            <div className="form-group">
              <label>Tên Hòn Đảo:</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ví dụ: Đảo Băng Sơn Bất Diệt, Đảo Rồng Lửa Magma..."
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Seed Địa Hình & Mã Gen:</label>
              <input
                type="text"
                value={newSeed}
                onChange={(e) => setNewSeed(e.target.value)}
                placeholder="Nhập chuỗi seed ngẫu nhiên..."
                className="form-input"
              />
            </div>

            <div className="form-row">
              <div className="form-group half">
                <label>Kích thước thế giới:</label>
                <select
                  value={newSize}
                  onChange={(e) => setNewSize(Number(e.target.value))}
                  className="form-select"
                >
                  {WORLD_SIZES.map((sz) => (
                    <option key={sz} value={sz}>{sz} x {sz} ô địa hình</option>
                  ))}
                </select>
              </div>

              <div className="form-group half">
                <label>Khí hậu chủ đạo:</label>
                <select
                  value={newClimate}
                  onChange={(e) => setNewClimate(e.target.value as Climate)}
                  className="form-select"
                >
                  <option value="ôn hòa">Ôn hòa (Rừng rậm, thảo nguyên)</option>
                  <option value="ấm">Ấm nóng (Cát biển, núi lửa nhiệt đới)</option>
                  <option value="lạnh">Hàn đới (Tuyết phủ, băng sơn vĩnh cửu)</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group half">
                <label>Tỷ lệ diện tích nước biển: <strong>{Math.round(newWater * 100)}%</strong></label>
                <input
                  type="range"
                  min="0.2"
                  max="0.8"
                  step="0.02"
                  value={newWater}
                  onChange={(e) => setNewWater(parseFloat(e.target.value))}
                  className="form-slider"
                />
              </div>

              <div className="form-group half">
                <label>Độ trù phú tài nguyên: <strong>{Math.round(newResources * 100)}%</strong></label>
                <input
                  type="range"
                  min="0.2"
                  max="0.9"
                  step="0.02"
                  value={newResources}
                  onChange={(e) => setNewResources(parseFloat(e.target.value))}
                  className="form-slider"
                />
              </div>
            </div>

            <button type="submit" className="create-island-submit-btn">
              ⚡ Khởi Sinh Hòn Đảo Mới & Kích Hoạt Nhánh Tiến Hóa Độc Bản
            </button>
          </form>
        )}

        {/* Tab 3: Convergence Links */}
        {activeTab === 'convergences' && (
          <div className="archipelago-convergences-panel">
            <div className="convergence-hero-box">
              <h3>🌌 Hệ Thống Hiệu Chuẩn Xác Suất Trùng Lặp 0.5%</h3>
              <p>
                Toàn bộ các hòn đảo trong quần đảo phát triển các nhánh tiến hóa phân kỳ dựa trên tương tác môi trường.
                Hai hòn đảo độc lập bất kỳ chỉ có xác suất trùng lặp keystone taxon đúng bằng <strong>0.5% (1/200)</strong>.
              </p>
            </div>

            <div className="island-comparison-matrix">
              <h4>Mã Định Danh Gen & Keystone Taxon Từng Đảo:</h4>
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Hòn Đảo</th>
                    <th>Nhánh Chủ Đạo</th>
                    <th>Mã Keystone (0-199)</th>
                    <th>Mã Gen Lineage</th>
                    <th>Thế Hệ Đột Biến</th>
                  </tr>
                </thead>
                <tbody>
                  {islands.map((isl) => (
                    <tr key={isl.id} className={isl.id === activeIslandId ? 'active-row' : ''}>
                      <td><strong>{isl.name}</strong></td>
                      <td>{isl.evolution.dominantArchetype}</td>
                      <td><code>#{isl.evolution.cladeSignature.keystoneTaxonId}</code></td>
                      <td><code>{isl.evolution.cladeSignature.lineageCode}</code></td>
                      <td>F{isl.evolution.generationCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
