import { useState, useEffect } from 'react'
import type { ChangeEvent, JSX } from 'react'
import { POLY_HAVEN_CREDIT, POLY_HAVEN_URL } from '../assets/manifest'
import { COMMERCIAL_OFFERS } from '../commerce/catalog'
import { appPath } from '../routes'
import { PlayerAccountPanel } from './PlayerAccountPanel'
import { SaveSlotManagerModal } from './SaveSlotManagerModal'
import { UpdateNotificationBanner } from './UpdateNotificationBanner'
import { loadFromLocalStorage, decodeSave, saveToLocalStorage, SAVE_STORAGE_KEY, listSaveSlots } from '../game/save'
import { DEFAULT_WORLD_CONFIG } from '../world/types'
import type { Climate } from '../world/types'
import { STARTER_SCENARIOS } from '../world/scenarios'
import type { MapScenario } from '../world/scenarios'

function setMetadata(): void {
  document.title = 'Aetheria: World Shaper — Cổng Giới Thiệu & Chơi Thử Web 3D'
  const description = document.querySelector('meta[name="description"]')
  description?.setAttribute('content', 'Aetheria: World Shaper là sandbox 3D theo seed. Khám phá giới thiệu game, trải nghiệm bản chơi thử Web 1K và tải bản phần mềm máy tính 2K/4K/8K.')
  let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.append(canonical)
  }
  canonical.href = new URL(appPath('/'), window.location.origin).href
}

const faqEntries = [
  ['1K/2K/4K/8K nghĩa là gì?', 'Đây là độ phân giải texture trong gói asset, không phải độ phân giải màn hình. Chất lượng kết xuất và độ phân giải texture là hai thiết lập độc lập.'],
  ['Máy yếu có chơi được bản Web không?', 'Bản chơi thử dùng texture 1K và tự hạ về 512 px khi WebGL/GPU yếu. Chế độ tự động theo dõi tốc độ khung hình, giới hạn chất lượng phù hợp trên di động và thay đổi dần để tránh giật.'],
  ['Bản web khác gì bản phần mềm máy tính (Desktop)?', 'Bản Web là bản giới thiệu và chơi thử miễn phí nhanh gọn không cần cài đặt. Bản Desktop mở khóa độ chi tiết texture 2K/4K/8K, hiệu năng GPU tối đa, lưu trữ offline không giới hạn và tự động cập nhật ngầm khi có phiên bản mới.'],
  ['8K có bắt buộc không?', 'Không. Aetheria Cinema 8K là gói trả phí dành cho chế độ chụp ảnh hoặc điện ảnh; chỉ mở khi ứng dụng desktop xác minh quyền mua, gói cục bộ có sẵn và GPU đạt yêu cầu. Game luôn tự chuyển về 4K hoặc 2K an toàn.'],
  ['Gói hết hạn thì sao?', 'Bản game cơ bản và thế giới đã lưu không bị khóa. Nếu Cinema hoặc Patron trở thành gói định kỳ, thời gian gia hạn, sử dụng ngoại tuyến, hủy và hoàn tiền sẽ được công bố trước khi mở bán.'],
  ['Poly Haven là gì?', 'Poly Haven cung cấp asset CC0 thuộc phạm vi công cộng. Aetheria sẽ ghi nhận nguồn asset, không ngụ ý hợp tác và chỉ dùng các asset đã tuyển chọn, đóng gói trong bản game.'],
  ['Quyền riêng tư của demo ra sao?', 'Không có suy luận AI tại máy khách và không thu thập dữ liệu sử dụng mặc định. Bản chơi thử không yêu cầu đăng nhập.'],
] as const

const faqStructuredData = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqEntries.map(([name, text]) => ({
    '@type': 'Question',
    name,
    acceptedAnswer: { '@type': 'Answer', text },
  })),
})

type ActiveLauncherTab = 'play' | 'new-game' | 'saves' | 'desktop' | 'settings' | 'profile' | 'credits'

export function LandingPage(): JSX.Element {
  const [activeTab, setActiveTab] = useState<ActiveLauncherTab>('play')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [selectedScenario, setSelectedScenario] = useState<MapScenario | null>(null)
  const [newSeed, setNewSeed] = useState(() => DEFAULT_WORLD_CONFIG.seed)
  const [newSize, setNewSize] = useState<number>(DEFAULT_WORLD_CONFIG.size)
  const [newClimate, setNewClimate] = useState<Climate>(DEFAULT_WORLD_CONFIG.climate)
  const [newWater, setNewWater] = useState<number>(DEFAULT_WORLD_CONFIG.water)
  const [newResources, setNewResources] = useState<number>(DEFAULT_WORLD_CONFIG.resources)
  const [hasSave, setHasSave] = useState<boolean>(() => {
    try {
      return loadFromLocalStorage().ok || listSaveSlots().length > 0
    } catch {
      return false
    }
  })
  const [saveNotice, setSaveNotice] = useState<string | null>(null)
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false)

  useEffect(() => {
    setMetadata()
  }, [])

  const toggleFullscreen = async (): Promise<void> => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch {
      // Fullscreen not supported or blocked
    }
  }

  const handleRandomSeed = (): void => {
    const values = new Uint32Array(2)
    crypto.getRandomValues(values)
    setNewSeed(`aetheria-${values[0]?.toString(36)}-${values[1]?.toString(36)}`)
    setSelectedScenario(null)
  }

  const handleSelectScenario = (scenario: MapScenario): void => {
    setSelectedScenario(scenario)
    setNewSeed(scenario.config.seed)
    setNewSize(scenario.config.size)
    setNewClimate(scenario.config.climate)
    setNewWater(scenario.config.water)
    setNewResources(scenario.config.resources)
  }

  const handleStartCustomWorld = (): void => {
    const params = new URLSearchParams({
      seed: newSeed.trim() || 'aetheria-bình-minh',
    })
    if (selectedScenario) {
      params.set('scenario', selectedScenario.id)
    }
    window.location.assign(`${appPath('/play')}?${params.toString()}`)
  }

  const handleStartScenarioDirect = (scenario: MapScenario): void => {
    const params = new URLSearchParams({
      seed: scenario.config.seed,
      scenario: scenario.id,
    })
    window.location.assign(`${appPath('/play')}?${params.toString()}`)
  }

  const handleExportSave = (): void => {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(SAVE_STORAGE_KEY) : null
    if (!raw) return
    const blob = new Blob([raw], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `aetheria-${new Date().toISOString().slice(0, 10)}.save`
    link.click()
    URL.revokeObjectURL(url)
    setSaveNotice('Đã tải xuống tệp lưu trữ thành công!')
  }

  const handleImportSave = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const result = decodeSave(text)
      if (!result.ok) {
        setSaveNotice(result.reason)
        return
      }
      saveToLocalStorage(result.game)
      setHasSave(true)
      setSaveNotice('Đã nhập tệp lưu thành công! Bạn có thể vào game ngay.')
    } catch (err) {
      setSaveNotice(err instanceof Error ? err.message : 'Tệp lưu không hợp lệ.')
    }
  }

  return (
    <main className="game-launcher-shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqStructuredData }} />
      <a className="marketing-skip-link" href="#main-content">Đến giao diện chính</a>

      {/* Auto-Update Banner */}
      <UpdateNotificationBanner />

      {/* Background Star/Aether Ambience (Pure CSS) */}
      <div className="launcher-bg" aria-hidden="true">
        <div className="launcher-stars" />
        <div className="launcher-horizon-glow" />
        <div className="launcher-grid-plane" />
      </div>

      {/* Top Client Bar */}
      <header className="launcher-top-bar" aria-label="Thanh điều khiển trò chơi">
        <div className="launcher-brand">
          <span className="launcher-crest">✦</span>
          <span className="launcher-name">AETHERIA PORTAL</span>
          <span className="launcher-version-tag">WEB DEMO &amp; SHOWCASE</span>
        </div>
        <nav className="launcher-nav-tabs" aria-label="Điều hướng Launcher">
          <button
            type="button"
            className={`launcher-tab-btn ${activeTab === 'play' ? 'active' : ''}`}
            onClick={() => setActiveTab('play')}
          >
            Giới Thiệu &amp; Chơi Thử
          </button>
          <button
            type="button"
            className={`launcher-tab-btn ${activeTab === 'new-game' ? 'active' : ''}`}
            onClick={() => setActiveTab('new-game')}
          >
            Bản Đồ Mở Đầu
          </button>
          <button
            type="button"
            className={`launcher-tab-btn ${activeTab === 'saves' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('saves')
              setIsSaveModalOpen(true)
            }}
          >
            Bản Lưu ({listSaveSlots().length})
          </button>
          <button
            type="button"
            className={`launcher-tab-btn ${activeTab === 'desktop' ? 'active' : ''}`}
            onClick={() => setActiveTab('desktop')}
          >
            Bản Máy Tính (2K/4K/8K)
          </button>
          <button
            type="button"
            className={`launcher-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Thiết Lập
          </button>
          <button
            type="button"
            className={`launcher-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            Hồ Sơ
          </button>
          <button
            type="button"
            className={`launcher-tab-btn ${activeTab === 'credits' ? 'active' : ''}`}
            onClick={() => setActiveTab('credits')}
          >
            Bản Quyền
          </button>
        </nav>
        <div className="launcher-top-actions">
          <button
            type="button"
            className="launcher-icon-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Thoát toàn màn hình' : 'Bật toàn màn hình (F)'}
            aria-label="Toàn màn hình"
          >
            {isFullscreen ? '⤦' : '⛶'}
          </button>
        </div>
      </header>

      {/* Main Showcase & Title Screen Centerpiece */}
      <section id="main-content" className="launcher-main-content">
        <div className="launcher-title-card">
          <div className="launcher-sun-halo" aria-hidden="true" />
          <div className="launcher-kicker">CỔNG GIỚI THIỆU TRÒ CHƠI &amp; CHƠI THỬ TRỰC TUYẾN</div>
          <h1 className="launcher-game-title">AETHERIA: WORLD SHAPER</h1>
          <p className="launcher-tagline">
            Trò chơi sandbox 3D mô phỏng khởi nguyên thế giới — Bạn vào vai Đấng Sáng Tạo nắn địa hình theo hạt giống, nuôi dưỡng các kỷ nguyên văn minh và khắc ghi biên niên sử nhân loại.
          </p>

          {/* Primary Action Deck */}
          <div className="launcher-menu-deck" role="menu">
            <a
              href={appPath('/play')}
              className="launcher-menu-item launcher-menu-primary"
              role="menuitem"
            >
              <span className="menu-item-icon">▶</span>
              <div className="menu-item-info">
                <strong className="menu-item-title">Chơi thử miễn phí (bản web 1K)</strong>
                <span className="menu-item-desc">Vào thẳng thế giới khởi nguyên trên trình duyệt không cần cài đặt</span>
              </div>
            </a>

            <button
              type="button"
              className={`launcher-menu-item ${activeTab === 'desktop' ? 'active' : ''}`}
              onClick={() => setActiveTab('desktop')}
            >
              <span className="menu-item-icon">💻</span>
              <div className="menu-item-info">
                <strong className="menu-item-title">Khám phá bản phần mềm máy tính (2K / 4K / 8K)</strong>
                <span className="menu-item-desc">Độ nét siêu thực, tự động cập nhật ngầm, lưu offline không giới hạn</span>
              </div>
            </button>

            <button
              type="button"
              className={`launcher-menu-item ${activeTab === 'new-game' ? 'active' : ''}`}
              onClick={() => setActiveTab('new-game')}
            >
              <span className="menu-item-icon">✦</span>
              <div className="menu-item-info">
                <strong className="menu-item-title">Chọn kịch bản &amp; Tạo thế giới mới</strong>
                <span className="menu-item-desc">5 Bản đồ khởi đầu đặc sắc hoặc tự do tùy chỉnh seed</span>
              </div>
            </button>

            <button
              type="button"
              className={`launcher-menu-item ${activeTab === 'saves' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('saves')
                setIsSaveModalOpen(true)
              }}
            >
              <span className="menu-item-icon">💾</span>
              <div className="menu-item-info">
                <strong className="menu-item-title">Quản lý các bản lưu ({listSaveSlots().length} slot)</strong>
                <span className="menu-item-desc">Tải lại thế giới đã tạo, đổi tên hoặc xuất tệp .save</span>
              </div>
            </button>

            <button
              type="button"
              className={`launcher-menu-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <span className="menu-item-icon">⚙</span>
              <div className="menu-item-info">
                <strong className="menu-item-title">Cài đặt hệ thống &amp; Gói Poly Haven</strong>
                <span className="menu-item-desc">Cấu hình texture 1K-8K và chất lượng đồ họa kết xuất</span>
              </div>
            </button>

            <button
              type="button"
              className={`launcher-menu-item ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <span className="menu-item-icon">👤</span>
              <div className="menu-item-info">
                <strong className="menu-item-title">Hồ sơ Đấng Sáng Tạo</strong>
                <span className="menu-item-desc">Đăng nhập, đăng ký và quản lý danh hiệu người chơi</span>
              </div>
            </button>

            <button
              type="button"
              className={`launcher-menu-item ${activeTab === 'credits' ? 'active' : ''}`}
              onClick={() => setActiveTab('credits')}
            >
              <span className="menu-item-icon">📜</span>
              <div className="menu-item-info">
                <strong className="menu-item-title">Thông tin &amp; Bản quyền</strong>
                <span className="menu-item-desc">Tài nguyên Poly Haven CC0, hướng dẫn và lộ trình</span>
              </div>
            </button>
          </div>

          <footer className="launcher-bottom-note">
            <span>Bản web dùng để giới thiệu và chơi thử · Không cần đăng nhập · Lưu trữ cục bộ an toàn</span>
          </footer>
        </div>

        {/* Game Launcher Panels Section */}
        <div className="launcher-active-panel-wrap">
          {/* Panel: Game Feature Showcase (Default Tab) */}
          <section className={`launcher-panel-card ${activeTab === 'play' ? 'active-panel' : 'hidden-panel'}`} aria-labelledby="panel-showcase-title">
            <header className="launcher-panel-header">
              <h2 id="panel-showcase-title">🌟 Giới Thiệu Tính Năng Đột Phá</h2>
              <p className="panel-sub">Trải nghiệm quyền năng sáng tạo một thế giới sống động từ hư vô.</p>
            </header>
            <div className="launcher-panel-body">
              <div className="showcase-pillars-grid">
                <div className="showcase-pillar-card">
                  <span className="pillar-icon">⛰️</span>
                  <h3>Địa Hình Voxel 3D Tự Do</h3>
                  <p>Nâng núi cao tuyết phủ, hạ thung lũng sâu, kiến tạo dòng chảy sông ngòi và đại dương theo từng click chuột.</p>
                </div>
                <div className="showcase-pillar-card">
                  <span className="pillar-icon">👥</span>
                  <h3>Tiến Hóa Kỷ Nguyên</h3>
                  <p>Từ những đốm lửa trại thời Đồ Đá, dân làng tự khai hoang, làm nông trại, đúc kim khí và xây dựng thị trấn thịnh vượng.</p>
                </div>
                <div className="showcase-pillar-card">
                  <span className="pillar-icon">⛈️</span>
                  <h3>Quyền Năng Thiên Nhiên</h3>
                  <p>Gọi mưa tưới mát ruộng đồng, kích hoạt sấm sét thần thánh hoặc di chuyển cư dân khai phá vùng đất mới.</p>
                </div>
                <div className="showcase-pillar-card">
                  <span className="pillar-icon">🎨</span>
                  <h3>Đồ Họa &amp; Âm Nhạc Sống Động</h3>
                  <p>Kết hợp texture Poly Haven chân thực, âm thanh thiên nhiên 3D và các bản nhạc nền giao hưởng huyền ảo.</p>
                </div>
              </div>

              <div className="game-pause-divider" style={{ margin: '20px 0' }} />

              <div className="demo-vs-desktop-banner">
                <div className="edition-callout-box">
                  <div className="edition-badge web-badge">🌐 Bản Web (Chơi Thử)</div>
                  <h4>Chơi thử ngay</h4>
                  <ul>
                    <li>✓ Không cần tải hay cài đặt</li>
                    <li>✓ Texture 1K nhẹ nhàng, mượt mà</li>
                    <li>✓ Trải nghiệm các quyền năng cơ bản</li>
                  </ul>
                  <a href={appPath('/play')} className="game-btn game-btn-primary full-width">
                    ▶ Vào chơi thử Web ngay
                  </a>
                </div>

                <div className="edition-callout-box featured-box">
                  <div className="edition-badge desktop-badge">💻 Bản Desktop (Phần Mềm)</div>
                  <h4>Trải nghiệm trọn vẹn</h4>
                  <ul>
                    <li>✓ Đồ họa 2K / 4K / 8K Cinema siêu nét</li>
                    <li>✓ Tự động cập nhật ngầm không gián đoạn</li>
                    <li>✓ Lưu trữ thế giới vĩnh viễn không giới hạn</li>
                    <li>✓ Hiệu năng GPU tối đa và chơi offline</li>
                  </ul>
                  <button
                    type="button"
                    className="game-btn game-btn-secondary full-width"
                    onClick={() => setActiveTab('desktop')}
                  >
                    Xem chi tiết bản Desktop
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Panel: Desktop Software Showcase */}
          <section className={`launcher-panel-card ${activeTab === 'desktop' ? 'active-panel' : 'hidden-panel'}`} aria-labelledby="panel-desktop-title">
            <header className="launcher-panel-header">
              <h2 id="panel-desktop-title">💻 Bản Phần Mềm Chơi Game Cho Máy Tính</h2>
              <p className="panel-sub">Được xây dựng cho người chơi muốn chất lượng đồ họa cao nhất và trải nghiệm mượt mà không phụ thuộc trình duyệt.</p>
            </header>
            <div className="launcher-panel-body">
              <div className="desktop-features-list">
                <div className="desktop-feature-item">
                  <span className="feature-icon">🚀</span>
                  <div>
                    <strong>Đồ Họa Độ Chi Tiết Cao (2K / 4K / 8K)</strong>
                    <p>Mở khóa các gói texture Poly Haven nguyên bản với bản đồ bump, normal và độ phân giải cực đại.</p>
                  </div>
                </div>
                <div className="desktop-feature-item">
                  <span className="feature-icon">🔄</span>
                  <div>
                    <strong>Cơ Chế Tự Động Cập Nhật Ngầm (Background Auto-Update)</strong>
                    <p>Mỗi khi nhà phát triển sửa code hoặc thêm tính năng, phần mềm tự động phát hiện và cập nhật êm dịu mà không làm gián đoạn màn chơi.</p>
                  </div>
                </div>
                <div className="desktop-feature-item">
                  <span className="feature-icon">💾</span>
                  <div>
                    <strong>Hệ Thống Bản Lưu Cục Bộ Vĩnh Viễn</strong>
                    <p>Lưu hàng trăm thế giới lớn (60x60) với biên niên sử hàng ngàn ngày mà không lo bị trình duyệt xóa cache.</p>
                  </div>
                </div>
                <div className="desktop-feature-item">
                  <span className="feature-icon">🎮</span>
                  <div>
                    <strong>Chơi Offline Hoàn Toàn &amp; Tối Ưu GPU</strong>
                    <p>Chạy độc lập không cần mạng Internet, hỗ trợ toàn màn hình native và tần số quét 144Hz+.</p>
                  </div>
                </div>
              </div>

              <div className="desktop-download-actions">
                <span className="badge-pill badge-era">Phiên bản Desktop v0.1.6 Alpha</span>
                <p>Hỗ trợ Windows 10/11, macOS và Linux. Đã tối ưu hóa tài nguyên 3D và hệ thống âm thanh.</p>
              </div>
            </div>
            <footer className="launcher-panel-footer">
              <a href={appPath('/play')} className="game-btn game-btn-primary">
                ▶ Chơi thử trước trên Web (1K)
              </a>
            </footer>
          </section>

          {/* Panel: New Game & Scenarios */}
          <section className={`launcher-panel-card ${activeTab === 'new-game' ? 'active-panel' : 'hidden-panel'}`} aria-labelledby="panel-new-title">
            <header className="launcher-panel-header">
              <h2 id="panel-new-title">✦ Chọn Bản Đồ Khởi Đầu Hoặc Tùy Biến</h2>
              <p className="panel-sub">Lựa chọn một trong 5 kịch bản thế giới đặc sắc để chơi thử ngay trên Web.</p>
            </header>
            <div className="launcher-panel-body">
              {/* Scenario Cards Grid */}
              <div className="scenarios-grid">
                {STARTER_SCENARIOS.map((scenario) => {
                  const isSelected = selectedScenario?.id === scenario.id
                  return (
                    <div
                      key={scenario.id}
                      className={`scenario-card ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => handleSelectScenario(scenario)}
                    >
                      <div className="scenario-card-top">
                        <span className="scenario-icon">{scenario.icon}</span>
                        <span className="scenario-difficulty-badge" style={{ borderColor: scenario.accentColor, color: scenario.accentColor }}>
                          {scenario.difficultyLabel}
                        </span>
                      </div>
                      <h3 className="scenario-name">{scenario.name}</h3>
                      <p className="scenario-tagline">{scenario.tagline}</p>
                      <p className="scenario-blessing">✦ {scenario.initialBlessing}</p>
                      <button
                        type="button"
                        className="game-btn game-btn-primary scenario-play-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStartScenarioDirect(scenario)
                        }}
                      >
                        ▶ Chơi thử kịch bản này
                      </button>
                    </div>
                  )
                })}
              </div>

              <div className="game-pause-divider" style={{ margin: '24px 0' }} />

              <h3 style={{ color: 'var(--sun-strong)', margin: '0 0 12px', fontSize: '1.05rem' }}>
                🎲 Tự do tùy biến tham số thế giới
              </h3>

              <div className="game-form-group">
                <label htmlFor="input-seed">Hạt giống thế giới (Seed):</label>
                <div className="game-input-row">
                  <input
                    id="input-seed"
                    type="text"
                    className="game-text-input"
                    value={newSeed}
                    onChange={(e) => {
                      setNewSeed(e.target.value)
                      setSelectedScenario(null)
                    }}
                    maxLength={64}
                  />
                  <button type="button" className="game-btn game-btn-secondary" onClick={handleRandomSeed}>Ngẫu nhiên</button>
                </div>
              </div>

              <div className="game-form-row">
                <div className="game-form-group">
                  <label htmlFor="select-size">Kích thước bản đồ:</label>
                  <select
                    id="select-size"
                    className="game-select-input"
                    value={newSize}
                    onChange={(e) => setNewSize(Number(e.target.value))}
                  >
                    <option value={28}>Nhỏ (28x28)</option>
                    <option value={36}>Vừa (36x36)</option>
                    <option value={48}>Tiêu chuẩn (48x48)</option>
                    <option value={60}>Rộng lớn (60x60)</option>
                  </select>
                </div>

                <div className="game-form-group">
                  <label htmlFor="select-climate">Khí hậu toàn cõi:</label>
                  <select
                    id="select-climate"
                    className="game-select-input"
                    value={newClimate}
                    onChange={(e) => setNewClimate(e.target.value as Climate)}
                  >
                    <option value="ôn hòa">Ôn hòa (Cân bằng đất và rừng)</option>
                    <option value="ấm">Nhiệt đới (Ấm áp, nhiều mưa và cây cỏ)</option>
                    <option value="lạnh">Hàn đới (Lạnh giá, nhiều tuyết và núi băng)</option>
                  </select>
                </div>
              </div>

              <div className="game-form-row">
                <div className="game-form-group">
                  <label htmlFor="range-water">Mực nước biển ({Math.round(newWater * 100)}%):</label>
                  <input
                    id="range-water"
                    type="range"
                    min="0.2"
                    max="0.8"
                    step="0.02"
                    value={newWater}
                    onChange={(e) => setNewWater(Number(e.target.value))}
                  />
                </div>

                <div className="game-form-group">
                  <label htmlFor="range-res">Mật độ tài nguyên ({Math.round(newResources * 100)}%):</label>
                  <input
                    id="range-res"
                    type="range"
                    min="0.2"
                    max="1.0"
                    step="0.05"
                    value={newResources}
                    onChange={(e) => setNewResources(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
            <footer className="launcher-panel-footer">
              <button type="button" className="game-btn game-btn-primary" onClick={handleStartCustomWorld}>▶ Khởi sinh thế giới này</button>
            </footer>
          </section>

          {/* Panel: Saves */}
          <section className={`launcher-panel-card ${activeTab === 'saves' ? 'active-panel' : 'hidden-panel'}`} aria-labelledby="panel-save-title">
            <header className="launcher-panel-header">
              <h2 id="panel-save-title">💾 Quản Lý Bản Lưu Trữ</h2>
              <p className="panel-sub">Lưu trữ và phục hồi các thế giới bạn đã sáng tạo.</p>
            </header>
            <div className="launcher-panel-body">
              {saveNotice && <div className="game-alert-banner">{saveNotice}</div>}
              <div className="game-save-slot">
                <div className="save-slot-info">
                  <strong>Bản lưu trên trình duyệt (Local Slot)</strong>
                  <span>{hasSave ? 'Đang có dữ liệu phiên chơi' : 'Chưa có bản lưu nào'}</span>
                </div>
                <div className="save-slot-actions">
                  <button
                    type="button"
                    className="game-btn game-btn-primary"
                    onClick={() => setIsSaveModalOpen(true)}
                  >
                    Xem tất cả ({listSaveSlots().length} slots)
                  </button>
                  {hasSave && (
                    <button type="button" className="game-btn game-btn-secondary" onClick={handleExportSave}>
                      Xuất tệp (.save)
                    </button>
                  )}
                  <label className="game-btn game-btn-secondary file-label">
                    Nhập tệp (.save)
                    <input type="file" accept=".save,.json,text/plain" onChange={handleImportSave} hidden />
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* Panel: Settings & Graphics */}
          <section className={`launcher-panel-card ${activeTab === 'settings' ? 'active-panel' : 'hidden-panel'}`} aria-labelledby="panel-settings-title">
            <header className="launcher-panel-header">
              <h2 id="panel-settings-title">⚙ Cài Đặt Hệ Thống &amp; Đồ Họa</h2>
              <p className="panel-sub">Độ phân giải texture độc lập với chất lượng kết xuất.</p>
            </header>
            <div className="launcher-panel-body">
              <div className="settings-grid">
                <div className="settings-card">
                  <strong>Gói Web 1K</strong>
                  <p>Bản chơi thử nhẹ, tối ưu bộ nhớ cho trình duyệt Web.</p>
                  <span className="badge-available">Có sẵn</span>
                </div>
                <div className="settings-card">
                  <strong>Gói Desktop 2K / 4K</strong>
                  <p>Dành cho ứng dụng máy tính với texture độ chi tiết cao.</p>
                  <span className="badge-coming-soon">Sắp ra mắt</span>
                </div>
                <div className="settings-card">
                  <strong>Gói Cinema 8K</strong>
                  <p>Dành cho máy cấu hình mạnh và chế độ chụp ảnh điện ảnh.</p>
                  <span className="badge-coming-soon">Sắp ra mắt</span>
                </div>
              </div>
            </div>
          </section>

          {/* Panel: Profile */}
          <section
            id="player-account"
            className={`launcher-panel-card ${activeTab === 'profile' ? 'active-panel' : 'hidden-panel'}`}
            aria-labelledby="panel-profile-title"
          >
            <header className="launcher-panel-header">
              <h2 id="panel-profile-title">👤 Hồ sơ Đấng Sáng Tạo</h2>
              <p className="panel-sub">Hồ sơ tùy chọn trên thiết bị. Chơi ngay; đăng nhập khi bạn muốn giữ tên người chơi trong phiên này.</p>
            </header>
            <div className="launcher-panel-body">
              <PlayerAccountPanel className="marketing-account-card" />
            </div>
          </section>

          {/* Panel: Credits */}
          <section className={`launcher-panel-card ${activeTab === 'credits' ? 'active-panel' : 'hidden-panel'}`} aria-labelledby="panel-credits-title">
            <header className="launcher-panel-header">
              <h2 id="panel-credits-title">📜 Thông Tin &amp; Bản Quyền</h2>
              <p className="panel-sub">Aetheria: World Shaper và các tài nguyên mở.</p>
            </header>
            <div className="launcher-panel-body">
              <div className="credits-block">
                <h3>Tài nguyên Poly Haven (CC0 Public Domain)</h3>
                <p>{POLY_HAVEN_CREDIT}</p>
                <p>Trang chủ Poly Haven: <a href={POLY_HAVEN_URL} target="_blank" rel="noreferrer" className="game-link">{POLY_HAVEN_URL}</a></p>
              </div>
              <div className="credits-block">
                <h3>Các Gói Sản Phẩm</h3>
                <div className="offers-list">
                  {COMMERCIAL_OFFERS.map((offer) => (
                    <div key={offer.id} className="offer-item">
                      <strong>{offer.title}</strong> — <span>{offer.summary}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>

      {/* Multi-Slot Save Manager Modal */}
      <SaveSlotManagerModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
      />
    </main>
  )
}
