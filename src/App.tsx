import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, JSX } from 'react'
import { usePlayerAuth } from './auth/usePlayerAuth'
import { GameDrawer } from './components/GameDrawer'
import { GameErrorBoundary } from './components/GameErrorBoundary'
import { GamePauseMenu } from './components/GamePauseMenu'
import { FullscreenButton } from './components/FullscreenButton'
import { GraphicsSettings } from './components/GraphicsSettings'
import { TutorialOverlay } from './components/TutorialOverlay'
import { PlayerAccountPanel } from './components/PlayerAccountPanel'
import { SimulationPanel } from './components/SimulationPanel'
import { Minimap } from './components/Minimap'
import { ToolDock } from './components/ToolDock'
import { WorldControls } from './components/WorldControls'
import { applyMapToolAction, developPrimaryVillageToolAction, resolveCouncilAction, submitPrimaryVillageKnowledgeAction, triggerGlobalStormAction } from './game/actions'
import { createGameState, recreateWorld, redoGameChange, undoGameChange } from './game/session'
import { SaveSlotManagerModal } from './components/SaveSlotManagerModal'
import { CivilizationTreeModal } from './components/CivilizationTreeModal'
import { ContinentalRankedModal } from './components/ContinentalRankedModal'
import { EvolutionTreeModal } from './components/EvolutionTreeModal'
import { SketchfabExplorerModal } from './components/SketchfabExplorerModal'
import { IslandArchipelagoModal } from './components/IslandArchipelagoModal'
import { islandArchipelagoManager } from './game/islandManager'
import type { SpawnedSketchfabEntity } from './renderer/SketchfabModelLayer'
import { AvatarHudOverlay } from './components/AvatarHudOverlay'
import type { SpecializationBranchId } from './simulation/specialization'
import type { AvatarCameraPerspective, AvatarState } from './renderer/AvatarController'
import { UpdateNotificationBanner } from './components/UpdateNotificationBanner'
import { DiagnosticConsole } from './components/DiagnosticConsole'
import { ToastContainer } from './components/ToastContainer'
import { gameToast } from './runtime/toast'
import { gameLogger } from './runtime/logger'
import { aetheriaDb } from './game/db'
import { useGameLoop } from './game/useGameLoop'
import { useGameAudio } from './game/useGameAudio'
import { useGameShortcuts } from './game/useGameShortcuts'
import { getScenarioById } from './world/scenarios'
import { decodeSave, loadFromLocalStorage, MAX_SAVE_BYTES, serializeSave, loadGameFromSlot } from './game/save'
import type { HoveredTile, RenderStats } from './renderer/WorldRenderer'
import { createGraphicsQualityOverrides, FPS_LIMIT_LABELS, FPS_LIMIT_OPTIONS, QUALITY_LABELS } from './renderer/quality'
import type { FpsLimit, GraphicsQualityOverrides, QualityProfile } from './renderer/quality'
import type { MotionPreference } from './renderer/MotionPreference'
import type { SoundCue } from './runtime/SoundDirector'
import { setSimulationSpeed, toggleSimulationPause } from './simulation/engine'
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
  fpsLimit: 'aetheria-fps-limit-v1',
  sound: 'aetheria-sound-enabled-v1',
  masterVolume: 'aetheria-master-volume-v1',
  musicVolume: 'aetheria-music-volume-v1',
  sfxVolume: 'aetheria-sfx-volume-v1',
  tutorial: 'aetheria-tutorial-seen-v1',
} as const

function readFpsLimitPreference(): FpsLimit {
  try {
    const raw = window.localStorage.getItem(PREFERENCE_KEYS.fpsLimit)
    if (raw && FPS_LIMIT_OPTIONS.includes(raw as FpsLimit)) {
      return raw as FpsLimit
    }
    return 'auto'
  } catch {
    return 'auto'
  }
}

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
  const [fpsLimit, setFpsLimit] = useState<FpsLimit>(readFpsLimitPreference)
  const [graphicsOverrides, setGraphicsOverrides] = useState<GraphicsQualityOverrides>(() => createGraphicsQualityOverrides())
  const [motionPreference, setMotionPreference] = useState<MotionPreference>(readMotionPreference)
  const [soundEnabled, setSoundEnabled] = useState(readSoundEnabled)
  const [masterVolume, setMasterVolume] = useState(() => readVolumePreference(PREFERENCE_KEYS.masterVolume, 1.0))
  const [musicVolume, setMusicVolume] = useState(() => readVolumePreference(PREFERENCE_KEYS.musicVolume, 0.55))
  const [sfxVolume, setSfxVolume] = useState(() => readVolumePreference(PREFERENCE_KEYS.sfxVolume, 0.85))
  const [tutorialOpen, setTutorialOpen] = useState(() => !hasSeenTutorial())
  const [leftDrawerTab, setLeftDrawerTab] = useState<'world' | 'graphics' | 'account'>('world')
  const [pauseMenuOpen, setPauseMenuOpen] = useState(false)
  const [isSaveManagerOpen, setIsSaveManagerOpen] = useState(false)
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false)
  const [isCivTreeOpen, setIsCivTreeOpen] = useState(false)
  const [isRankedArenaOpen, setIsRankedArenaOpen] = useState(false)
  const [isEvolutionTreeOpen, setIsEvolutionTreeOpen] = useState(false)
  const [isSketchfabExplorerOpen, setIsSketchfabExplorerOpen] = useState(false)
  const [isArchipelagoOpen, setIsArchipelagoOpen] = useState(false)
  const [activeIsland, setActiveIsland] = useState(() => islandArchipelagoManager.getActiveIsland())
  const [evolutionMutationSignal, setEvolutionMutationSignal] = useState<{ x: number; y: number; z: number; colorHex?: number; token: number }>({ x: 0, y: 0, z: 0, token: 0 })
  const [isAvatarMode, setIsAvatarMode] = useState(false)
  const [avatarPerspective, setAvatarPerspective] = useState<AvatarCameraPerspective>('third-person')
  const [avatarPerspectiveSignal, setAvatarPerspectiveSignal] = useState(0)
  const [avatarState, setAvatarState] = useState<AvatarState | null>(null)
  const [unlockedPerks, setUnlockedPerks] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem('aetheria-unlocked-perks-v1')
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })
  const [chosenBranch, setChosenBranch] = useState<SpecializationBranchId | undefined>(() => {
    try {
      return (window.localStorage.getItem('aetheria-chosen-branch-v1') as SpecializationBranchId) || undefined
    } catch {
      return undefined
    }
  })
  const [assetPackQuality, setAssetPackQuality] = useState<AssetPackQuality>('web-1k')
  const [desktopPackAvailability, setDesktopPackAvailability] = useState<DesktopPackAvailability>(EMPTY_DESKTOP_PACK_AVAILABILITY)
  const [isCheckingDesktopPacks, setIsCheckingDesktopPacks] = useState(IS_DESKTOP_EDITION)
  const [cinema8kEntitled, setCinema8kEntitled] = useState(false)
  const [isCheckingCinemaEntitlement, setIsCheckingCinemaEntitlement] = useState(IS_DESKTOP_EDITION)
  const [hoveredTile, setHoveredTile] = useState<HoveredTile | undefined>(undefined)
  const [selectedTileIndex, setSelectedTileIndex] = useState<number | undefined>(undefined)
  const [focusTileSignal, setFocusTileSignal] = useState<{ tileIndex: number; token: number } | undefined>(undefined)

  const handleMinimapSelectTile = useCallback((tileIndex: number) => {
    setSelectedTileIndex(tileIndex)
    setFocusTileSignal((prev) => ({ tileIndex, token: (prev?.token ?? 0) + 1 }))
  }, [])
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

  useEffect(() => {
    gameRef.current = game
  }, [game])

  useEffect(() => {
    openDrawerRef.current = openDrawer
  }, [openDrawer])

  useEffect(() => {
    gameLogger.initGlobalErrorHandlers()
    gameLogger.info('lifecycle', 'Aetheria game session initialized', {
      seed: game.session.world.config.seed,
      edition: GAME_EDITION,
    })
  }, [game.session.world.config.seed])

  // Centralized Audio Coordinator
  const { playSound } = useGameAudio({
    soundEnabled,
    masterVolume,
    musicVolume,
    sfxVolume,
    isStormActive: Boolean(game.session.simulation.activeStorm),
    isPaused: pauseMenuOpen,
  })

  // Fixed-step Simulation Accumulator Loop
  useGameLoop({
    game,
    setGame,
    isPaused: pauseMenuOpen,
  })

  useEffect(() => {
    writePreference(PREFERENCE_KEYS.sound, String(soundEnabled))
  }, [soundEnabled])

  useEffect(() => {
    writePreference(PREFERENCE_KEYS.masterVolume, String(masterVolume))
  }, [masterVolume])

  useEffect(() => {
    writePreference(PREFERENCE_KEYS.musicVolume, String(musicVolume))
  }, [musicVolume])

  useEffect(() => {
    writePreference(PREFERENCE_KEYS.sfxVolume, String(sfxVolume))
  }, [sfxVolume])

  useEffect(() => {
    writePreference(PREFERENCE_KEYS.motion, motionPreference)
  }, [motionPreference])

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

  const notifyUser = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', cue?: SoundCue): void => {
    setNotice(message)
    if (type === 'success') gameToast.success(message)
    else if (type === 'warning') gameToast.warn(message)
    else if (type === 'error') gameToast.error(message)
    else gameToast.info(message)
    if (cue) playSound(cue)
  }, [playSound])

  const recreate = useCallback((config: WorldConfig, message: string): void => {
    setGame((current) => recreateWorld(current, config, message))
    setDraft(config)
    setSelectedTileIndex(undefined)
    setHoveredTile(undefined)
    notifyUser(message, 'info', 'godPowerCast')
    gameLogger.info('world', 'World recreated', { seed: config.seed, size: config.size })
  }, [notifyUser])

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
        notifyUser('Đã sao chép seed. Bạn có thể chia sẻ liên kết hoặc tái tạo đúng thế giới này.', 'success', 'notification')
      })
      .catch(() => notifyUser('Không thể truy cập clipboard; seed hiện tại vẫn hiển thị trong Mầm thế giới.', 'warning'))
  }, [notifyUser])

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
      notifyUser('Mưa lớn là tác động toàn cầu; hãy dùng nút “Gọi mưa toàn cõi” trong thanh công cụ.', 'warning', 'warning')
      return
    }
    playSound('godPowerCast')
    setGame((current) => {
      const result = applyMapToolAction(current, tool, tileIndex)
      notifyUser(result.notice, 'info')
      return result.game
    })
  }, [notifyUser, playSound, tool])

  const handleGlobalStorm = useCallback((): void => {
    playSound('storm')
    setGame((current) => triggerGlobalStormAction(current))
    notifyUser('Mưa lớn đang ảnh hưởng toàn bộ Aetheria trong 18 nhịp mô phỏng.', 'warning')
    gameLogger.warn('simulation', 'Global storm triggered by player')
  }, [notifyUser, playSound])

  const handleCouncilDecision = useCallback((choice: 'stockpile' | 'raise-ward'): void => {
    setGame((current) => {
      const next = resolveCouncilAction(current, choice)
      if (next === current) {
        notifyUser('Quyết định này không còn hiệu lực.', 'warning', 'warning')
        return current
      }
      const msg = choice === 'stockpile'
        ? 'Dân làng niêm phong một phần kho lương để tăng sức hồi phục.'
        : 'Dân làng gia cố nơi trú ẩn, đổi bằng lương thực và niềm vui.'
      notifyUser(msg, 'success', 'success')
      return next
    })
  }, [notifyUser])

  const handleDevelopVillageTool = useCallback((): void => {
    setGame((current) => {
      const result = developPrimaryVillageToolAction(current)
      if (result.game !== current) {
        notifyUser(result.notice, 'success', 'eraAdvance')
      } else {
        notifyUser(result.notice, 'warning', 'warning')
      }
      return result.game
    })
  }, [notifyUser])

  const handleSubmitVillageKnowledge = useCallback((proposal: string): void => {
    setGame((current) => {
      const result = submitPrimaryVillageKnowledgeAction(current, proposal)
      if (result.game !== current) {
        notifyUser(result.notice, 'success', 'success')
      } else {
        notifyUser(result.notice, 'warning', 'warning')
      }
      return result.game
    })
  }, [notifyUser])

  const handleUndo = useCallback((): void => {
    setGame((current) => {
      const next = undoGameChange(current)
      if (next === current) {
        notifyUser('Chưa có thao tác nào để hoàn tác.', 'warning', 'warning')
        return current
      }
      notifyUser(`Đã hoàn tác: ${current.undoStack.at(-1)?.label ?? 'thao tác gần nhất'}.`, 'info', 'buttonClick')
      return next
    })
  }, [notifyUser])

  const handleRedo = useCallback((): void => {
    setGame((current) => {
      const next = redoGameChange(current)
      if (next === current) {
        notifyUser('Chưa có thao tác nào để làm lại.', 'warning', 'warning')
        return current
      }
      notifyUser(`Đã làm lại: ${current.redoStack[0]?.label ?? 'thao tác gần nhất'}.`, 'info', 'buttonClick')
      return next
    })
  }, [notifyUser])

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
      notifyUser('Bản web chỉ dùng gói texture 1K.', 'warning')
      return
    }
    if (pack === 'cinema-8k' && !cinema8kEntitled) {
      notifyUser(isCheckingCinemaEntitlement
        ? 'Đang xác minh quyền Aetheria Cinema 8K cho bản cài đặt này.'
        : 'Aetheria Cinema 8K là gói trả phí; quyền mua phải được dịch vụ desktop xác minh trước khi mở gói.', 'warning')
      return
    }
    if (pack !== 'web-1k' && !desktopPackAvailability[pack]) {
      notifyUser(isCheckingDesktopPacks
        ? `Đang kiểm tra gói ${ASSET_PACK_LABELS[pack]} cục bộ.`
        : `Gói ${ASSET_PACK_LABELS[pack]} chưa được tải vào bản cài đặt này. Hãy cài gói rồi khởi động lại game.`, 'warning')
      return
    }
    setAssetPackQuality(pack)
    notifyUser(`Đã chuyển sang gói texture ${ASSET_PACK_LABELS[pack]}.`, 'success', 'success')
  }, [cinema8kEntitled, desktopPackAvailability, isCheckingCinemaEntitlement, isCheckingDesktopPacks, notifyUser])

  const handleQualityChange = useCallback((next: QualityProfile): void => {
    setQuality(next)
    playSound('buttonClick')
    const matchingPack = assetPackForQualityProfile(next)
    if (IS_DESKTOP_EDITION && matchingPack) handleAssetPackQualityChange(matchingPack)
  }, [handleAssetPackQualityChange, playSound])

  const handleFpsLimitChange = useCallback((limit: FpsLimit): void => {
    setFpsLimit(limit)
    writePreference(PREFERENCE_KEYS.fpsLimit, limit)
    playSound('buttonClick')
    notifyUser(`Đã chỉnh tốc độ khung hình: ${FPS_LIMIT_LABELS[limit]}`, 'success', 'notification')
  }, [notifyUser, playSound])

  const handleToggleAvatarMode = useCallback((): void => {
    setIsAvatarMode((prev) => {
      const next = !prev
      if (next) {
        playSound('godPowerCast')
        notifyUser('Đã giáng trần hóa thân! Dùng WASD để đi lại, V đổi góc nhìn, ESC về trời.', 'success', 'notification')
      } else {
        playSound('menuClose')
        notifyUser('Đã trở lại góc nhìn Thượng đế bao quát lục địa.', 'info', 'notification')
      }
      return next
    })
  }, [notifyUser, playSound])

  const handleSelectCivBranch = useCallback((branchId: SpecializationBranchId): void => {
    setChosenBranch(branchId)
    try {
      window.localStorage.setItem('aetheria-chosen-branch-v1', branchId)
    } catch {
      // ignore
    }
    notifyUser(`Đã chọn định hướng phát triển văn minh: ${branchId.toUpperCase()}`, 'success', 'notification')
    playSound('godPowerCast')
  }, [notifyUser, playSound])

  const handleUnlockPerk = useCallback((perkId: string, cost: number): void => {
    const primary = gameRef.current.session.simulation.villages[0]
    if (!primary || primary.research < cost) {
      notifyUser('Chưa đủ điểm nghiên cứu để kích hoạt công nghệ này!', 'warning', 'warning')
      return
    }

    primary.research -= cost
    const nextPerks = [...unlockedPerks, perkId]
    setUnlockedPerks(nextPerks)
    try {
      window.localStorage.setItem('aetheria-unlocked-perks-v1', JSON.stringify(nextPerks))
    } catch {
      // ignore
    }

    playSound('success')
    notifyUser('Kích hoạt công nghệ thành công! Binh chủng và sức mạnh mới đã sẵn sàng.', 'success', 'success')
  }, [notifyUser, playSound, unlockedPerks])

  const handleRankedReward = useCallback((food: number, research: number): void => {
    const primary = gameRef.current.session.simulation.villages[0]
    if (primary) {
      primary.food += food
      primary.research += research
    }
    playSound('success')
    notifyUser(`Chiến lợi phẩm viễn chinh: +${food} Lương thực, +${research} Điểm nghiên cứu!`, 'success', 'success')
  }, [notifyUser, playSound])

  const handlePhotoReady = useCallback((dataUrl: string): void => {
    const seed = safeFileSegment(gameRef.current.session.world.config.seed)
    triggerDownload(dataUrl, `aetheria-${seed}-tick-${gameRef.current.session.simulation.tick}.png`)
    notifyUser('Ảnh PNG sắc nét của thế giới đã được tải xuống.', 'success', 'notification')
  }, [notifyUser])

  const handleUnlockEvolutionNode = useCallback((nodeId: string): void => {
    const result = islandArchipelagoManager.unlockActiveIslandEvolutionNode(nodeId)
    if (result.success) {
      setActiveIsland({ ...islandArchipelagoManager.getActiveIsland() })
      playSound('godPowerCast')
      notifyUser('Đột biến tiến hóa thành công! Chỉ số sinh vật đã được nâng cấp.', 'success', 'notification')
      setEvolutionMutationSignal({
        x: (Math.random() - 0.5) * 8,
        y: 1,
        z: (Math.random() - 0.5) * 8,
        colorHex: 0xa855f7,
        token: Date.now(),
      })
    } else {
      notifyUser(result.error || 'Không thể mở khóa nút tiến hóa.', 'warning', 'warning')
    }
  }, [notifyUser, playSound])

  const handleSwitchIsland = useCallback((islandId: string): void => {
    try {
      const switched = islandArchipelagoManager.switchIsland(islandId)
      setActiveIsland({ ...switched })
      setGame((current) => ({
        ...current,
        session: {
          ...current.session,
          world: switched.world,
          simulation: switched.simulation,
        },
      }))
      setDraft(switched.config)
      playSound('godPowerCast')
      notifyUser(`Đã chuyển đến không gian 3D của: ${switched.name}`, 'success', 'notification')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi chuyển đảo'
      notifyUser(msg, 'warning')
    }
  }, [notifyUser, playSound])

  const handleCreateIsland = useCallback((name: string, config: WorldConfig): void => {
    const newIsland = islandArchipelagoManager.createIsland(name, config)
    setActiveIsland({ ...newIsland })
    setGame((current) => ({
      ...current,
      session: {
        ...current.session,
        world: newIsland.world,
        simulation: newIsland.simulation,
      },
    }))
    setDraft(newIsland.config)
    playSound('godPowerCast')
    notifyUser(`Đã kiến tạo thành công ${name} với nhánh tiến hóa riêng biệt!`, 'success', 'notification')
  }, [notifyUser, playSound])

  const handleSpawnSketchfabEntity = useCallback((entity: SpawnedSketchfabEntity): void => {
    islandArchipelagoManager.addActiveIslandSketchfabEntity(entity)
    setActiveIsland({ ...islandArchipelagoManager.getActiveIsland() })
    playSound('godPowerCast')
    notifyUser(`Đã triệu hồi mô hình 3D [${entity.name}] lên đảo!`, 'success', 'notification')
    setEvolutionMutationSignal({
      x: entity.x,
      y: 1,
      z: entity.z,
      colorHex: 0x06b6d4,
      token: Date.now(),
    })
  }, [notifyUser, playSound])

  const handleSave = useCallback(async (): Promise<void> => {
    try {
      const village = gameRef.current.session.simulation.villages[0]
      const villageName = village?.name || 'Làng Khởi Đầu'
      const savedMeta = await aetheriaDb.saveGame(
        gameRef.current,
        `${villageName} (${gameRef.current.session.world.config.seed})`,
      )
      notifyUser(`Đã lưu nhanh vào bản lưu "${savedMeta.worldName}" thành công!`, 'success', 'success')
      gameLogger.info('save', 'Game quicksaved successfully', { slotId: savedMeta.slotId, days: savedMeta.days })
    } catch {
      notifyUser('Không thể lưu cục bộ; hãy dùng Xuất JSON để giữ một bản sao.', 'warning', 'warning')
      gameLogger.error('save', 'Failed to quicksave game')
    }
  }, [notifyUser])

  const handleLoadSlotWorld = useCallback(async (slotId: string): Promise<void> => {
    const result = await aetheriaDb.loadGame(slotId)
    if (!result.ok) {
      notifyUser(result.reason, 'warning', 'warning')
      return
    }
    setGame(result.game)
    setDraft(result.game.session.world.config)
    setSelectedTileIndex(undefined)
    setHoveredTile(undefined)
    notifyUser('Đã nạp thế giới từ bản lưu.', 'success', 'success')
    gameLogger.info('save', 'Loaded save slot', { slotId })
  }, [notifyUser])

  const hydrateGame = useCallback((raw: string): void => {
    const result = decodeSave(raw)
    if (!result.ok) {
      notifyUser(result.reason, 'warning', 'warning')
      return
    }
    setGame(result.game)
    setDraft(result.game.session.world.config)
    setSelectedTileIndex(undefined)
    setHoveredTile(undefined)
    notifyUser('Đã nạp bản lưu hợp lệ.', 'success', 'success')
  }, [notifyUser])

  const handleLoad = useCallback((): void => {
    const result = loadFromLocalStorage()
    if (!result.ok) {
      notifyUser(result.reason, 'warning', 'warning')
      return
    }
    setGame(result.game)
    setDraft(result.game.session.world.config)
    notifyUser('Đã nạp bản lưu cục bộ.', 'success', 'success')
  }, [notifyUser])

  const handleExport = useCallback((): void => {
    const blob = new Blob([serializeSave(gameRef.current)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    triggerDownload(url, `aetheria-${safeFileSegment(gameRef.current.session.world.config.seed)}.json`)
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    notifyUser('Đã xuất bản lưu JSON cục bộ.', 'success', 'notification')
  }, [notifyUser])

  const handleImportFile = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    event.target.value = ''
    activeImportRef.current?.abort()
    activeImportRef.current = null
    if (!file) return
    if (file.size > MAX_SAVE_BYTES) {
      notifyUser('Tệp JSON quá lớn để nạp an toàn. Hãy chọn bản xuất Aetheria dưới 2.5 MB.', 'warning', 'warning')
      return
    }
    const reader = new FileReader()
    activeImportRef.current = reader
    reader.onload = () => {
      if (activeImportRef.current === reader) activeImportRef.current = null
      if (typeof reader.result === 'string') hydrateGame(reader.result)
      else notifyUser('Không thể đọc tệp JSON đã chọn.', 'warning')
    }
    reader.onerror = () => {
      if (activeImportRef.current === reader) activeImportRef.current = null
      if (reader.error?.name !== 'AbortError') notifyUser('Không thể đọc tệp JSON đã chọn.', 'warning')
    }
    reader.onabort = () => {
      if (activeImportRef.current === reader) activeImportRef.current = null
    }
    reader.readAsText(file)
  }, [hydrateGame, notifyUser])

  const toggleFullscreen = useCallback((): void => {
    playSound('buttonClick')
    if (fullscreenFallback) {
      setFullscreenFallback(false)
      notifyUser('Đã thoát chế độ toàn màn hình dự phòng.', 'info')
      return
    }
    if (!document.fullscreenEnabled) {
      setFullscreenFallback((value) => !value)
      notifyUser('Trình duyệt không hỗ trợ API toàn màn hình; đã dùng chế độ toàn màn hình của game.', 'info')
      return
    }
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => notifyUser('Không thể thoát chế độ toàn màn hình.', 'warning'))
    } else {
      void document.documentElement.requestFullscreen().catch(() => {
        setFullscreenFallback(true)
        notifyUser('Trình duyệt chặn API toàn màn hình; game vẫn dùng lớp phủ toàn màn hình.', 'info')
      })
    }
  }, [fullscreenFallback, notifyUser, playSound])

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

  // Centralized Shortcuts Engine with Diagnostic Console Trigger (F2 / ~)
  useGameShortcuts({
    tutorialOpen,
    openDrawer,
    pauseMenuOpen,
    isAvatarMode,
    onDismissTutorial: dismissTutorial,
    onCloseDrawer: () => closeDrawer(),
    onTogglePauseMenu: togglePauseMenu,
    onToggleFullscreen: toggleFullscreen,
    onPauseToggle: handlePauseToggle,
    onUndo: handleUndo,
    onRedo: handleRedo,
    onToolSelect: handleToolSelect,
    onToggleDiagnosticConsole: () => setIsDiagnosticsOpen((v) => !v),
    onToggleAvatarMode: handleToggleAvatarMode,
    onToggleCivTree: () => setIsCivTreeOpen((v) => !v),
    onToggleRankedArena: () => setIsRankedArenaOpen((v) => !v),
    onToggleEvolutionTree: () => setIsEvolutionTreeOpen((v) => !v),
    onToggleSketchfabExplorer: () => setIsSketchfabExplorerOpen((v) => !v),
    onToggleArchipelago: () => setIsArchipelagoOpen((v) => !v),
  })

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
              fpsLimit={fpsLimit}
              motionPreference={motionPreference}
              graphicsOverrides={graphicsOverrides}
              assetPackQuality={assetPackQuality}
              assetPackEntitlements={assetPackEntitlements}
              edition={GAME_EDITION}
              sketchfabEntities={activeIsland.spawnedSketchfabEntities}
              evolutionMutationSignal={evolutionMutationSignal}
              focusTileSignal={focusTileSignal}
              photoSignal={photoSignal}
              avatarMode={isAvatarMode}
              avatarPerspectiveSignal={avatarPerspectiveSignal}
              onAvatarPerspectiveChange={setAvatarPerspective}
              onAvatarStateUpdate={setAvatarState}
              onTileHover={setHoveredTile}
              onTileActivate={handleTileActivate}
              onStats={setRenderStats}
              onPhotoReady={handlePhotoReady}
              onPhotoError={(err) => notifyUser(err, 'warning')}
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
              <button
                type="button"
                className="web-demo-indicator-badge"
                onClick={() => setIsDiagnosticsOpen(true)}
                title="Bảng điều khiển chẩn đoán & telemetry lỗi (Phím tắt: F2 hoặc ~)"
                aria-label="Mở bảng chẩn đoán lỗi"
              >
                🛠 LOGS [F2]
              </button>
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
            <GameDrawer id="world-controls-drawer" label="Bảng điều khiển & Tùy chỉnh" side="left" onClose={() => closeDrawer('left')}>
              <div className="drawer-tab-nav" role="tablist" aria-label="Danh mục điều khiển">
                <button
                  type="button"
                  role="tab"
                  className={`drawer-tab-item ${leftDrawerTab === 'world' ? 'active' : ''}`}
                  aria-selected={leftDrawerTab === 'world'}
                  onClick={() => setLeftDrawerTab('world')}
                >
                  <span className="tab-icon">🌍</span>
                  <span className="tab-text">Thế Giới</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  className={`drawer-tab-item ${leftDrawerTab === 'graphics' ? 'active' : ''}`}
                  aria-selected={leftDrawerTab === 'graphics'}
                  onClick={() => setLeftDrawerTab('graphics')}
                >
                  <span className="tab-icon">⚙️</span>
                  <span className="tab-text">Đồ Họa</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  className={`drawer-tab-item ${leftDrawerTab === 'account' ? 'active' : ''}`}
                  aria-selected={leftDrawerTab === 'account'}
                  onClick={() => setLeftDrawerTab('account')}
                >
                  <span className="tab-icon">👤</span>
                  <span className="tab-text">Hồ Sơ</span>
                </button>
              </div>

              <div className="drawer-tab-content">
                {leftDrawerTab === 'world' && (
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
                )}

                {leftDrawerTab === 'graphics' && (
                  <GraphicsSettings
                    quality={quality}
                    fpsLimit={fpsLimit}
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
                    onFpsLimitChange={handleFpsLimitChange}
                    onMotionPreferenceChange={setMotionPreference}
                    onSoundEnabledChange={setSoundEnabled}
                    onMasterVolumeChange={setMasterVolume}
                    onMusicVolumeChange={setMusicVolume}
                    onSfxVolumeChange={setSfxVolume}
                    onOpenTutorial={() => setTutorialOpen(true)}
                    onOverridesChange={setGraphicsOverrides}
                    onAssetPackQualityChange={handleAssetPackQualityChange}
                  />
                )}

                {leftDrawerTab === 'account' && (
                  <PlayerAccountPanel />
                )}
              </div>
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

          {/* Real-time Minimap & Navigation Radar */}
          <Minimap
            world={session.world}
            simulation={session.simulation}
            hoveredTile={hoveredTile}
            onSelectTile={handleMinimapSelectTile}
          />

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
              isAvatarMode={isAvatarMode}
              onToggleAvatarMode={handleToggleAvatarMode}
              onOpenCivTree={() => setIsCivTreeOpen(true)}
              onOpenRankedArena={() => setIsRankedArenaOpen(true)}
              onOpenEvolutionTree={() => setIsEvolutionTreeOpen(true)}
              onOpenSketchfabExplorer={() => setIsSketchfabExplorerOpen(true)}
              onOpenArchipelago={() => setIsArchipelagoOpen(true)}
            />
          </div>
        </div>

        {/* Avatar Incarnation Mode Fullscreen HUD */}
        {isAvatarMode && (
          <AvatarHudOverlay
            perspective={avatarPerspective}
            stamina={avatarState?.stamina ?? 100}
            maxStamina={avatarState?.maxStamina ?? 100}
            onTogglePerspective={() => setAvatarPerspectiveSignal((s) => s + 1)}
            onExitAvatar={handleToggleAvatarMode}
          />
        )}
      </section>

      {/* Civilization Specialization Evolution Tree Modal */}
      {isCivTreeOpen && (
        <CivilizationTreeModal
          simulation={session.simulation}
          unlockedPerks={unlockedPerks}
          chosenBranch={chosenBranch}
          onSelectBranch={handleSelectCivBranch}
          onUnlockPerk={handleUnlockPerk}
          onClose={() => setIsCivTreeOpen(false)}
        />
      )}

      {/* Continental Ranked Global Arena Modal */}
      {isRankedArenaOpen && (
        <ContinentalRankedModal
          world={session.world}
          simulation={session.simulation}
          unlockedPerks={unlockedPerks}
          chosenBranch={chosenBranch}
          onRewardReceived={handleRankedReward}
          onClose={() => setIsRankedArenaOpen(false)}
        />
      )}

      {/* Unique Branching Evolution Tree (0.5% duplicate calibration) Modal */}
      {isEvolutionTreeOpen && (
        <EvolutionTreeModal
          isOpen={isEvolutionTreeOpen}
          profile={activeIsland.evolution}
          onClose={() => setIsEvolutionTreeOpen(false)}
          onUnlockNode={handleUnlockEvolutionNode}
        />
      )}

      {/* Sketchfab 3D Models & Asset Pipeline Explorer Modal */}
      {isSketchfabExplorerOpen && (
        <SketchfabExplorerModal
          isOpen={isSketchfabExplorerOpen}
          onClose={() => setIsSketchfabExplorerOpen(false)}
          onSpawnModel={handleSpawnSketchfabEntity}
        />
      )}

      {/* Player Archipelago & Independent Islands Realm Modal */}
      {isArchipelagoOpen && (
        <IslandArchipelagoModal
          isOpen={isArchipelagoOpen}
          islands={islandArchipelagoManager.getAllIslands()}
          activeIslandId={activeIsland.id}
          onClose={() => setIsArchipelagoOpen(false)}
          onSwitchIsland={handleSwitchIsland}
          onCreateIsland={handleCreateIsland}
        />
      )}

      {/* Auto-Update Banner */}
      <UpdateNotificationBanner />

      {/* Modern Floating Toast Notifications */}
      <ToastContainer />

      {/* Diagnostic & Telemetry Console Modal (F2 / ~) */}
      <DiagnosticConsole
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
      />

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
        onOpenDiagnostics={() => {
          setPauseMenuOpen(false)
          setIsDiagnosticsOpen(true)
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
