import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { SimulationPanel } from './components/SimulationPanel'
import { ToolDock } from './components/ToolDock'
import { WorldControls } from './components/WorldControls'
import type { HoveredTile, RenderStats } from './renderer/WorldRenderer'
import { advanceSimulation, createSimulation, setSimulationSpeed, spawnSettlers, toggleSimulationPause, triggerStorm } from './simulation/engine'
import type { SimulationSpeed, SimulationState } from './simulation/types'
import { applyTerrainTool, applyTileCommand, revertTileCommand } from './world/commands'
import { generateWorld } from './world/generator'
import type { HeatmapMode, TileMutationCommand, ToolId, World, WorldConfig } from './world/types'
import { DEFAULT_WORLD_CONFIG, TERRAIN_TOOL_LABELS } from './world/types'

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

interface GameSession {
  world: World
  simulation: SimulationState
  undoStack: TileMutationCommand[]
  redoStack: TileMutationCommand[]
}

function createSession(config: WorldConfig): GameSession {
  const world = generateWorld(config)
  return { world, simulation: createSimulation(world), undoStack: [], redoStack: [] }
}

function randomSeed(): string {
  const values = new Uint32Array(2)
  crypto.getRandomValues(values)
  return `aetheria-${values[0]?.toString(36)}-${values[1]?.toString(36)}`
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement
}

export default function App(): JSX.Element {
  const [session, setSession] = useState<GameSession>(() => createSession({ ...DEFAULT_WORLD_CONFIG }))
  const [draft, setDraft] = useState<WorldConfig>(() => ({ ...DEFAULT_WORLD_CONFIG }))
  const [tool, setTool] = useState<ToolId>('raise')
  const [heatmap, setHeatmap] = useState<HeatmapMode>('địa hình')
  const [hoveredTile, setHoveredTile] = useState<HoveredTile | undefined>(undefined)
  const [selectedTileIndex, setSelectedTileIndex] = useState<number | undefined>(undefined)
  const [renderStats, setRenderStats] = useState<RenderStats>({ fps: 0, drawCalls: 0, triangles: 0 })
  const [notice, setNotice] = useState('Thế giới đã sẵn sàng. Chọn một quyền năng rồi nhấp lên bản đồ.')
  const [photoSignal, setPhotoSignal] = useState(0)
  const sessionRef = useRef(session)

  useEffect(() => {
    sessionRef.current = session
  }, [session])

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
      const current = sessionRef.current

      if (!document.hidden && !current.simulation.paused && current.simulation.speed > 0) {
        accumulator += elapsed * current.simulation.speed
        const ticks = Math.min(12, Math.floor(accumulator))
        if (ticks > 0) {
          accumulator -= ticks
          setSession((active) => ({
            ...active,
            simulation: advanceSimulation(active.simulation, active.world, ticks),
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

  const resetWorld = useCallback((config: WorldConfig, message: string): void => {
    const next = createSession(config)
    setSession(next)
    setSelectedTileIndex(undefined)
    setHoveredTile(undefined)
    setNotice(message)
  }, [])

  const handleGenerate = useCallback((): void => {
    resetWorld(draft, `Đã tái tạo thế giới từ seed “${draft.seed.trim() || 'aetheria-bình-minh'}”.`)
  }, [draft, resetWorld])

  const handleRandomWorld = useCallback((): void => {
    const nextDraft = { ...draft, seed: randomSeed() }
    setDraft(nextDraft)
    resetWorld(nextDraft, 'Một thế giới mới vừa được đánh thức từ seed ngẫu nhiên.')
  }, [draft, resetWorld])

  const handleCopySeed = useCallback((): void => {
    void navigator.clipboard.writeText(sessionRef.current.world.config.seed)
      .then(() => setNotice('Đã sao chép seed. Bạn có thể dùng seed này để tái tạo đúng thế giới.'))
      .catch(() => setNotice('Không thể truy cập clipboard; seed hiện tại vẫn hiển thị trong bảng Mầm thế giới.'))
  }, [])

  const handleTileActivate = useCallback((tileIndex: number): void => {
    setSelectedTileIndex(tileIndex)
    setSession((current) => {
      if (tool === 'settler') {
        setNotice('Người lữ hành đã tìm đến làng khởi đầu.')
        return { ...current, simulation: spawnSettlers(current.simulation) }
      }
      if (tool === 'storm') {
        setNotice('Mây giông đang tập hợp. Hãy quan sát tác động lên lương thực và hạnh phúc.')
        return { ...current, simulation: triggerStorm(current.simulation) }
      }

      const result = applyTerrainTool(current.world, tileIndex, tool, TERRAIN_TOOL_LABELS[tool])
      if (!result) {
        setNotice('Quyền năng này không thể thay đổi ô đất đang chọn.')
        return current
      }
      setNotice(`${result.command.label}: thay đổi đã được lưu vào lịch sử.`)
      return {
        ...current,
        world: result.world,
        undoStack: [...current.undoStack, result.command].slice(-24),
        redoStack: [],
      }
    })
  }, [tool])

  const handleUndo = useCallback((): void => {
    setSession((current) => {
      const command = current.undoStack.at(-1)
      if (!command) return current
      setNotice(`Đã hoàn tác: ${command.label}.`)
      return {
        ...current,
        world: revertTileCommand(current.world, command),
        undoStack: current.undoStack.slice(0, -1),
        redoStack: [command, ...current.redoStack],
      }
    })
  }, [])

  const handleRedo = useCallback((): void => {
    setSession((current) => {
      const command = current.redoStack[0]
      if (!command) return current
      setNotice(`Đã làm lại: ${command.label}.`)
      return {
        ...current,
        world: applyTileCommand(current.world, command),
        undoStack: [...current.undoStack, command],
        redoStack: current.redoStack.slice(1),
      }
    })
  }, [])

  const handlePauseToggle = useCallback((): void => {
    setSession((current) => ({ ...current, simulation: toggleSimulationPause(current.simulation) }))
  }, [])

  const handleSpeedChange = useCallback((speed: SimulationSpeed): void => {
    setSession((current) => {
      const updated = setSimulationSpeed(current.simulation, speed)
      return { ...current, simulation: { ...updated, paused: false } }
    })
  }, [])

  const handlePhotoReady = useCallback((dataUrl: string): void => {
    const seed = sessionRef.current.world.config.seed.replace(/[^\p{L}\p{N}-]+/gu, '-').slice(0, 36)
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `aetheria-${seed || 'world'}-tick-${sessionRef.current.simulation.tick}.png`
    link.click()
    setNotice('Ảnh PNG của thế giới đã được tải xuống.')
  }, [])

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (isTextEntryTarget(event.target)) return
      if (event.key === ' ') {
        event.preventDefault()
        handlePauseToggle()
        return
      }
      if (event.key.toLowerCase() === 'z' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        handleUndo()
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
  }, [handlePauseToggle, handleRedo, handleUndo])

  const selectedTile = selectedTileIndex === undefined
    ? undefined
    : session.world.tiles[selectedTileIndex]
      ? { index: selectedTileIndex, tile: session.world.tiles[selectedTileIndex] }
      : undefined
  const lensTile = hoveredTile ?? selectedTile
  const day = Math.floor(session.simulation.tick / 6) + 1

  return (
    <main className="game-shell">
      <a className="skip-link" href="#game-map">Bỏ qua bảng điều khiển, đến bản đồ</a>
      <header className="game-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">A</span>
          <div>
            <p>Aetheria</p>
            <h1>World Shaper</h1>
          </div>
        </div>
        <div className="header-status" aria-label="Trạng thái phiên chơi">
          <span>Ngày {day}</span>
          <span>{session.simulation.paused ? 'Đã dừng' : `${session.simulation.speed}× thời gian`}</span>
          <span className={session.simulation.activeStorm ? 'storm-status' : ''}>{session.simulation.activeStorm ? 'Mưa lớn' : 'Khí hậu ổn định'}</span>
        </div>
      </header>

      <div className="game-layout">
        <aside className="left-rail">
          <WorldControls
            draft={draft}
            activeSeed={session.world.config.seed}
            onDraftChange={setDraft}
            onGenerate={handleGenerate}
            onRandomWorld={handleRandomWorld}
            onCopySeed={handleCopySeed}
          />
          <ToolDock
            activeTool={tool}
            onToolChange={setTool}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={session.undoStack.length > 0}
            canRedo={session.redoStack.length > 0}
          />
        </aside>

        <section id="game-map" className="world-stage" aria-label="Bản đồ và điều khiển thế giới">
          <Suspense fallback={worldLoadingFallback}>
            <WorldViewport
              world={session.world}
              simulation={session.simulation}
              tool={tool}
              heatmap={heatmap}
              photoSignal={photoSignal}
              onTileHover={setHoveredTile}
              onTileActivate={handleTileActivate}
              onStats={setRenderStats}
              onPhotoReady={handlePhotoReady}
            />
          </Suspense>
          <div className="map-topline" aria-hidden="true">
            <span>Seed · {session.world.config.seed}</span>
            <span>{session.world.config.size} × {session.world.config.size} ô</span>
          </div>
          <div className="map-instructions">
            <strong>{TERRAIN_TOOL_LABELS[tool as keyof typeof TERRAIN_TOOL_LABELS] ?? (tool === 'settler' ? 'Thả cư dân' : 'Gọi mưa lớn')}</strong>
            <span>Nhấp bản đồ để dùng · kéo để xoay · cuộn để thu phóng</span>
          </div>
          <div className="performance-badge" title="Chỉ số render gần đúng, cập nhật mỗi giây">
            {renderStats.fps || '—'} FPS · {renderStats.drawCalls} lệnh vẽ
          </div>
        </section>

        <SimulationPanel
          world={session.world}
          simulation={session.simulation}
          selectedTile={lensTile}
          heatmap={heatmap}
          onHeatmapChange={setHeatmap}
          onPauseToggle={handlePauseToggle}
          onSpeedChange={handleSpeedChange}
          onPhoto={() => setPhotoSignal((current) => current + 1)}
        />
      </div>

      <footer className="game-footer">
        <span>Không dùng asset bên thứ ba · thế giới tái tạo quyết định theo seed</span>
        <span>Phím: 1–8 quyền năng · Space dừng/chạy · Ctrl/Cmd+Z hoàn tác</span>
      </footer>
      <p className="sr-only" aria-live="polite" aria-atomic="true">{notice}</p>
    </main>
  )
}
