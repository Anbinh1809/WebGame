import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, JSX } from 'react'
import { appPath } from './routes'
import { usePlayerAuth } from './auth/usePlayerAuth'
import { GameDrawer } from './components/GameDrawer'
import { GameErrorBoundary } from './components/GameErrorBoundary'
import { GamePauseMenu } from './components/GamePauseMenu'
import { FullscreenButton } from './components/FullscreenButton'
import { GraphicsSettings } from './components/GraphicsSettings'
import { TutorialOverlay } from './components/TutorialOverlay'
import { isInteractiveShortcutTarget } from './components/keyboard'
import { PlayerAccountPanel } from './components/PlayerAccountPanel'
import { SimulationPanel } from './components/SimulationPanel'
import { ToolDock } from './components/ToolDock'
import { WorldControls } from './components/WorldControls'
import { applyMapToolAction, developPrimaryVillageToolAction, resolveCouncilAction, submitPrimaryVillageKnowledgeAction, triggerGlobalStormAction } from './game/actions'
import { createGameState, recreateWorld, redoGameChange, undoGameChange } from './game/session'
import { SaveSlotManagerModal } from './components/SaveSlotManagerModal'
import { UpdateNotificationBanner } from './components/UpdateNotificationBanner'
import { getScenarioById } from './world/scenarios'
import { decodeSave, loadFromLocalStorage, MAX_SAVE_BYTES, serializeSave, loadGameFromSlot, saveGameToSlot } from './game/save'
import type { HoveredTile, RenderStats } from './renderer/WorldRenderer'
import { createGraphicsQualityOverrides, QUALITY_LABELS } from './renderer/quality'
import type { GraphicsQualityOverrides, QualityProfile } from './renderer/quality'
import type { MotionPreference } from './renderer/MotionPreference'
import { SoundDirector } from './runtime/SoundDirector'
import type { SoundCue } from './runtime/SoundDirector'
import { advanceSimulation, setSimulationSpeed, toggleSimulationPause } from './simulation/engine'
import type { SimulationSpeed } from './simulation/types'
import { DEFAULT_WORLD_CONFIG, TERRAIN_TOOL_LABELS } from './world/types'
import type { HeatmapMode, ToolId, WorldConfig } from './world/types'
import type { AssetPackQuality } from './assets/types'
import { probeDesktopPackAvailability } from './assets/desktopPackManifest'
import type { DesktopPackAvailability } from './assets/desktopPackManifest'
import { resolveDesktopAssetPackEntitlements } from './commerce/entitlements'
import type { AssetPackEntitlements } from './renderer/AssetPackManager'
import { ASSET_PACK_LABELS, assetPackForQualityProfile, GAME_EDITION, IS_DESKTOP_EDITION } from './runtime/edition'

const WorldViewport = lazy(async () => {
  const module = await import('./components/WorldViewport')
  return { default: module.WorldViewport }
})

const worldLoadingFallback = (
  <div className="world-loading" role="status" aria-live="polite">
    <span className="eyebrow">Đang dựng địa hình 3D</span>
    <strong>Khởi tạo thế giới Aetheria…</strong>
  </div>
)

type DrawerSide = 'left' | 'right' | null
type DrawerTrigger = 'world' | 'player' | 'simulation'

const EMPTY_DESKTOP_PACK_AVAILABILITY: DesktopPackAvailability = {
  'desktop-2k': false,
  'desktop-4k': false,
  'cinema-8k': false,
}

const PREFERENCE_KEYS = {
  motion: 'aetheria-motion-preference-v1',
  sound: 'aetheria-sound-enabled-v1',
  masterVolume: 'aetheria-master-volume-v1',
  musicVolume: 'aetheria-music-volume-v1',
  sfxVolume: 'aetheria-sfx-volume-v1',
  tutorial: 'aetheria-tutorial-seen-v1',
} as const

function readVolumePreference(key: string, fallback: number): number {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    const val = Number(raw)
    return Number.isFinite(val) && val >= 0 && val <= 1 ? val : fallback
  } catch {
    return fallback
  }
}

function readMotionPreference(): MotionPreference {
  try {
    const value = window.localStorage.getItem(PREFERENCE_KEYS.motion)
    return value === 'full' || value === 'reduced' ? value : 'system'
  } catch {
    return 'system'
  }
}

function readSoundEnabled(): boolean {
  try {
    return window.localStorage.getItem(PREFERENCE_KEYS.sound) !== 'false'
  } catch {
    return true
  }
}

function hasSeenTutorial(): boolean {
  try {
    return window.localStorage.getItem(PREFERENCE_KEYS.tutorial) === 'true'
  } catch {
    return false
  }
}

function writePreference(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Preferences are non-essential and remain usable for this session.
  }
}

function initialGameState(): ReturnType<typeof createGameState> {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
  const slotParam = params.get('slot')
  if (slotParam) {
    try {
      const slotResult = loadGameFromSlot(slotParam)
      if (slotResult.ok) return slotResult.game
    } catch {
      // Fallback
    }
  }

  const scenarioParam = params.get('scenario')
  if (scenarioParam) {
    const scenario = getScenarioById(scenarioParam)
    if (scenario) {
      return createGameState(scenario.config)
    }
  }

  const seedParam = params.get('seed')
  const config = { ...DEFAULT_WORLD_CONFIG, ...(seedParam ? { seed: seedParam } : {}) }
  return createGameState(config)
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
  return 'Nhấp bản đồ để dùng quyền năng · chuột phải/kéo để xoay · cuộn để thu phóng.'
}

export default function App(): JSX.Element {
  const { session: playerSession } = usePlayerAuth()
  const [game, setGame] = useState(() => initialGameState())
  const [draft, setDraft] = useState<WorldConfig>(() => game.session.world.config)
  const [tool, setTool] = useState<ToolId>('raise')
  const [heatmap, setHeatmap] = useState<HeatmapMode>('địa hình')
  const [quality, setQuality] = useState<QualityProfile>('auto')
  const [graphicsOverrides, setGraphicsOverrides] = useState<GraphicsQualityOverrides>(() => createGraphicsQualityOverrides())
  const [motionPreference, setMotionPreference] = useState<MotionPreference>(readMotionPreference)
  const [soundEnabled, setSoundEnabled] = useState(readSoundEnabled)
  const [masterVolume, setMasterVolume] = useState(() => readVolumePreference(PREFERENCE_KEYS.masterVolume, 1.0))
  const [musicVolume, setMusicVolume] = useState(() => readVolumePreference(PREFERENCE_KEYS.musicVolume, 0.55))
  const [sfxVolume, setSfxVolume] = useState(() => readVolumePreference(PREFERENCE_KEYS.sfxVolume, 0.85))
  const [tutorialOpen, setTutorialOpen] = useState(() => !hasSeenTutorial())
  const [pauseMenuOpen, setPauseMenuOpen] = useState(false)
  const [isSaveManagerOpen, setIsSaveManagerOpen] = useState(false)
  const [assetPackQuality, setAssetPackQuality] = useState<AssetPackQuality>('web-1k')
  const [desktopPackAvailability, setDesktopPackAvailability] = useState<DesktopPackAvailability>(EMPTY_DESKTOP_PACK_AVAILABILITY)
  const [isCheckingDesktopPacks, setIsCheckingDesktopPacks] = useState(IS_DESKTOP_EDITION)
  const [cinema8kEntitled, setCinema8kEntitled] = useState(false)
  const [isCheckingCinemaEntitlement, setIsCheckingCinemaEntitlement] = useState(IS_DESKTOP_EDITION)
  const [hoveredTile, setHoveredTile] = useState<HoveredTile | undefined>(undefined)
  const [selectedTileIndex, setSelectedTileIndex] = useState<number | undefined>(undefined)
  const [renderStats, setRenderStats] = useState<RenderStats>({
    fps: 0,
    drawCalls: 0,
    triangles: 0,
    textures: 0,
    assetLoadDurationMs: 0,
    assetPack: 'procedural',
    assetPackFallback: true,
    assetPackReason: 'Đang chờ gói đồ họa.',
    assetLoadState: 'idle',
  })
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
  const playerProfileToggleRef = useRef<HTMLButtonElement>(null)
  const openDrawerRef = useRef<DrawerSide>(null)
  const drawerTriggerRef = useRef<DrawerTrigger | null>(null)
  const soundDirectorRef = useRef<SoundDirector | null>(null)

  useEffect(() => {
    gameRef.current = game
  }, [game])

  useEffect(() => {
    openDrawerRef.current = openDrawer
  }, [openDrawer])

  useEffect(() => {
    const director = new SoundDirector()
    soundDirectorRef.current = director
    return () => {
      soundDirectorRef.current = null
      director.dispose()
    }
  }, [])

  useEffect(() => {
    soundDirectorRef.current?.setEnabled(soundEnabled)
    writePreference(PREFERENCE_KEYS.sound, String(soundEnabled))
  }, [soundEnabled])

  useEffect(() => {
    soundDirectorRef.current?.setMasterVolume(masterVolume)
    writePreference(PREFERENCE_KEYS.masterVolume, String(masterVolume))
  }, [masterVolume])

  useEffect(() => {
    soundDirectorRef.current?.setMusicVolume(musicVolume)
    writePreference(PREFERENCE_KEYS.musicVolume, String(musicVolume))
  }, [musicVolume])

  useEffect(() => {
    soundDirectorRef.current?.setSfxVolume(sfxVolume)
    writePreference(PREFERENCE_KEYS.sfxVolume, String(sfxVolume))
  }, [sfxVolume])

  useEffect(() => {
    if (pauseMenuOpen || document.hidden) {
      soundDirectorRef.current?.pauseAmbient()
    } else if (soundEnabled) {
      soundDirectorRef.current?.resumeAmbient()
    }
  }, [pauseMenuOpen, soundEnabled])

  useEffect(() => {
    const handleVisibilityChange = (): void => {
      if (document.hidden) {
        soundDirectorRef.current?.pauseAmbient()
      } else if (!pauseMenuOpen && soundEnabled) {
        soundDirectorRef.current?.resumeAmbient()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [pauseMenuOpen, soundEnabled])

  useEffect(() => {
    writePreference(PREFERENCE_KEYS.motion, motionPreference)
  }, [motionPreference])

  useEffect(() => {
    soundDirectorRef.current?.setStormActive(Boolean(game.session.simulation.activeStorm))
  }, [game.session.simulation.activeStorm])

  useEffect(() => {
    if (!IS_DESKTOP_EDITION) return undefined
    let active = true
    void resolveDesktopAssetPackEntitlements(true).then((entitlements) => {
      if (!active) return
      if (entitlements.cinema8k) setIsCheckingDesktopPacks(true)
      setCinema8kEntitled(entitlements.cinema8k)
      setIsCheckingCinemaEntitlement(false)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!IS_DESKTOP_EDITION) return undefined
    let active = true
    const packs = cinema8kEntitled
      ? ['desktop-2k', 'desktop-4k', 'cinema-8k'] as const
      : ['desktop-2k', 'desktop-4k'] as const
    void probeDesktopPackAvailability(packs).then((availability) => {
      if (!active) return
      setDesktopPackAvailability(availability)
      setIsCheckingDesktopPacks(false)
    })
    return () => { active = false }
  }, [cinema8kEntitled])

  const assetPackEntitlements = useMemo<AssetPackEntitlements>(() => ({
    desktopGame: IS_DESKTOP_EDITION,
    cinema8k: IS_DESKTOP_EDITION && cinema8kEntitled,
  }), [cinema8kEntitled])

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
      if (
        !document.hidden &&
        !pauseMenuOpen &&
        !current.session.simulation.paused &&
        current.session.simulation.speed > 0
      ) {
        accumulator += elapsed * current.session.simulation.speed
        const ticks = Math.min(12, Math.floor(accumulator))
        if (ticks > 0) {
          accumulator -= ticks
          setGame((active) => ({
            ...active,
            session: {
              ...active.session,
              simulation: advanceSimulation(active.session.simulation, active.session.world, ticks),
            },
          }))
        }
      } else {
        accumulator = 0
      }
      frameId = window.requestAnimationFrame(advance)
    }
    frameId = window.requestAnimationFrame(advance)
    return () => window.cancelAnimationFrame(frameId)
  }, [pauseMenuOpen])

  const playSound = useCallback((cue: SoundCue): void => {
    const director = soundDirectorRef.current
    if (!director) return
    void director.unlock().then(() => {
      director.play(cue)
      if (cue === 'storm') {
        director.setStormActive(true)
      }
      if (director.isEnabled() && !pauseMenuOpen) {
        director.startAmbient()
      }
    })
  }, [pauseMenuOpen])

  const closeDrawer = useCallback((side?: Exclude<DrawerSide, null>): void => {
    const closing = side ?? openDrawerRef.current
    if (closing === 'left') {
      if (drawerTriggerRef.current === 'player') playerProfileToggleRef.current?.focus()
      else leftToggleRef.current?.focus()
    }
    if (closing === 'right') rightToggleRef.current?.focus()
    drawerTriggerRef.current = null
    setOpenDrawer(null)
    playSound('menuClose')
  }, [playSound])

  const toggleDrawer = useCallback((side: Exclude<DrawerSide, null>, trigger: DrawerTrigger): void => {
    if (openDrawerRef.current !== side) drawerTriggerRef.current = trigger
    setOpenDrawer((current) => {
      const next = current === side ? null : side
      playSound(next ? 'menuOpen' : 'menuClose')
      return next
    })
  }, [playSound])

  const recreate = useCallback((config: WorldConfig, message: string): void => {
    setGame((current) => recreateWorld(current, config, message))
    setDraft(config)
    setSelectedTileIndex(undefined)
    setHoveredTile(undefined)
    setNotice(message)
    playSound('godPowerCast')
  }, [playSound])

  const handleGenerate = useCallback((): void => {
    recreate(draft, `Đã tái tạo thế giới từ seed “${draft.seed.trim() || 'aetheria-bình-minh'}”.`)
  }, [draft, recreate])

  const handleRandomWorld = useCallback((): void => {
    const nextDraft = { ...draft, seed: randomSeed() }
    recreate(nextDraft, 'Một thế giới mới vừa được đánh thức từ seed ngẫu nhiên.')
  }, [draft, recreate])

  const handleCopySeed = useCallback((): void => {
    void navigator.clipboard.writeText(gameRef.current.session.world.config.seed)
      .then(() => {
        setNotice('Đã sao chép seed. Bạn có thể chia sẻ liên kết hoặc tái tạo đúng thế giới này.')
        playSound('notification')
      })
      .catch(() => setNotice('Không thể truy cập clipboard; seed hiện tại vẫn hiển thị trong Mầm thế giới.'))
  }, [playSound])

  const dismissTutorial = useCallback((): void => {
    writePreference(PREFERENCE_KEYS.tutorial, 'true')
    setTutorialOpen(false)
    playSound('buttonClick')
  }, [playSound])

  const handleToolSelect = useCallback((nextTool: ToolId): void => {
    setTool(nextTool)
    playSound('godPowerSelected')
  }, [playSound])

  const handleTileActivate = useCallback((tileIndex: number): void => {
    setSelectedTileIndex(tileIndex)
    if (tool === 'storm') {
      setNotice('Mưa lớn là tác động toàn cầu; hãy dùng nút “Gọi mưa toàn cõi” trong thanh công cụ.')
      playSound('warning')
      return
    }
    playSound('godPowerCast')
    setGame((current) => {
      const result = applyMapToolAction(current, tool, tileIndex)
      setNotice(result.notice)
      return result.game
    })
  }, [playSound, tool])

  const handleGlobalStorm = useCallback((): void => {
    playSound('storm')
    setGame((current) => triggerGlobalStormAction(current))
    setNotice('Mưa lớn đang ảnh hưởng toàn bộ Aetheria trong 18 nhịp mô phỏng.')
  }, [playSound])

  const handleCouncilDecision = useCallback((choice: 'stockpile' | 'raise-ward'): void => {
    setGame((current) => {
      const next = resolveCouncilAction(current, choice)
      if (next === current) {
        setNotice('Quyết định này không còn hiệu lực.')
        playSound('warning')
        return current
      }
      playSound('success')
      setNotice(choice === 'stockpile' ? 'Dân làng niêm phong một phần kho lương để tăng sức hồi phục.' : 'Dân làng gia cố nơi trú ẩn, đổi bằng lương thực và niềm vui.')
      return next
    })
  }, [playSound])

  const handleDevelopVillageTool = useCallback((): void => {
    setGame((current) => {
      const result = developPrimaryVillageToolAction(current)
      setNotice(result.notice)
      if (result.game !== current) playSound('eraAdvance')
      else playSound('warning')
      return result.game
    })
  }, [playSound])

  const handleSubmitVillageKnowledge = useCallback((proposal: string): void => {
    setGame((current) => {
      const result = submitPrimaryVillageKnowledgeAction(current, proposal)
      setNotice(result.notice)
      if (result.game !== current) playSound('success')
      else playSound('warning')
      return result.game
    })
  }, [playSound])

  const handleUndo = useCallback((): void => {
    setGame((current) => {
      const next = undoGameChange(current)
      if (next === current) {
        setNotice('Chưa có thao tác nào để hoàn tác.')
        playSound('warning')
        return current
      }
      playSound('buttonClick')
      setNotice(`Đã hoàn tác: ${current.undoStack.at(-1)?.label ?? 'thao tác gần nhất'}.`)
      return next
    })
  }, [playSound])

  const handleRedo = useCallback((): void => {
    setGame((current) => {
      const next = redoGameChange(current)
      if (next === current) {
        setNotice('Chưa có thao tác nào để làm lại.')
        playSound('warning')
        return current
      }
      playSound('buttonClick')
      setNotice(`Đã làm lại: ${current.redoStack[0]?.label ?? 'thao tác gần nhất'}.`)
      return next
    })
  }, [playSound])

  const handlePauseToggle = useCallback((): void => {
    setGame((current) => {
      const nextSim = toggleSimulationPause(current.session.simulation)
      playSound(nextSim.paused ? 'pause' : 'resume')
      return { ...current, session: { ...current.session, simulation: nextSim } }
    })
  }, [playSound])

  const handleSpeedChange = useCallback((speed: SimulationSpeed): void => {
    setGame((current) => {
      const updated = setSimulationSpeed(current.session.simulation, speed)
      playSound('buttonClick')
      return { ...current, session: { ...current.session, simulation: { ...updated, paused: false } } }
    })
  }, [playSound])

  const handleAssetPackQualityChange = useCallback((pack: AssetPackQuality): void => {
    if (!IS_DESKTOP_EDITION) {
      setNotice('Bản web chỉ dùng gói texture 1K.')
      return
    }
    if (pack === 'cinema-8k' && !cinema8kEntitled) {
      setNotice(isCheckingCinemaEntitlement
        ? 'Đang xác minh quyền Aetheria Cinema 8K cho bản cài đặt này.'
        : 'Aetheria Cinema 8K là gói trả phí; quyền mua phải được dịch vụ desktop xác minh trước khi mở gói.')
      return
    }
    if (pack !== 'web-1k' && !desktopPackAvailability[pack]) {
      setNotice(isCheckingDesktopPacks
        ? `Đang kiểm tra gói ${ASSET_PACK_LABELS[pack]} cục bộ.`
        : `Gói ${ASSET_PACK_LABELS[pack]} chưa được tải vào bản cài đặt này. Hãy cài gói rồi khởi động lại game.`)
      return
    }
    setAssetPackQuality(pack)
    playSound('success')
  }, [cinema8kEntitled, desktopPackAvailability, isCheckingCinemaEntitlement, isCheckingDesktopPacks, playSound])

  const handleQualityChange = useCallback((next: QualityProfile): void => {
    setQuality(next)
    playSound('buttonClick')
    const matchingPack = assetPackForQualityProfile(next)
    if (IS_DESKTOP_EDITION && matchingPack) handleAssetPackQualityChange(matchingPack)
  }, [handleAssetPackQualityChange, playSound])

  const handlePhotoReady = useCallback((dataUrl: string): void => {
    const seed = safeFileSegment(gameRef.current.session.world.config.seed)
    triggerDownload(dataUrl, `aetheria-${seed}-tick-${gameRef.current.session.simulation.tick}.png`)
    setNotice('Ảnh PNG sắc nét của thế giới đã được tải xuống.')
    playSound('notification')
  }, [playSound])

  const handleSave = useCallback((): void => {
    try {
      const village = gameRef.current.session.simulation.villages[0]
      const villageName = village?.name || 'Làng Khởi Đầu'
      const savedMeta = saveGameToSlot(
        gameRef.current,
        `${villageName} (${gameRef.current.session.world.config.seed})`,
      )
      setNotice(`Đã lưu nhanh vào bản lưu "${savedMeta.worldName}" thành công!`)
      playSound('success')
    } catch {
      setNotice('Không thể lưu cục bộ; hãy dùng Xuất JSON để giữ một bản sao.')
      playSound('warning')
    }
  }, [playSound])

  const handleLoadSlotWorld = useCallback((slotId: string): void => {
    const result = loadGameFromSlot(slotId)
    if (!result.ok) {
      setNotice(result.reason)
      playSound('warning')
      return
    }
    setGame(result.game)
    setDraft(result.game.session.world.config)
    setSelectedTileIndex(undefined)
    setHoveredTile(undefined)
    setNotice('Đã nạp thế giới từ bản lưu.')
    playSound('success')
  }, [playSound])

  const hydrateGame = useCallback((raw: string): void => {
    const result = decodeSave(raw)
    if (!result.ok) {
      setNotice(result.reason)
      playSound('warning')
      return
    }
    setGame(result.game)
    setDraft(result.game.session.world.config)
    setSelectedTileIndex(undefined)
    setHoveredTile(undefined)
    setNotice('Đã nạp bản lưu hợp lệ.')
    playSound('success')
  }, [playSound])

  const handleLoad = useCallback((): void => {
    const result = loadFromLocalStorage()
    if (!result.ok) {
      setNotice(result.reason)
      playSound('warning')
      return
    }
    setGame(result.game)
    setDraft(result.game.session.world.config)
    setNotice('Đã nạp bản lưu cục bộ.')
    playSound('success')
  }, [playSound])

  const handleExport = useCallback((): void => {
    const blob = new Blob([serializeSave(gameRef.current)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    triggerDownload(url, `aetheria-${safeFileSegment(gameRef.current.session.world.config.seed)}.json`)
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNotice('Đã xuất bản lưu JSON cục bộ.')
    playSound('notification')
  }, [playSound])

  const handleImportFile = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    event.target.value = ''
    activeImportRef.current?.abort()
    activeImportRef.current = null
    if (!file) return
    if (file.size > MAX_SAVE_BYTES) {
      setNotice('Tệp JSON quá lớn để nạp an toàn. Hãy chọn bản xuất Aetheria dưới 2.5 MB.')
      playSound('warning')
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
  }, [hydrateGame, playSound])

  const toggleFullscreen = useCallback((): void => {
    playSound('buttonClick')
    if (fullscreenFallback) {
      setFullscreenFallback(false)
      setNotice('Đã thoát chế độ toàn màn hình dự phòng.')
      return
    }
    if (!document.fullscreenEnabled) {
      setFullscreenFallback((value) => !value)
      setNotice('Trình duyệt không hỗ trợ API toàn màn hình; đã dùng chế độ toàn màn hình của game.')
      return
    }
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => setNotice('Không thể thoát chế độ toàn màn hình.'))
    } else {
      void document.documentElement.requestFullscreen().catch(() => {
        setFullscreenFallback(true)
        setNotice('Trình duyệt chặn API toàn màn hình; game vẫn dùng lớp phủ toàn màn hình.')
      })
    }
  }, [fullscreenFallback, playSound])

  useEffect(() => {
    const onFullscreenChange = (): void => {
      const active = document.fullscreenElement === document.documentElement
      setIsFullscreen(active)
      if (active) setFullscreenFallback(false)
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  const togglePauseMenu = useCallback((): void => {
    setPauseMenuOpen((current) => {
      const next = !current
      playSound(next ? 'pause' : 'resume')
      return next
    })
  }, [playSound])

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (tutorialOpen) {
          dismissTutorial()
          return
        }
        if (openDrawer) {
          closeDrawer(openDrawer)
          return
        }
        togglePauseMenu()
        return
      }

      if (isInteractiveShortcutTarget(event.target)) return

      if (event.key === ' ' && !pauseMenuOpen) {
        event.preventDefault()
        handlePauseToggle()
        return
      }

      if (event.key.toLowerCase() === 'f' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        toggleFullscreen()
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
        if (nextTool) handleToolSelect(nextTool)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    closeDrawer,
    dismissTutorial,
    handlePauseToggle,
    handleRedo,
    handleToolSelect,
    handleUndo,
    openDrawer,
    pauseMenuOpen,
    toggleFullscreen,
    togglePauseMenu,
    tutorialOpen,
  ])

  const { session } = game
  const primaryVillage = session.simulation.villages[0]
  const selectedTile = selectedTileIndex === undefined ? undefined : session.world.tiles[selectedTileIndex]
  const lensTile = hoveredTile ?? (selectedTile ? { index: selectedTileIndex ?? 0, tile: selectedTile } : undefined)
  const day = Math.floor(session.simulation.tick / 6) + 1
  const fullscreenActive = isFullscreen || fullscreenFallback
  const assetPackLabel = renderStats.assetLoadState === 'loading'
    ? 'Đang nạp Poly Haven…'
    : renderStats.assetPack === 'procedural'
      ? 'Tạo theo quy tắc'
      : `${ASSET_PACK_LABELS[renderStats.assetPack]}${renderStats.assetPackFallback ? ' · dự phòng' : ''}`

  return (
    <main
      className={`game-shell ${fullscreenActive ? 'is-fullscreen-fallback' : ''}`}
      onContextMenu={(e) => {
        // Prevent default browser context menu to feel like a native game
        if ((e.target as HTMLElement).closest('canvas')) {
          e.preventDefault()
        }
      }}
    >
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
              motionPreference={motionPreference}
              graphicsOverrides={graphicsOverrides}
              assetPackQuality={assetPackQuality}
              assetPackEntitlements={assetPackEntitlements}
              edition={GAME_EDITION}
              photoSignal={photoSignal}
              onTileHover={setHoveredTile}
              onTileActivate={handleTileActivate}
              onStats={setRenderStats}
              onPhotoReady={handlePhotoReady}
              onPhotoError={setNotice}
            />
          </Suspense>
        </GameErrorBoundary>

        {/* Enhanced In-Game HUD */}
        <div className={`hud-layer ${tool === 'storm' ? 'has-global-tool-action' : ''}`}>
          {/* Top Gaming Bar */}
          <header className="hud-top-bar" aria-label="Trạng thái trò chơi">
            <div className="hud-top-left">
              <button
                type="button"
                className="game-menu-btn"
                onClick={togglePauseMenu}
                title="Mở Menu Tạm dừng [ESC]"
                aria-label="Menu Trò Chơi [ESC]"
              >
                <span className="menu-btn-icon">☰</span>
                <span className="menu-btn-label">MENU [ESC]</span>
              </button>
              <div className="hud-world-pill">
                <span className="pill-icon">✦</span>
                <span className="pill-title">{session.world.config.seed}</span>
                <span className="pill-era">{primaryVillage?.era ?? 'Thời Đồ Đá'}</span>
              </div>
            </div>

            <div className="hud-top-center">
              <div className="hud-stats-group">
                <div className="hud-stat-badge" title="Ngày">
                  <span className="badge-icon">☀</span>
                  <span>Ngày {day}</span>
                </div>
                <div className="hud-stat-badge" title="Tốc độ thời gian">
                  <span className="badge-icon">⏱</span>
                  <span>{session.simulation.paused ? 'Tạm dừng' : `${session.simulation.speed}×`}</span>
                </div>
                <div className="hud-stat-badge" title="Dân số">
                  <span className="badge-icon">👤</span>
                  <span>{session.simulation.villages.reduce((sum, v) => sum + v.population, 0)}</span>
                </div>
                <div className="hud-stat-badge" title="Lương thực dự trữ">
                  <span className="badge-icon">🌾</span>
                  <span>{Math.round(session.simulation.villages.reduce((sum, v) => sum + v.food, 0))}</span>
                </div>
                <div className="hud-stat-badge" title="Chỉ số hạnh phúc">
                  <span className="badge-icon">💖</span>
                  <span>{primaryVillage ? `${Math.round(primaryVillage.happiness)}%` : '—'}</span>
                </div>
                <div className={`hud-stat-badge ${session.simulation.activeStorm ? 'is-storming' : ''}`} title="Thời tiết">
                  <span className="badge-icon">{session.simulation.activeStorm ? '⛈' : '⛅'}</span>
                  <span>{session.simulation.activeStorm ? 'Bão lớn' : 'Trời quang'}</span>
                </div>
              </div>
            </div>

            <div className="hud-top-right">
              <a
                href={appPath('/')}
                className="web-demo-indicator-badge"
                title="Bản chơi thử Web 1K. Nhấn để về cổng giới thiệu hoặc xem bản Desktop 2K/4K/8K"
              >
                🎮 WEB DEMO
              </a>
              <span className="performance-badge" title="Chỉ số hiệu năng">{renderStats.fps || '—'} FPS</span>
              <span className="asset-pack-badge" title={renderStats.assetPackReason}>{assetPackLabel}</span>
              <label className="quality-select" htmlFor="quality-profile">
                <select
                  id="quality-profile"
                  value={quality}
                  onChange={(event) => handleQualityChange(event.target.value as QualityProfile)}
                >
                  {(Object.keys(QUALITY_LABELS) as QualityProfile[]).map((profile) => (
                    <option key={profile} value={profile}>{QUALITY_LABELS[profile]}</option>
                  ))}
                </select>
              </label>
              <button
                ref={playerProfileToggleRef}
                type="button"
                className="player-profile-chip"
                onClick={() => toggleDrawer('left', 'player')}
                aria-expanded={openDrawer === 'left'}
                aria-controls="world-controls-drawer"
                aria-haspopup="dialog"
                aria-label={playerSession.status === 'authenticated' ? `Hồ sơ của ${playerSession.player.displayName}` : 'Hồ sơ người chơi'}
              >
                {playerSession.status === 'authenticated' ? playerSession.player.displayName : '👤 Hồ sơ'}
              </button>
              <FullscreenButton active={fullscreenActive} onToggle={toggleFullscreen} />
            </div>
          </header>

          {/* Quick Drawer Floating Toggles */}
          <button
            ref={leftToggleRef}
            type="button"
            className="drawer-toggle drawer-toggle-left"
            onClick={() => toggleDrawer('left', 'world')}
            aria-expanded={openDrawer === 'left'}
            aria-controls="world-controls-drawer"
            aria-haspopup="dialog"
            aria-label={openDrawer === 'left' ? 'Đóng điều khiển thế giới' : 'Mở điều khiển thế giới'}
          >
            🌍 <span>Thế giới</span>
          </button>

          <button
            ref={rightToggleRef}
            type="button"
            className="drawer-toggle drawer-toggle-right"
            onClick={() => toggleDrawer('right', 'simulation')}
            aria-expanded={openDrawer === 'right'}
            aria-controls="simulation-drawer"
            aria-haspopup="dialog"
            aria-label={openDrawer === 'right' ? 'Đóng biên niên sử và mô phỏng' : 'Mở biên niên sử và mô phỏng'}
          >
            📜 <span>Biên niên sử</span>
          </button>

          {openDrawer ? <div className="drawer-scrim" aria-hidden="true" onPointerDown={() => closeDrawer()} /> : null}

          {/* Left Drawer */}
          {openDrawer === 'left' ? (
            <GameDrawer id="world-controls-drawer" label="Điều khiển thế giới" side="left" onClose={() => closeDrawer('left')}>
              <WorldControls
                draft={draft}
                activeSeed={session.world.config.seed}
                onDraftChange={setDraft}
                onGenerate={handleGenerate}
                onRandomWorld={handleRandomWorld}
                onCopySeed={handleCopySeed}
                onSave={handleSave}
                onLoad={handleLoad}
                onReset={() => recreate(session.world.config, 'Đã đặt lại thế giới hiện tại; bạn có thể hoàn tác thao tác này.')}
                onExport={handleExport}
                onImport={() => importRef.current?.click()}
              />
              <GraphicsSettings
                quality={quality}
                motionPreference={motionPreference}
                soundEnabled={soundEnabled}
                masterVolume={masterVolume}
                musicVolume={musicVolume}
                sfxVolume={sfxVolume}
                overrides={graphicsOverrides}
                assetPackQuality={assetPackQuality}
                desktopEdition={IS_DESKTOP_EDITION}
                desktopPackAvailability={desktopPackAvailability}
                cinema8kEntitled={cinema8kEntitled}
                isCheckingDesktopPacks={isCheckingDesktopPacks}
                isCheckingCinemaEntitlement={isCheckingCinemaEntitlement}
                onQualityChange={handleQualityChange}
                onMotionPreferenceChange={setMotionPreference}
                onSoundEnabledChange={setSoundEnabled}
                onMasterVolumeChange={setMasterVolume}
                onMusicVolumeChange={setMusicVolume}
                onSfxVolumeChange={setSfxVolume}
                onOpenTutorial={() => setTutorialOpen(true)}
                onOverridesChange={setGraphicsOverrides}
                onAssetPackQualityChange={handleAssetPackQualityChange}
              />
              <PlayerAccountPanel />
            </GameDrawer>
          ) : null}

          {/* Right Drawer */}
          {openDrawer === 'right' ? (
            <GameDrawer id="simulation-drawer" label="Mô phỏng và biên niên sử" side="right" onClose={() => closeDrawer('right')}>
              <SimulationPanel
                world={session.world}
                simulation={session.simulation}
                selectedTile={lensTile}
                heatmap={heatmap}
                onHeatmapChange={setHeatmap}
                onPauseToggle={handlePauseToggle}
                onSpeedChange={handleSpeedChange}
                onPhoto={() => setPhotoSignal((current) => current + 1)}
                onCouncilDecision={handleCouncilDecision}
                onDevelopVillageTool={handleDevelopVillageTool}
                onSubmitKnowledge={handleSubmitVillageKnowledge}
              />
            </GameDrawer>
          ) : null}

          {/* Map Instructions & Readout */}
          <div className="map-instructions">
            <strong>{tool === 'settler' ? 'Thả cư dân' : tool === 'storm' ? 'Mưa lớn toàn cõi' : TERRAIN_TOOL_LABELS[tool]}</strong>
            <span>{toolInstruction(tool)}</span>
          </div>

          <div className="seed-readout">
            Seed · {session.world.config.seed} · {session.world.config.size} × {session.world.config.size}
          </div>

          {/* Bottom Tool Dock */}
          <div className="hud-tool-dock">
            <ToolDock
              activeTool={tool}
              onToolChange={handleToolSelect}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={game.undoStack.length > 0}
              canRedo={game.redoStack.length > 0}
              onGlobalStorm={handleGlobalStorm}
            />
          </div>
        </div>
      </section>

      {/* Auto-Update Banner */}
      <UpdateNotificationBanner />

      {/* In-Game Pause Menu */}
      <GamePauseMenu
        isOpen={pauseMenuOpen}
        onResume={() => setPauseMenuOpen(false)}
        onQuickSave={handleSave}
        onOpenSaveManager={() => {
          setPauseMenuOpen(false)
          setIsSaveManagerOpen(true)
        }}
        onOpenSettings={() => {
          setPauseMenuOpen(false)
          toggleDrawer('left', 'world')
        }}
        onOpenWorldControls={() => {
          setPauseMenuOpen(false)
          toggleDrawer('left', 'world')
        }}
        onOpenProfile={() => {
          setPauseMenuOpen(false)
          toggleDrawer('left', 'player')
        }}
        onOpenTutorial={() => {
          setPauseMenuOpen(false)
          setTutorialOpen(true)
        }}
        worldSeed={session.world.config.seed}
        tick={session.simulation.tick}
        villageName={primaryVillage?.name}
        population={session.simulation.villages.reduce((sum, v) => sum + v.population, 0)}
      />

      {/* Multi-Slot Save Manager Modal */}
      <SaveSlotManagerModal
        isOpen={isSaveManagerOpen}
        onClose={() => setIsSaveManagerOpen(false)}
        onLoadWorld={handleLoadSlotWorld}
      />

      <TutorialOverlay open={tutorialOpen} onDismiss={dismissTutorial} />
      <input ref={importRef} className="sr-only" type="file" accept="application/json,.json" onChange={handleImportFile} aria-label="Nhập bản lưu JSON" tabIndex={-1} />
      <p className="sr-only" aria-live="polite" aria-atomic="true">{notice}</p>
    </main>
  )
}
