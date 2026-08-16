import React, { useState } from 'react'
import {
  SPECIALIZATION_BRANCHES,
  calculateSpecializationBonuses,
} from '../simulation/specialization'
import type { SpecializationBranchId } from '../simulation/specialization'
import type { SimulationState } from '../simulation/types'
import { EVOLUTION_EPOCH_DETAILS } from '../simulation/progression'

interface CivilizationTreeModalProps {
  simulation: SimulationState
  unlockedPerks: readonly string[]
  chosenBranch?: SpecializationBranchId | undefined
  onSelectBranch: (branchId: SpecializationBranchId) => void
  onUnlockPerk: (perkId: string, cost: number) => void
  onClose: () => void
}

export const CivilizationTreeModal: React.FC<CivilizationTreeModalProps> = ({
  simulation,
  unlockedPerks,
  chosenBranch,
  onSelectBranch,
  onUnlockPerk,
  onClose,
}) => {
  const [selectedBranchId, setSelectedBranchId] = useState<SpecializationBranchId>(
    chosenBranch || 'arcane',
  )

  const activeBranch = SPECIALIZATION_BRANCHES.find((b) => b.id === selectedBranchId) || SPECIALIZATION_BRANCHES[0]!
  const availableResearch = Math.floor(simulation.villages.reduce((sum, v) => sum + v.research, 0))
  const totalBiomass = Math.floor(simulation.villages.reduce((sum, v) => sum + (v.biomass ?? 0), 0))
  const totalDna = Math.floor(simulation.villages.reduce((sum, v) => sum + (v.dnaPoints ?? 0), 0))
  const primaryVillage = simulation.villages[0]
  const currentEpoch = primaryVillage?.epoch ?? 'Kỷ Tiền Cambri (Đơn Bào)'
  const epochDetail = EVOLUTION_EPOCH_DETAILS[currentEpoch]
  const bonuses = calculateSpecializationBonuses(unlockedPerks)

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="civ-tree-title">
      <div className="modal-card civ-tree-modal">
        <header className="modal-header">
          <div>
            <span className="eyebrow">🧬 Cây Tiến Hóa Sinh Học & Văn Minh</span>
            <h2 id="civ-tree-title" className="modal-title">Phân Nhánh Đột Biến Gen & Chuyên Môn Hóa</h2>
          </div>
          <button type="button" className="close-button" onClick={onClose} aria-label="Đóng bảng tiến hóa">
            ✕
          </button>
        </header>

        {/* Biological Epoch Banner */}
        <div className="evolution-epoch-banner" style={{ borderLeftColor: epochDetail.accentColor }}>
          <div className="epoch-icon">{epochDetail.icon}</div>
          <div className="epoch-info">
            <div className="epoch-badge" style={{ backgroundColor: `${epochDetail.accentColor}22`, color: epochDetail.accentColor }}>
              {epochDetail.title} • {epochDetail.period}
            </div>
            <h3 className="epoch-title">Sinh vật thống trị: {epochDetail.dominantLife}</h3>
            <p className="epoch-desc">{epochDetail.description}</p>
          </div>
        </div>

        <div className="civ-tree-summary-bar">
          <div className="civ-stat-item">
            <span className="label">💡 Điểm Nghiên Cứu:</span>
            <strong className="value gold">{availableResearch}</strong>
          </div>
          <div className="civ-stat-item">
            <span className="label">🧬 Điểm DNA Tích Lũy:</span>
            <strong className="value text-cyan">+{totalDna + bonuses.dnaBonus} DNA</strong>
          </div>
          <div className="civ-stat-item">
            <span className="label">🌿 Sinh Khối Sinh Quyển:</span>
            <strong className="value text-emerald">+{totalBiomass + bonuses.biomassBonus} Biomass</strong>
          </div>
          <div className="civ-stat-item">
            <span className="label">⚔️ Lực Chiến Sinh Học:</span>
            <strong className="value text-rose">+{bonuses.militaryBonus}</strong>
          </div>
          <div className="civ-stat-item">
            <span className="label">🛡️ Binh Chủng Độc Quyền:</span>
            <strong className="value">{bonuses.unlockedUnits.length} Đơn Vị</strong>
          </div>
        </div>

        {/* Branch Selectors */}
        <div className="civ-branch-tabs" role="tablist">
          {SPECIALIZATION_BRANCHES.map((branch) => {
            const isSelected = branch.id === selectedBranchId
            const isChosen = branch.id === chosenBranch
            return (
              <button
                key={branch.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={`civ-branch-tab ${isSelected ? 'active' : ''} ${isChosen ? 'chosen' : ''}`}
                style={{ '--accent-color': branch.accentColor } as React.CSSProperties}
                onClick={() => {
                  setSelectedBranchId(branch.id)
                  if (!chosenBranch) onSelectBranch(branch.id)
                }}
              >
                <span className="branch-icon">{branch.icon}</span>
                <div className="branch-tab-info">
                  <span className="branch-name">{branch.name}</span>
                  <span className="branch-tagline">{branch.tagline}</span>
                </div>
                {isChosen && <span className="chosen-badge">Đang Theo</span>}
              </button>
            )
          })}
        </div>

        {/* Branch Description & Perks */}
        <div className="civ-branch-body">
          <div className="branch-info-banner" style={{ borderColor: activeBranch.accentColor }}>
            <h3>{activeBranch.icon} {activeBranch.name}</h3>
            <p>{activeBranch.description}</p>
          </div>

          <div className="perks-tree-grid">
            {activeBranch.perks.map((perk, index) => {
              const isUnlocked = unlockedPerks.includes(perk.id)
              const prevPerk = index > 0 ? activeBranch.perks[index - 1] : undefined
              const isPrerequisiteMet = !prevPerk || unlockedPerks.includes(prevPerk.id)
              const canAfford = availableResearch >= perk.researchCost
              const canUnlock = isPrerequisiteMet && canAfford && !isUnlocked

              return (
                <div
                  key={perk.id}
                  className={`perk-card tier-${perk.tier} ${isUnlocked ? 'unlocked' : ''} ${!isPrerequisiteMet ? 'locked' : ''}`}
                >
                  <div className="perk-header">
                    <span className="tier-pill">Tầng {perk.tier}</span>
                    <h4 className="perk-label">{perk.label}</h4>
                  </div>
                  <p className="perk-description">{perk.description}</p>

                  <div className="perk-bonuses">
                    <span className="bonus-tag">⚔️ +{perk.militaryBonus} Quân lực</span>
                    <span className="bonus-tag">🌾 +{Math.round(perk.harvestBonus * 100)}% Thu hoạch</span>
                    <span className="bonus-tag">🛡️ +{Math.round(perk.stormDefenseBonus * 100)}% Chống bão</span>
                  </div>

                  <div className="perk-unit">
                    <span className="unit-label">Binh chủng mở khóa:</span>
                    <strong className="unit-name">🎖️ {perk.uniqueUnit}</strong>
                  </div>

                  <div className="perk-footer">
                    <div className="perk-cost">
                      <span>Chi phí: </span>
                      <strong>{perk.researchCost} Nghiên cứu</strong>
                    </div>

                    {isUnlocked ? (
                      <span className="unlocked-badge">✓ Đã Kích Hoạt</span>
                    ) : (
                      <button
                        type="button"
                        className="unlock-button"
                        disabled={!canUnlock}
                        onClick={() => onUnlockPerk(perk.id, perk.researchCost)}
                      >
                        {!isPrerequisiteMet ? '🔒 Cần Tầng Trước' : !canAfford ? 'Thiếu Nghiên Cứu' : '⚡ Kích Hoạt Ngay'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <footer className="modal-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Đóng Lại
          </button>
        </footer>
      </div>
    </div>
  )
}
