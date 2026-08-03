import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, JSX } from 'react'
import { GameDrawer } from './components/GameDrawer'
import { GameErrorBoundary } from './components/GameErrorBoundary'
import { FullscreenButton } from './components/FullscreenButton'
import { isInteractiveShortcutTarget } from './components/keyboard'
import { SimulationPanel } from './components/SimulationPanel'
import { ToolDock } from './components/ToolDock'
import { WorldControls } from './components/WorldControls'
import { applyTerrainChange, commitGameChange, createGameState, recreateWorld, redoGameChange, undoGameChange } from './game/session'
import { decodeSave, loadFromLocalStorage, MAX_SAVE_BYTES, saveToLocalStorage, serializeSave } from './game/save'
import type { HoveredTile, RenderStats } from './renderer/WorldRenderer'
import { QUALITY_LABELS } from './renderer/quality'
import type { QualityProfile } from './renderer/quality'
import { advanceSimulation, setSimulationSpeed, spawnSettlersAt, toggleSimulationPause, triggerStorm } from './simulation/engine'
import type { SimulationSpeed } from './simulation/types'
import { applyTerrainTool } from './world/commands'
import { DEFAULT_WORLD_CONFIG, TERRAIN_TOOL_LABELS } from './world/types'
import type { HeatmapMode, ToolId, WorldConfig } from './world/types'

const WorldViewport = lazy(async () => {
  const module = await import('./components/WorldViewport')
  return { default: module.WorldViewport }
})

const worldLoadingFallback = (
  <div className="world-loading" role="status" aria-live="polite">
    <span className="eyebrow">Đang dựng địa hình</span>
    <strong>Gọi những lớp đất đầu tiên…</strong>
  </div>
)

type DrawerSide = 'left' | 'right' | null

function initialConfig(): WorldConfig {
  const fromUrl = new URLSearchParams(window.location.search).get('seed')
  return { ...DEFAULT_WORLD_CONFIG, ...(fromUrl ? { seed: fromUrl } : {}) }
}

function randomSeed(): string {
  const values = new Uint32Array(2)
  crypto.getRandomValues(values)
  return `aetheria-${values[0]?.toString(36)}-${values[1]?.toString(36)}`
}

function safeFileSegment(seed: string): string {
  return seed.replace(/[^\p{L}\p{N}-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 36) || 'world'
}

function triggerDownload(href: string, filename: string): void {
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
}

function toolInstruction(tool: ToolId): string {
  if (tool === 'storm') return 'Mưa lớn là tác động toàn cầu — dùng nút “Gọi mưa toàn cõi” trong thanh công cụ.'
  if (tool === 'settler') return 'Nhấp một ô đất khô để nhập cư dân vào làng gần đó hoặc dựng một tiền đồn mới.'
  return 'Nhấp bản đồ để dùng quyền năng · kéo để xoay · cuộn để thu phóng.'
}

export default function App(): JSX.Element {
  const [game, setGame] = useState(() => createGameState(initialConfig()))
  const [draft, setDraft] = useState<WorldConfig>(() => initialConfig())
  const [tool, setTool] = useState<ToolId>('raise')
  const [heatmap, setHeatmap] = useState<HeatmapMode>('địa hình')
  const [quality, setQuality] = useState<QualityProfile>('auto')
  const [hoveredTile, setHoveredTile] = useState<HoveredTile | undefined>(undefined)
  const [selectedTileIndex, setSelectedTileIndex] = useState<number | undefined>(undefined)
  const [renderStats, setRenderStats] = useState<RenderStats>({ fps: 0, drawCalls: 0, triangles: 0 })
  const [notice, setNotice] = useState('Thế giới đã sẵn sàng. Chọn một quyền năng rồi nhấp lên bản đồ.')
  const [photoSignal, setPhotoSignal] = useState(0)
  const [openDrawer, setOpenDrawer] = useState<DrawerSide>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenFallback, setFullscreenFallback] = useState(false)
  const gameRef = useRef(game)
  const importRef = useRef<HTMLInputElement>(null)
  const activeImportRef = useRef<FileReader | null>(null)
  const leftToggleRef = useRef<HTMLButtonElement>(null)
  const rightToggleRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    gameRef.current = game
  }, [game])

  useEffect(() => () => activeImportRef.current?.abort(), [])

  useEffect(() => {
    const seed = game.session.world.config.seed
    const url = new URL(window.location.href)
    url.searchParams.set('seed', seed)
    window.history.replaceState(null, '', url)
  }, [game.session.world.config.seed])

  useEffect(() => {
    if (!notice) return undefined
    const timeout = window.setTimeout(() => setNotice(''), 4800)
    return () => window.clearTimeout(timeout)
  }, [notice])

  useEffect(() => {
    let frameId = 0
    let previousTime = performance.now()
    let accumulator = 0
    const advance = (timestamp: number): void => {
      const elapsed = Math.min((timestamp - previousTime) / 1000, 0.25)
      previousTime = timestamp
      const current = gameRef.current
      if (!document.hidden && !current.session.simulation.paused && current.session.simulation.speed > 0) {
        accumulator += elapsed * current.session.simulation.speed
        const ticks = Math.min(12, Math.floor(accumulator))
        if (ticks > 0) {
          accumulator -= ticks
          setGame((active) => ({
            ...active,
            session: { ...active.session, simulation: advanceSimulation(active.session.simulation, active.session.world, ticks) },
          }))
        }
      } else {
        accumulator = 0
      }
      frameId = window.requestAnimationFrame(advance)
    }
    frameId = window.requestAnimationFrame(advance)
    return () => window.cancelAnimationFrame(frameId)
  }, [])

  const closeDrawer = useCallback((side?: Exclude<DrawerSide, null>): void => {
    setOpenDrawer((current) => {
      const closing = side ?? current
      if (closing) {
        window.requestAnimationFrame(() => (closing === 'left' ? leftToggleRef.current : rightToggleRef.current)?.focus())
      }
      return null
    })
  }, [])

  const toggleDrawer = useCallback((side: Exclude<DrawerSide, null>): void => {
    setOpenDrawer((current) => current === side ? null : side)
  }, [])

  const recreate = useCallback((config: WorldConfig, message: string): void => {
    setGame((current) => recreateWorld(current, config, message))
    setDraft(config)
    setSelectedTileIndex(undefined)
    setHoveredTile(undefined)
    setNotice(message)
  }, [])

  const handleGenerate = useCallback((): void => {
    recreate(draft, `Đã tái tạo thế giới từ seed “${draft.seed.trim() || 'aetheria-bình-minh'}”.`)
  }, [draft, recreate])

  const handleRandomWorld = useCallback((): void => {
    const nextDraft = { ...draft, seed: randomSeed() }
    recreate(nextDraft, 'Một thế giới mới vừa được đánh thức từ seed ngẫu nhiên.')
  }, [draft, recreate])

  const handleCopySeed = useCallback((): void => {
    void navigator.clipboard.writeText(gameRef.current.session.world.config.seed)
      .then(() => setNotice('Đã sao chép seed. Bạn có thể chia sẻ liên kết hoặc tái tạo đúng thế giới này.'))
      .catch(() => setNotice('Không thể truy cập clipboard; seed hiện tại vẫn hiển thị trong Mầm thế giới.'))
  }, [])

  const handleTileActivate = useCallback((tileIndex: number): void => {
    setSelectedTileIndex(tileIndex)
    if (tool === 'storm') {
      setNotice('Mưa lớn là tác động toàn cầu; hãy dùng nút “Gọi mưa toàn cõi” trong thanh công cụ.')
      return
    }
    setGame((current) => {
      if (tool === 'settler') {
        const result = spawnSettlersAt(current.session.simulation, current.session.world, tileIndex)
        if (!result.ok) {
          setNotice(result.reason)
          return current
        }
        const world = result.createdVillage
          ? { ...current.session.world, villages: [...current.session.world.villages, result.villageSite], revision: current.session.world.revision + 1 }
          : current.session.world
        const label = result.createdVillage ? `Lập ${result.villageSite.name}` : `Đón cư dân đến ${result.villageSite.name}`
        setNotice(result.createdVillage ? `Đã lập ${result.villageSite.name}.` : `Cư dân đã nhập vào ${result.villageSite.name}.`)
        return commitGameChange(current, { world, simulation: result.simulation }, label)
      }
      const result = applyTerrainTool(current.session.world, tileIndex, tool, TERRAIN_TOOL_LABELS[tool])
      if (!result) {
        setNotice('Quyền năng này không thể thay đổi ô đất đang chọn.')
        return current
      }
      setNotice(`${result.command.label}: thay đổi đã được lưu vào lịch sử.`)
      return applyTerrainChange(current, result.command, result.world)
    })
  }, [tool])

  const handleGlobalStorm = useCallback((): void => {
    setGame((current) => commitGameChange(
      current,
      { ...current.session, simulation: triggerStorm(current.session.simulation) },
      'Gọi mưa lớn toàn cõi',
    ))
    setNotice('Mưa lớn đang ảnh hưởng toàn bộ Aetheria trong 18 tick.')
  }, [])

  const handleUndo = useCallback((): void => {
    setGame((current) => {
      const next = undoGameChange(current)
      if (next === current) {
        setNotice('Chưa có thao tác nào để hoàn tác.')
        return current
      }
      setNotice(`Đã hoàn tác: ${current.undoStack.at(-1)?.label ?? 'thao tác gần nhất'}.`)
      return next
    })
  }, [])

  const handleRedo = useCallback((): void => {
    setGame((current) => {
      const next = redoGameChange(current)
      if (next === current) {
        setNotice('Chưa có thao tác nào để làm lại.')
        return current
      }
      setNotice(`Đã làm lại: ${current.redoStack[0]?.label ?? 'thao tác gần nhất'}.`)
      return next
    })
  }, [])

  const handlePauseToggle = useCallback((): void => {
    setGame((current) => ({ ...current, session: { ...current.session, simulation: toggleSimulationPause(current.session.simulation) } }))
  }, [])

  const handleSpeedChange = useCallback((speed: SimulationSpeed): void => {
    setGame((current) => {
      const updated = setSimulationSpeed(current.session.simulation, speed)
      return { ...current, session: { ...current.session, simulation: { ...updated, paused: false } } }
    })
  }, [])

  const handlePhotoReady = useCallback((dataUrl: string): void => {
    const seed = safeFileSegment(gameRef.current.session.world.config.seed)
    triggerDownload(dataUrl, `aetheria-${seed}-tick-${gameRef.current.session.simulation.tick}.png`)
    setNotice('Ảnh PNG sắc nét của thế giới đã được tải xuống.')
  }, [])

  const handleSave = useCallback((): void => {
    try {
      saveToLocalStorage(gameRef.current)
      setNotice('Đã lưu thế giới trên thiết bị này. Không có dữ liệu nào được gửi đi.')
    } catch {
      setNotice('Không thể lưu cục bộ; hãy dùng Xuất JSON để giữ một bản sao.')
    }
  }, [])

  const hydrateGame = useCallback((raw: string): void => {
    const result = decodeSave(raw)
    if (!result.ok) {
      setNotice(result.reason)
      return
    }
    setGame(result.game)
    setDraft(result.game.session.world.config)
    setSelectedTileIndex(undefined)
    setHoveredTile(undefined)
    setNotice('Đã nạp bản lưu hợp lệ.')
  }, [])

  const handleLoad = useCallback((): void => {
    const result = loadFromLocalStorage()
    if (!result.ok) {
      setNotice(result.reason)
      return
    }
    setGame(result.game)
    setDraft(result.game.session.world.config)
    setNotice('Đã nạp bản lưu cục bộ.')
  }, [])

  const handleExport = useCallback((): void => {
    const blob = new Blob([serializeSave(gameRef.current)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    triggerDownload(url, `aetheria-${safeFileSegment(gameRef.current.session.world.config.seed)}.json`)
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNotice('Đã xuất bản lưu JSON cục bộ.')
  }, [])

  const handleImportFile = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    event.target.value = ''
    activeImportRef.current?.abort()
    activeImportRef.current = null
    if (!file) return
    if (file.size > MAX_SAVE_BYTES) {
      setNotice('Tệp JSON quá lớn để nạp an toàn. Hãy chọn bản xuất Aetheria dưới 2.5 MB.')
      return
    }
    const reader = new FileReader()
    activeImportRef.current = reader
    reader.onload = () => {
      if (activeImportRef.current === reader) activeImportRef.current = null
      if (typeof reader.result === 'string') hydrateGame(reader.result)
      else setNotice('Không thể đọc tệp JSON đã chọn.')
    }
    reader.onerror = () => {
      if (activeImportRef.current === reader) activeImportRef.current = null
      if (reader.error?.name !== 'AbortError') setNotice('Không thể đọc tệp JSON đã chọn.')
    }
    reader.onabort = () => {
      if (activeImportRef.current === reader) activeImportRef.current = null
    }
    reader.readAsText(file)
  }, [hydrateGame])

  const toggleFullscreen = useCallback((): void => {
    if (fullscreenFallback) {
      setFullscreenFallback(false)
      setNotice('Đã thoát chế độ toàn màn hình dự phòng.')
      return
    }
    if (!document.fullscreenEnabled) {
      setFullscreenFallback((value) => !value)
      setNotice('Trình duyệt không hỗ trợ Fullscreen API; đã dùng chế độ toàn màn hình của game.')
      return
    }
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => setNotice('Không thể thoát chế độ toàn màn hình.'))
    } else {
      void document.documentElement.requestFullscreen().catch(() => {
        setFullscreenFallback(true)
        setNotice('Trình duyệt chặn Fullscreen API; game vẫn dùng lớp phủ toàn màn hình.')
      })
    }
  }, [fullscreenFallback])

  useEffect(() => {
    const onFullscreenChange = (): void => {
      const active = document.fullscreenElement === document.documentElement
      setIsFullscreen(active)
      if (active) setFullscreenFallback(false)
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && openDrawer) {
        event.preventDefault()
        closeDrawer(openDrawer)
        return
      }
      if (isInteractiveShortcutTarget(event.target)) return
      if (event.key === ' ') {
        event.preventDefault()
        handlePauseToggle()
        return
      }
      if (event.key.toLowerCase() === 'z' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        if (event.shiftKey) handleRedo()
        else handleUndo()
        return
      }
      if (event.key.toLowerCase() === 'y' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        handleRedo()
        return
      }
      const numeric = Number(event.key)
      const tools: ToolId[] = ['raise', 'lower', 'water', 'forest', 'fertile', 'barren', 'settler', 'storm']
      if (numeric >= 1 && numeric <= tools.length) {
        const nextTool = tools[numeric - 1]
        if (nextTool) setTool(nextTool)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [closeDrawer, handlePauseToggle, handleRedo, handleUndo, openDrawer])

  const { session } = game
  const selectedTile = selectedTileIndex === undefined ? undefined : session.world.tiles[selectedTileIndex]
  const lensTile = hoveredTile ?? (selectedTile ? { index: selectedTileIndex ?? 0, tile: selectedTile } : undefined)
  const day = Math.floor(session.simulation.tick / 6) + 1
  const fullscreenActive = isFullscreen || fullscreenFallback

  return (
    <main className={`game-shell ${fullscreenActive ? 'is-fullscreen-fallback' : ''}`}>
      <a className="skip-link" href="#game-map">Bỏ qua HUD, đến bản đồ</a>
      <section id="game-map" className="world-stage" aria-label="Bản đồ và điều khiển thế giới" tabIndex={-1}>
        <GameErrorBoundary>
          <Suspense fallback={worldLoadingFallback}>
            <WorldViewport
              world={session.world}
              simulation={session.simulation}
              tool={tool}
              heatmap={heatmap}
              quality={quality}
              photoSignal={photoSignal}
              onTileHover={setHoveredTile}
              onTileActivate={handleTileActivate}
              onStats={setRenderStats}
              onPhotoReady={handlePhotoReady}
              onPhotoError={setNotice}
            />
          </Suspense>
        </GameErrorBoundary>

        <div className="hud-layer" aria-label="HUD điều khiển game">
          <header className="hud-brand">
            <span className="brand-mark" aria-hidden="true">A</span>
            <div>
              <p>Aetheria</p>
              <h1>World Shaper</h1>
              <div className="hud-status"><span>Ngày {day}</span><span>{session.simulation.paused ? 'Đã dừng' : `${session.simulation.speed}× thời gian`}</span><span className={session.simulation.activeStorm ? 'storm-status' : ''}>{session.simulation.activeStorm ? 'Mưa lớn toàn cõi' : 'Trời quang'}</span></div>
            </div>
          </header>

          <div className="hud-actions">
            <span className="performance-badge" title="Chỉ số render gần đúng, cập nhật mỗi giây">{renderStats.fps || '—'} FPS · {renderStats.drawCalls} lệnh vẽ · {renderStats.triangles} tam giác</span>
            <label className="quality-select" htmlFor="quality-profile">Chất lượng<select id="quality-profile" value={quality} onChange={(event) => setQuality(event.target.value as QualityProfile)}>{(Object.keys(QUALITY_LABELS) as QualityProfile[]).map((profile) => <option key={profile} value={profile}>{QUALITY_LABELS[profile]}</option>)}</select></label>
            <FullscreenButton active={fullscreenActive} onToggle={toggleFullscreen} />
          </div>

          <button ref={leftToggleRef} type="button" className="drawer-toggle drawer-toggle-left" onClick={() => toggleDrawer('left')} aria-expanded={openDrawer === 'left'} aria-controls="world-controls-drawer" aria-label={openDrawer === 'left' ? 'Đóng điều khiển thế giới' : 'Mở điều khiển thế giới'}>☰ <span>Thế giới</span></button>
          <button ref={rightToggleRef} type="button" className="drawer-toggle drawer-toggle-right" onClick={() => toggleDrawer('right')} aria-expanded={openDrawer === 'right'} aria-controls="simulation-drawer" aria-label={openDrawer === 'right' ? 'Đóng mô phỏng' : 'Mở mô phỏng'}>◈ <span>Mô phỏng</span></button>

          {openDrawer === 'left' ? (
            <GameDrawer id="world-controls-drawer" label="Điều khiển thế giới" side="left" onClose={() => closeDrawer('left')}>
              <WorldControls draft={draft} activeSeed={session.world.config.seed} onDraftChange={setDraft} onGenerate={handleGenerate} onRandomWorld={handleRandomWorld} onCopySeed={handleCopySeed} onSave={handleSave} onLoad={handleLoad} onReset={() => recreate(session.world.config, 'Đã đặt lại thế giới hiện tại; bạn có thể hoàn tác thao tác này.')} onExport={handleExport} onImport={() => importRef.current?.click()} />
            </GameDrawer>
          ) : null}

          {openDrawer === 'right' ? (
            <GameDrawer id="simulation-drawer" label="Mô phỏng và biên niên sử" side="right" onClose={() => closeDrawer('right')}>
              <SimulationPanel world={session.world} simulation={session.simulation} selectedTile={lensTile} heatmap={heatmap} onHeatmapChange={setHeatmap} onPauseToggle={handlePauseToggle} onSpeedChange={handleSpeedChange} onPhoto={() => setPhotoSignal((current) => current + 1)} />
            </GameDrawer>
          ) : null}

          <div className="map-instructions"><strong>{tool === 'settler' ? 'Thả cư dân' : tool === 'storm' ? 'Mưa lớn toàn cõi' : TERRAIN_TOOL_LABELS[tool]}</strong><span>{toolInstruction(tool)}</span></div>
          <div className="seed-readout">Seed · {session.world.config.seed} · {session.world.config.size} × {session.world.config.size}</div>
          <div className="hud-tool-dock"><ToolDock activeTool={tool} onToolChange={setTool} onUndo={handleUndo} onRedo={handleRedo} canUndo={game.undoStack.length > 0} canRedo={game.redoStack.length > 0} onGlobalStorm={handleGlobalStorm} /></div>
        </div>
      </section>
      <input ref={importRef} className="sr-only" type="file" accept="application/json,.json" onChange={handleImportFile} aria-label="Nhập bản lưu JSON" />
      <p className="sr-only" aria-live="polite" aria-atomic="true">{notice}</p>
    </main>
  )
}
