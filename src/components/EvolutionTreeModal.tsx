import { useState } from 'react'
import type { EvolvedSpeciesRecord, IslandEvolutionProfile } from '../simulation/evolution/types'
import { ARCHETYPE_DESCRIPTIONS } from '../simulation/evolution/types'

interface EvolutionTreeModalProps {
  isOpen: boolean
  profile: IslandEvolutionProfile
  onClose: () => void
  onUnlockNode: (nodeId: string) => void
  onMutateSpecies?: (speciesId: string) => void
}

export function EvolutionTreeModal({
  isOpen,
  profile,
  onClose,
  onUnlockNode,
}: EvolutionTreeModalProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string>(`node-${profile.dominantArchetype}-t1`)
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string>('huou-linh-thu')
  const [activeTab, setActiveTab] = useState<'tree' | 'species' | 'metrics'>('tree')

  if (!isOpen) return null

  const archetypeInfo = ARCHETYPE_DESCRIPTIONS[profile.dominantArchetype] || {
    name: profile.dominantArchetype,
    icon: '🧬',
    desc: 'Hệ thống tiến hóa đặc trưng',
  }

  const nodes = Object.values(profile.nodes).sort((a, b) => a.tier - b.tier)
  const selectedNode = profile.nodes[selectedNodeId] || nodes[0]
  const speciesList: EvolvedSpeciesRecord[] = Object.values(profile.speciesCatalog)
  const selectedSpecies = profile.speciesCatalog[selectedSpeciesId] || speciesList[0]

  const canUnlock = selectedNode && !selectedNode.unlocked &&
    profile.dnaPoints >= selectedNode.dnaCost &&
    profile.biomassPoints >= selectedNode.biomassCost &&
    selectedNode.prerequisites.every((id) => profile.unlockedNodeIds.includes(id))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window evolution-tree-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="evolution-modal-header">
          <div className="evolution-header-title">
            <span className="evolution-badge-icon">{archetypeInfo.icon}</span>
            <div>
              <h2>Cây Tiến Hóa Phân Nhánh & Sinh Học Độc Bản</h2>
              <p className="evolution-subtitle">
                {profile.islandName} • Nhánh {archetypeInfo.name} • Mã gen: <code>{profile.cladeSignature.lineageCode}</code>
              </p>
            </div>
          </div>

          <div className="evolution-header-resources">
            <div className="evolution-res-pill dna-pill" title="Điểm DNA tích lũy từ sinh sản & nghiên cứu">
              <span>🧬</span>
              <strong>{Math.round(profile.dnaPoints)}</strong> DNA
            </div>
            <div className="evolution-res-pill biomass-pill" title="Điểm Sinh Khối từ quang hợp & thảm thực vật">
              <span>🌿</span>
              <strong>{Math.round(profile.biomassPoints)}</strong> Sinh Khối
            </div>
            <button className="modal-close-btn" onClick={onClose} aria-label="Đóng modal">
              ✕
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="evolution-tab-bar">
          <button
            className={`evolution-tab-btn ${activeTab === 'tree' ? 'active' : ''}`}
            onClick={() => setActiveTab('tree')}
          >
            🌳 Cây Phát Sinh Chủng Loại (Phylogenetic Tree)
          </button>
          <button
            className={`evolution-tab-btn ${activeTab === 'species' ? 'active' : ''}`}
            onClick={() => setActiveTab('species')}
          >
            🐾 Danh Mục Loài Đột Biến ({speciesList.length})
          </button>
          <button
            className={`evolution-tab-btn ${activeTab === 'metrics' ? 'active' : ''}`}
            onClick={() => setActiveTab('metrics')}
          >
            📊 Đo Đạc Xác Suất 0.5% & Đồng Quy Tiến Hóa
          </button>
        </div>

        {/* Tab 1: Evolution Tree Graph */}
        {activeTab === 'tree' && (
          <div className="evolution-tree-layout">
            <div className="evolution-tree-viewport">
              <div className="evolution-tree-lanes">
                {[1, 2, 3, 4, 5].map((tier) => {
                  const tierNodes = nodes.filter((n) => n.tier === tier)
                  const tierLabels = [
                    'Bậc 1: Khởi Nguyên Tế Bào',
                    'Bậc 2: Hình Thái Biểu Bì',
                    'Bậc 3: Thích Ứng Trao Đổi Chất',
                    'Bậc 4: Hệ Thần Kinh & Tập Tính',
                    'Bậc 5: Thần Thú Thái Cổ (Apex)',
                  ]
                  return (
                    <div key={tier} className="evolution-tree-tier-column">
                      <div className="tier-column-header">{tierLabels[tier - 1]}</div>
                      <div className="tier-node-container">
                        {tierNodes.map((node) => {
                          const isSelected = selectedNode?.id === node.id
                          const isUnlocked = node.unlocked
                          return (
                            <button
                              key={node.id}
                              className={`evolution-node-card ${isUnlocked ? 'unlocked' : 'locked'} ${isSelected ? 'selected' : ''} rarity-${node.rarity}`}
                              onClick={() => setSelectedNodeId(node.id)}
                            >
                              <div className="node-icon-box">{node.icon}</div>
                              <div className="node-info-box">
                                <div className="node-name">{node.name}</div>
                                <div className="node-meta">
                                  {isUnlocked ? (
                                    <span className="unlocked-badge">✓ Đã kích hoạt</span>
                                  ) : (
                                    <span className="cost-tag">
                                      🧬{node.dnaCost} • 🌿{node.biomassCost}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Node Detail Side Panel */}
            {selectedNode && (
              <div className="evolution-node-inspector">
                <div className="inspector-header">
                  <span className="inspector-icon">{selectedNode.icon}</span>
                  <div>
                    <h3>{selectedNode.name}</h3>
                    <div className="inspector-scientific">{selectedNode.scientificName}</div>
                  </div>
                </div>

                <div className="inspector-description">{selectedNode.description}</div>

                <div className="inspector-stats-section">
                  <h4>Chỉ số cộng hưởng toàn hệ sinh thái</h4>
                  <div className="stat-grid">
                    {selectedNode.statDeltas.health && (
                      <div className="stat-chip hp">HP: +{selectedNode.statDeltas.health}</div>
                    )}
                    {selectedNode.statDeltas.attack && (
                      <div className="stat-chip atk">Tấn công: +{selectedNode.statDeltas.attack}</div>
                    )}
                    {selectedNode.statDeltas.defense && (
                      <div className="stat-chip def">Phòng thủ: +{selectedNode.statDeltas.defense}</div>
                    )}
                    {selectedNode.statDeltas.speed && (
                      <div className="stat-chip spd">Tốc độ: +{selectedNode.statDeltas.speed}</div>
                    )}
                    {selectedNode.statDeltas.adaptation && (
                      <div className="stat-chip adapt">Thích nghi: +{selectedNode.statDeltas.adaptation}%</div>
                    )}
                    {selectedNode.statDeltas.intelligence && (
                      <div className="stat-chip intel">Trí tuệ: +{selectedNode.statDeltas.intelligence}%</div>
                    )}
                    {selectedNode.statDeltas.biomassEfficiency && (
                      <div className="stat-chip bio">Hiệu suất sinh khối: +{selectedNode.statDeltas.biomassEfficiency}%</div>
                    )}
                    {selectedNode.statDeltas.photosynthesis && (
                      <div className="stat-chip photo">Quang hợp: +{selectedNode.statDeltas.photosynthesis}%</div>
                    )}
                  </div>
                </div>

                <div className="inspector-traits">
                  <h4>Đặc tính di truyền mở khóa:</h4>
                  <ul>
                    {selectedNode.unlockedTraits.map((t, idx) => (
                      <li key={idx}>✨ {t}</li>
                    ))}
                  </ul>
                </div>

                <div className="inspector-action-box">
                  {selectedNode.unlocked ? (
                    <div className="unlocked-message">🌟 Nút tiến hóa này đã thức tỉnh hoàn toàn.</div>
                  ) : (
                    <button
                      className={`evolution-unlock-button ${canUnlock ? 'ready' : 'disabled'}`}
                      disabled={!canUnlock}
                      onClick={() => onUnlockNode(selectedNode.id)}
                    >
                      Kích hoạt Đột Biến (🧬 {selectedNode.dnaCost} + 🌿 {selectedNode.biomassCost})
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Species Catalog */}
        {activeTab === 'species' && (
          <div className="evolution-species-layout">
            <div className="species-master-list">
              {speciesList.map((sp) => (
                <button
                  key={sp.id}
                  className={`species-list-item ${selectedSpecies?.id === sp.id ? 'active' : ''}`}
                  onClick={() => setSelectedSpeciesId(sp.id)}
                >
                  <span className="species-color-dot" style={{ backgroundColor: sp.colorHex }} />
                  <div className="species-list-text">
                    <div className="species-list-name">{sp.name}</div>
                    <div className="species-list-meta">Bậc {sp.tier} • Thế hệ đột biến F{sp.mutationGeneration}</div>
                  </div>
                </button>
              ))}
            </div>

            {selectedSpecies && (
              <div className="species-detail-panel">
                <div className="species-detail-header">
                  <div className="species-avatar" style={{ borderColor: selectedSpecies.colorHex }}>
                    🐾
                  </div>
                  <div>
                    <h3>{selectedSpecies.name}</h3>
                    <div className="species-classification">{selectedSpecies.classification}</div>
                  </div>
                </div>

                <div className="species-stat-bars">
                  <div className="stat-bar-row">
                    <div className="stat-label">❤️ Máu (HP): {selectedSpecies.stats.health}</div>
                    <div className="stat-bar-bg"><div className="stat-bar-fill hp" style={{ width: `${Math.min(100, selectedSpecies.stats.health / 3)}%` }} /></div>
                  </div>
                  <div className="stat-bar-row">
                    <div className="stat-label">⚔️ Sức tấn công: {selectedSpecies.stats.attack}</div>
                    <div className="stat-bar-bg"><div className="stat-bar-fill atk" style={{ width: `${Math.min(100, selectedSpecies.stats.attack * 1.5)}%` }} /></div>
                  </div>
                  <div className="stat-bar-row">
                    <div className="stat-label">🛡️ Phòng thủ: {selectedSpecies.stats.defense}</div>
                    <div className="stat-bar-bg"><div className="stat-bar-fill def" style={{ width: `${Math.min(100, selectedSpecies.stats.defense * 1.5)}%` }} /></div>
                  </div>
                  <div className="stat-bar-row">
                    <div className="stat-label">⚡ Tốc độ: {selectedSpecies.stats.speed}</div>
                    <div className="stat-bar-bg"><div className="stat-bar-fill spd" style={{ width: `${Math.min(100, selectedSpecies.stats.speed * 2)}%` }} /></div>
                  </div>
                  <div className="stat-bar-row">
                    <div className="stat-label">🌱 Thích nghi môi trường: {selectedSpecies.stats.adaptation}%</div>
                    <div className="stat-bar-bg"><div className="stat-bar-fill adapt" style={{ width: `${selectedSpecies.stats.adaptation}%` }} /></div>
                  </div>
                  <div className="stat-bar-row">
                    <div className="stat-label">🧠 Trí tuệ bầy đàn: {selectedSpecies.stats.intelligence}%</div>
                    <div className="stat-bar-bg"><div className="stat-bar-fill intel" style={{ width: `${selectedSpecies.stats.intelligence}%` }} /></div>
                  </div>
                </div>

                <div className="species-traits-box">
                  <h4>Thuộc tính & Gen đã biểu hiện ({selectedSpecies.activeTraits.length}):</h4>
                  <div className="trait-tag-cloud">
                    {selectedSpecies.activeTraits.map((trait, i) => (
                      <span key={i} className="trait-tag">✨ {trait}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Uniqueness & Convergence Metrics */}
        {activeTab === 'metrics' && (
          <div className="evolution-metrics-layout">
            <div className="metrics-card highlight-card">
              <h3>🎯 Cơ Chế Độc Bản Toán Học (0.5% Collision Probability)</h3>
              <p>
                Mỗi hòn đảo được định danh bởi một <strong>Mã Keystone Taxon</strong> nằm trong không gian tổ hợp $M = 200$ tổ hợp phân rã. 
                Xác suất để 2 hòn đảo bất kỳ sở hữu cùng một nhánh tiến hóa gốc được hiệu chuẩn chính xác bằng:
              </p>
              <div className="formula-box">
                P(Trùng lặp) = 1 / 200 = 0.50% (0.005)
              </div>
              <p>
                Khi xuất hiện sự trùng hợp 0.5% hiếm có này, hệ thống sẽ tự động kích hoạt <strong>Hiện Tượng Đồng Quy Tiến Hóa (Evolutionary Convergence)</strong>,
                cộng hưởng sóng năng lượng Aether gia tăng 250% điểm tiến hóa!
              </p>
            </div>

            <div className="metrics-summary-grid">
              <div className="metric-box">
                <div className="metric-num">#{profile.cladeSignature.keystoneTaxonId}</div>
                <div className="metric-lbl">Mã Keystone Clade</div>
              </div>
              <div className="metric-box">
                <div className="metric-num">{profile.cladeSignature.divergenceScore}</div>
                <div className="metric-lbl">Chỉ Số Phân Kỳ Sinh Học</div>
              </div>
              <div className="metric-box">
                <div className="metric-num">0.5%</div>
                <div className="metric-lbl">Xác Suất Trùng Lặp Nhánh</div>
              </div>
              <div className="metric-box">
                <div className="metric-num">{profile.convergenceEvents.length}</div>
                <div className="metric-lbl">Sự Kiện Đồng Quy Đã Kích Hoạt</div>
              </div>
            </div>

            {profile.convergenceEvents.length > 0 && (
              <div className="convergence-events-list">
                <h4>Lịch sử Hiện Tượng Đồng Quy Tiến Hóa (0.5% Rarity):</h4>
                {profile.convergenceEvents.map((ev, i) => (
                  <div key={i} className="convergence-event-item">
                    <span>🌌 {ev.resonanceName}</span>
                    <span className="bonus-tag">+{Math.round((ev.bonusMultiplier - 1) * 100)}% Tốc độ đột biến</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
