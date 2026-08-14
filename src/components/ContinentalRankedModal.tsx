import React, { useState } from 'react'
import type { SpecializationBranchId } from '../simulation/specialization'
import type { SimulationState } from '../simulation/types'
import type { World } from '../world/types'
import {
  calculateContinentalPower,
  generateChallengers,
  getRankTier,
  loadRankedProfile,
  saveRankedProfile,
  simulateBattle,
} from '../game/continentalRanked'
import type { BattleReport, ContinentalFleet, StoredRankedProfile } from '../game/continentalRanked'

interface ContinentalRankedModalProps {
  world: World
  simulation: SimulationState
  unlockedPerks: readonly string[]
  chosenBranch?: SpecializationBranchId | undefined
  onRewardReceived?: (food: number, research: number) => void
  onClose: () => void
}

export const ContinentalRankedModal: React.FC<ContinentalRankedModalProps> = ({
  world,
  simulation,
  unlockedPerks,
  chosenBranch = 'arcane',
  onRewardReceived,
  onClose,
}) => {
  const [profile, setProfile] = useState<StoredRankedProfile>(() => loadRankedProfile())
  const [activeTab, setActiveTab] = useState<'arena' | 'history'>('arena')
  const [activeBattle, setActiveBattle] = useState<BattleReport | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)

  const playerPowerInfo = calculateContinentalPower(world, simulation, unlockedPerks)
  const currentTier = getRankTier(profile.elo)

  const playerFleet: ContinentalFleet = {
    id: 'player-fleet',
    lordName: 'Đấng Sáng Thế',
    continentName: world.config.seed || 'Lục Địa Aetheria',
    power: playerPowerInfo.power,
    branch: chosenBranch,
    units: playerPowerInfo.units,
    elo: profile.elo,
    population: playerPowerInfo.population,
    resilience: Math.round(playerPowerInfo.resilienceAvg),
    seed: world.config.seed,
  }

  const [challengers] = useState<ContinentalFleet[]>(() =>
    generateChallengers(playerPowerInfo.power, profile.elo, world.config.seed),
  )

  const handleStartBattle = (challenger: ContinentalFleet): void => {
    setIsSimulating(true)
    const report = simulateBattle(playerFleet, challenger)

    window.setTimeout(() => {
      setIsSimulating(false)
      setActiveBattle(report)

      const nextElo = Math.max(100, profile.elo + report.eloChange)
      const nextWins = profile.wins + (report.winner === 'attacker' ? 1 : 0)
      const nextLosses = profile.losses + (report.winner === 'defender' ? 1 : 0)
      const nextHistory = [report, ...profile.history].slice(0, 15)

      const nextProfile: StoredRankedProfile = {
        elo: nextElo,
        wins: nextWins,
        losses: nextLosses,
        history: nextHistory,
      }

      setProfile(nextProfile)
      saveRankedProfile(nextProfile)

      if (report.winner === 'attacker' && onRewardReceived) {
        onRewardReceived(report.rewardFood, report.rewardResearch)
      }
    }, 600)
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="ranked-modal-title">
      <div className="modal-card continental-ranked-modal">
        <header className="modal-header">
          <div>
            <span className="eyebrow">Đấu Trường Xuyên Lục Địa</span>
            <h2 id="ranked-modal-title" className="modal-title">Xếp Hạng Lục Địa Toàn Cầu</h2>
          </div>
          <button type="button" className="close-button" onClick={onClose} aria-label="Đóng bảng xếp hạng">
            ✕
          </button>
        </header>

        {/* Player Continental Banner */}
        <div className="ranked-player-card">
          <div className="tier-badge-container" style={{ borderColor: currentTier.color }}>
            <span className="tier-badge-icon">{currentTier.badge}</span>
            <div className="tier-details">
              <span className="tier-name" style={{ color: currentTier.color }}>
                {currentTier.tier} ({profile.elo} Elo)
              </span>
              <strong className="tier-title">{currentTier.rewardTitle}</strong>
            </div>
          </div>

          <div className="ranked-stats-grid">
            <div className="ranked-stat-box">
              <span className="label">⚔️ Lực Chiến Lục Địa:</span>
              <strong className="value gold">{playerPowerInfo.power}</strong>
            </div>
            <div className="ranked-stat-box">
              <span className="label">🏆 Tỉ Lệ Thắng:</span>
              <strong className="value text-cyan">
                {profile.wins} Thắng / {profile.losses} Bại
              </strong>
            </div>
            <div className="ranked-stat-box">
              <span className="label">👥 Dân Số & Sĩ Khí:</span>
              <strong className="value">{playerPowerInfo.population} Dân</strong>
            </div>
          </div>
        </div>

        {/* Player Army Units Strip */}
        <div className="player-army-strip">
          <span className="army-label">🎖️ Quân Đoàn Viễn Chinh Sẵn Sàng:</span>
          <div className="army-units-tags">
            {playerPowerInfo.units.map((unit) => (
              <span key={unit} className="army-unit-tag">
                {unit}
              </span>
            ))}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="ranked-tabs" role="tablist">
          <button
            type="button"
            className={`ranked-tab ${activeTab === 'arena' ? 'active' : ''}`}
            onClick={() => setActiveTab('arena')}
          >
            ⚔️ Thách Đấu Lục Địa
          </button>
          <button
            type="button"
            className={`ranked-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            📜 Lịch Sử Viễn Chinh ({profile.history.length})
          </button>
        </div>

        {/* Content Body */}
        {activeTab === 'arena' ? (
          <div className="challengers-list">
            <p className="section-hint">
              Cử quân đoàn tinh nhuệ của bạn vượt biển đổ bộ lên các lục địa đối thủ để tranh đoạt tài nguyên và leo bảng xếp hạng Elo:
            </p>

            <div className="challenger-cards-grid">
              {challengers.map((challenger) => {
                const challengerTier = getRankTier(challenger.elo)
                const isChallengerHarder = challenger.power > playerPowerInfo.power

                return (
                  <div key={challenger.id} className="challenger-card">
                    <div className="challenger-header">
                      <div className="challenger-lord-info">
                        <span className="challenger-badge">{challengerTier.badge}</span>
                        <div>
                          <strong className="challenger-name">{challenger.lordName}</strong>
                          <span className="challenger-continent">{challenger.continentName}</span>
                        </div>
                      </div>
                      <span className="challenger-elo" style={{ color: challengerTier.color }}>
                        {challenger.elo} Elo
                      </span>
                    </div>

                    <div className="challenger-metrics">
                      <div className="metric-item">
                        <span>Lực chiến: </span>
                        <strong className={isChallengerHarder ? 'danger-text' : 'good-text'}>
                          {challenger.power}
                        </strong>
                      </div>
                      <div className="metric-item">
                        <span>Chống cự: </span>
                        <strong>{challenger.resilience}%</strong>
                      </div>
                    </div>

                    <div className="challenger-units-preview">
                      {challenger.units.slice(0, 3).map((u) => (
                        <span key={u} className="unit-pill">
                          {u}
                        </span>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="battle-btn"
                      disabled={isSimulating}
                      onClick={() => handleStartBattle(challenger)}
                    >
                      {isSimulating ? 'Đang Đổ Bộ...' : '⚔️ Xuất Quân Viễn Chinh'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="battle-history-list">
            {profile.history.length === 0 ? (
              <div className="empty-history">
                <p>Chưa có cuộc viễn chinh nào. Hãy chọn một lục địa đối thủ để khai chiến!</p>
              </div>
            ) : (
              profile.history.map((item) => (
                <div key={item.id} className={`history-item ${item.winner === 'attacker' ? 'victory' : 'defeat'}`}>
                  <div className="history-header">
                    <span className="history-result">
                      {item.winner === 'attacker' ? '🏆 CHIẾN THẮNG' : '🛡️ RÚT LUI'}
                    </span>
                    <span className="history-target">vs {item.defender.lordName} ({item.defender.continentName})</span>
                    <span className="history-elo">
                      {item.eloChange >= 0 ? `+${item.eloChange}` : item.eloChange} Elo
                    </span>
                  </div>
                  <p className="history-summary">{item.summary}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* Battle Modal Result Overlay */}
        {activeBattle && (
          <div className="battle-result-overlay" role="dialog" aria-modal="true">
            <div className="battle-result-card">
              <div className={`battle-banner ${activeBattle.winner === 'attacker' ? 'win' : 'lose'}`}>
                <h3>{activeBattle.winner === 'attacker' ? '🎉 CHIẾN THẮNG VANG DỘI!' : '🛡️ CUỘC VIỄN CHINH BỊ ĐẨY LÙI'}</h3>
                <span className="battle-elo-tag">
                  {activeBattle.eloChange >= 0 ? `+${activeBattle.eloChange}` : activeBattle.eloChange} Elo
                </span>
              </div>

              <div className="battle-rounds-detail">
                {activeBattle.rounds.map((round) => (
                  <div key={round.round} className="round-box">
                    <strong>Hiệp {round.round}: {round.title}</strong>
                    <p>{round.description}</p>
                  </div>
                ))}
              </div>

              {activeBattle.winner === 'attacker' && (
                <div className="battle-rewards-box">
                  <span>🎁 Chiến Lợi Phẩm:</span>
                  <strong>+{activeBattle.rewardFood} Lương thực</strong>
                  <strong>+{activeBattle.rewardResearch} Điểm Nghiên cứu</strong>
                </div>
              )}

              <button
                type="button"
                className="close-battle-btn"
                onClick={() => setActiveBattle(null)}
              >
                Tiếp Tục
              </button>
            </div>
          </div>
        )}

        <footer className="modal-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Rời Đấu Trường
          </button>
        </footer>
      </div>
    </div>
  )
}
