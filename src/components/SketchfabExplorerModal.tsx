import { useEffect, useState } from 'react'
import { CURATED_3D_ASSETS, sketchfabClient } from '../services/sketchfab/sketchfabClient'
import type { Curated3DAsset, SketchfabModelSummary } from '../services/sketchfab/types'
import type { SpawnedSketchfabEntity } from '../renderer/SketchfabModelLayer'

interface SketchfabExplorerModalProps {
  isOpen: boolean
  onClose: () => void
  onSpawnModel: (entity: SpawnedSketchfabEntity) => void
}

export function SketchfabExplorerModal({
  isOpen,
  onClose,
  onSpawnModel,
}: SketchfabExplorerModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [models, setModels] = useState<SketchfabModelSummary[]>([])
  const [selectedModel, setSelectedModel] = useState<SketchfabModelSummary | Curated3DAsset | null>(
    () => CURATED_3D_ASSETS[0] ?? null,
  )
  const [apiToken, setApiToken] = useState(sketchfabClient.getStoredToken() || '')
  const [showTokenConfig, setShowTokenConfig] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'curated' | 'search'>('curated')
  const [spawnScale, setSpawnScale] = useState(1.0)

  const handleManualSearch = async () => {
    setIsLoading(true)
    try {
      const q = searchQuery.trim()
      const searchOptions: { q: string; categories?: string[] } = { q }
      if (selectedCategory !== 'all') {
        searchOptions.categories = [selectedCategory]
      }
      const res = await sketchfabClient.searchModels(searchOptions)
      setModels(res.results)
      const firstResult = res.results[0]
      if (firstResult) {
        setSelectedModel(firstResult)
      }
    } catch {
      // Handled gracefully
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return undefined
    let active = true
    const searchOptions: { q: string; categories?: string[] } = { q: searchQuery.trim() }
    if (selectedCategory !== 'all') {
      searchOptions.categories = [selectedCategory]
    }
    void sketchfabClient.searchModels(searchOptions).then((res) => {
      if (!active) return
      setModels(res.results)
    }).catch(() => {
      // ignore
    })
    return () => {
      active = false
    }
  }, [isOpen, searchQuery, selectedCategory])

  const handleSaveToken = () => {
    sketchfabClient.setStoredToken(apiToken.trim())
    setShowTokenConfig(false)
  }

  const handleSpawn = () => {
    if (!selectedModel) return

    const isCurated = 'category' in selectedModel
    const entityType = isCurated
      ? (selectedModel as Curated3DAsset).category
      : 'creature'

    const newEntity: SpawnedSketchfabEntity = {
      id: `spawn-${Date.now()}`,
      name: selectedModel.name,
      category: entityType,
      tileIndex: Math.floor(Math.random() * 500) + 100,
      x: (Math.random() - 0.5) * 15,
      z: (Math.random() - 0.5) * 15,
      elevation: 0.5,
      scale: spawnScale,
      rotation: Math.random() * Math.PI * 2,
      modelType: entityType,
    }

    onSpawnModel(newEntity)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window sketchfab-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sketchfab-header">
          <div className="sketchfab-title-group">
            <span className="sketchfab-icon">🎨</span>
            <div>
              <h2>Thư Viện Mô Hình 3D Sketchfab & Sinh Vật Độc Bản</h2>
              <p className="sketchfab-subtitle">Tìm kiếm, kết nối API Sketchfab v3 và triệu hồi mô hình 3D trực tiếp lên hòn đảo</p>
            </div>
          </div>

          <div className="sketchfab-header-actions">
            <button
              className={`sketchfab-token-btn ${sketchfabClient.getStoredToken() ? 'has-token' : ''}`}
              onClick={() => setShowTokenConfig(!showTokenConfig)}
            >
              🔑 {sketchfabClient.getStoredToken() ? 'API Token Đã Lưu' : 'Cấu Hình API Token'}
            </button>
            <button className="modal-close-btn" onClick={onClose} aria-label="Đóng">✕</button>
          </div>
        </div>

        {/* Token Configuration Banner */}
        {showTokenConfig && (
          <div className="sketchfab-token-card">
            <h4>Cấu hình Sketchfab API Token (Tùy chọn)</h4>
            <p>
              Nhập mã API Token từ tài khoản Sketchfab của bạn để tải về và xem trước các mô hình riêng tư / có bản quyền.
              Nếu để trống, hệ thống sẽ sử dụng thư viện mô hình 3D chất lượng cao tích hợp sẵn.
            </p>
            <div className="token-input-row">
              <input
                type="password"
                placeholder="Nhập Sketchfab API Token..."
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                className="token-input"
              />
              <button className="token-save-btn" onClick={handleSaveToken}>Lưu Token</button>
              {sketchfabClient.getStoredToken() && (
                <button
                  className="token-clear-btn"
                  onClick={() => {
                    sketchfabClient.setStoredToken(null)
                    setApiToken('')
                  }}
                >
                  Xóa Token
                </button>
              )}
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="sketchfab-tabs">
          <button
            className={`sketchfab-tab-btn ${activeTab === 'curated' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('curated')
              const first = CURATED_3D_ASSETS[0]
              if (first) setSelectedModel(first)
            }}
          >
            ⭐ Bộ Sưu Tập Tuyển Chọn (High-Fidelity 3D Assets)
          </button>
          <button
            className={`sketchfab-tab-btn ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('search')
              void handleManualSearch()
            }}
          >
            🔍 Tìm Kiếm Sketchfab Online v3
          </button>
        </div>

        {/* Search Bar (When in Search tab) */}
        {activeTab === 'search' && (
          <div className="sketchfab-search-bar">
            <input
              type="text"
              placeholder="Tìm kiếm: dragon, leviathan, tree, monster, creature, plant, golem..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleManualSearch()}
              className="sketchfab-search-input"
            />
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value)
              }}
              className="sketchfab-category-select"
            >
              <option value="all">Tất cả danh mục</option>
              <option value="animals-pets">Sinh vật & Thú hoang</option>
              <option value="nature-plants">Thiên nhiên & Thực vật</option>
              <option value="characters-creatures">Nhân vật & Quái thú</option>
              <option value="architecture">Kiến trúc & Di tích</option>
            </select>
            <button className="sketchfab-search-btn" onClick={handleManualSearch} disabled={isLoading}>
              {isLoading ? 'Đang tìm...' : 'Tìm kiếm'}
            </button>
          </div>
        )}

        {/* Main Content Body */}
        <div className="sketchfab-body-layout">
          {/* Left: Model Grid */}
          <div className="sketchfab-model-grid">
            {activeTab === 'curated' ? (
              CURATED_3D_ASSETS.map((asset) => {
                const isSelected = selectedModel && 'id' in selectedModel && selectedModel.id === asset.id
                return (
                  <div
                    key={asset.id}
                    className={`model-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedModel(asset)}
                  >
                    <div className="model-thumbnail-box">
                      <img src={asset.thumbnail} alt={asset.name} className="model-thumbnail" onError={(e) => { (e.target as HTMLElement).style.display = 'none' }} />
                      <span className="model-cat-badge">{asset.category}</span>
                    </div>
                    <div className="model-card-info">
                      <div className="model-card-name" title={asset.name}>{asset.name}</div>
                      <div className="model-card-meta">
                        <span>🔺 {asset.polyCount.toLocaleString()} polys</span>
                        <span>👤 {asset.author}</span>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              models.map((model) => {
                const isSelected = selectedModel && 'uid' in selectedModel && selectedModel.uid === model.uid
                const thumb = model.thumbnails.images[0]?.url || ''
                return (
                  <div
                    key={model.uid}
                    className={`model-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedModel(model)}
                  >
                    <div className="model-thumbnail-box">
                      {thumb ? (
                        <img src={thumb} alt={model.name} className="model-thumbnail" />
                      ) : (
                        <div className="model-placeholder">3D</div>
                      )}
                      <span className="model-cat-badge">Sketchfab</span>
                    </div>
                    <div className="model-card-info">
                      <div className="model-card-name" title={model.name}>{model.name}</div>
                      <div className="model-card-meta">
                        <span>🔺 {model.faceCount.toLocaleString()} polys</span>
                        <span>👤 {model.user.displayName || model.user.username}</span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Right: Model Preview & Actions */}
          {selectedModel && (
            <div className="sketchfab-preview-panel">
              <div className="preview-title">{selectedModel.name}</div>
              
              <div className="preview-viewport-box">
                {'sketchfabUid' in selectedModel && selectedModel.sketchfabUid ? (
                  <iframe
                    title={selectedModel.name}
                    src={sketchfabClient.buildEmbedUrl(selectedModel.sketchfabUid)}
                    className="sketchfab-embed-frame"
                    allow="autoplay; fullscreen; xr-spatial-tracking"
                  />
                ) : 'uid' in selectedModel ? (
                  <iframe
                    title={selectedModel.name}
                    src={sketchfabClient.buildEmbedUrl((selectedModel as SketchfabModelSummary).uid)}
                    className="sketchfab-embed-frame"
                    allow="autoplay; fullscreen; xr-spatial-tracking"
                  />
                ) : (
                  <div className="preview-fallback-render">
                    <div className="rotating-3d-symbol">🔮</div>
                    <p>Sẵn sàng triệu hồi lên địa hình 3D</p>
                  </div>
                )}
              </div>

              <div className="preview-meta-details">
                <p className="preview-desc">
                  {selectedModel.description || 'Mô hình 3D độ nét cao với vật liệu PBR và kết cấu chân thực.'}
                </p>

                <div className="preview-scale-slider">
                  <label>Kích thước triệu hồi: <strong>{spawnScale.toFixed(1)}x</strong></label>
                  <input
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.1"
                    value={spawnScale}
                    onChange={(e) => setSpawnScale(parseFloat(e.target.value))}
                  />
                </div>

                <button className="spawn-to-island-btn" onClick={handleSpawn}>
                  ⚡ Triệu Hồi Lên Đảo 3D (Spawn to Island)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
