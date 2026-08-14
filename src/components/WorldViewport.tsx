import { memo, useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { WorldRenderer } from '../renderer/WorldRenderer'
import type { HoveredTile, RenderStats } from '../renderer/WorldRenderer'
import type { SimulationState } from '../simulation/types'
import type { HeatmapMode, ToolId, World } from '../world/types'
import type { GraphicsQualityOverrides, QualityProfile } from '../renderer/quality'
import type { MotionPreference } from '../renderer/MotionPreference'
import type { AssetPackQuality } from '../assets/types'
import type { AssetPackEntitlements, GameEdition } from '../renderer/AssetPackManager'

interface WorldViewportProps {
  world: World
  simulation: SimulationState
  tool: ToolId
  heatmap: HeatmapMode
  photoSignal: number
  quality: QualityProfile
  motionPreference: MotionPreference
  graphicsOverrides: GraphicsQualityOverrides
  assetPackQuality: AssetPackQuality
  assetPackEntitlements: AssetPackEntitlements
  edition: GameEdition
  onTileHover: (tile: HoveredTile | undefined) => void
  onTileActivate: (tileIndex: number) => void
  onStats: (stats: RenderStats) => void
  onPhotoReady: (dataUrl: string) => void
  onPhotoError: (message: string) => void
}

export const WorldViewport = memo(function WorldViewport({
  world,
  simulation,
  tool,
  heatmap,
  photoSignal,
  quality,
  motionPreference,
  graphicsOverrides,
  assetPackQuality,
  assetPackEntitlements,
  edition,
  onTileHover,
  onTileActivate,
  onStats,
  onPhotoReady,
  onPhotoError,
}: WorldViewportProps): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<WorldRenderer | null>(null)
  const callbacksRef = useRef({ onTileHover, onTileActivate, onStats, onPhotoReady, onPhotoError })
  const worldRef = useRef(world)
  const simulationRef = useRef(simulation)
  const qualityRef = useRef(quality)
  const graphicsOverridesRef = useRef(graphicsOverrides)
  const assetPackRef = useRef(assetPackQuality)
  const assetPackEntitlementsRef = useRef(assetPackEntitlements)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    callbacksRef.current = { onTileHover, onTileActivate, onStats, onPhotoReady, onPhotoError }
  }, [onPhotoError, onPhotoReady, onStats, onTileActivate, onTileHover])

  useEffect(() => {
    worldRef.current = world
    simulationRef.current = simulation
    qualityRef.current = quality
    graphicsOverridesRef.current = graphicsOverrides
    assetPackRef.current = assetPackQuality
    assetPackEntitlementsRef.current = assetPackEntitlements
  }, [assetPackEntitlements, assetPackQuality, graphicsOverrides, quality, simulation, world])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined

    try {
      const renderer = new WorldRenderer(host, worldRef.current, simulationRef.current, {
        onTileHover: (tile) => callbacksRef.current.onTileHover(tile),
        onTileActivate: (tileIndex) => callbacksRef.current.onTileActivate(tileIndex),
        onStats: (stats) => callbacksRef.current.onStats(stats),
        onWebGlError: (message) => setError(message),
       }, qualityRef.current, edition, graphicsOverridesRef.current, assetPackEntitlementsRef.current)
       renderer.setAssetPack(assetPackRef.current)
      rendererRef.current = renderer

      return () => {
        renderer.dispose()
        rendererRef.current = null
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Không thể khởi tạo bản đồ 3D.'
      const timeout = window.setTimeout(() => setError(message), 0)
      return () => window.clearTimeout(timeout)
    }
  }, [attempt, edition])

  useEffect(() => {
    rendererRef.current?.updateWorld(world)
  }, [world])

  useEffect(() => {
    rendererRef.current?.updateSimulation(simulation)
  }, [simulation])

  useEffect(() => {
    rendererRef.current?.setTool(tool)
  }, [tool])

  useEffect(() => {
    rendererRef.current?.setHeatmap(heatmap)
  }, [heatmap])

  useEffect(() => {
    rendererRef.current?.setQuality(quality)
  }, [quality])

  useEffect(() => {
    rendererRef.current?.setMotionPreference(motionPreference)
  }, [motionPreference])

  useEffect(() => {
    rendererRef.current?.setGraphicsOverrides(graphicsOverrides)
  }, [graphicsOverrides])

  useEffect(() => {
    rendererRef.current?.setAssetPack(assetPackQuality)
  }, [assetPackQuality])

  useEffect(() => {
    rendererRef.current?.setAssetPackEntitlements(assetPackEntitlements)
  }, [assetPackEntitlements])

  useEffect(() => {
    if (photoSignal === 0) return
    const renderer = rendererRef.current
    if (!renderer) {
      callbacksRef.current.onPhotoError('Bản đồ 3D chưa sẵn sàng để chụp ảnh. Hãy thử lại sau khi đồ họa được khôi phục.')
      return
    }
    try {
      callbacksRef.current.onPhotoReady(renderer.capturePhoto())
    } catch {
      callbacksRef.current.onPhotoError('Không thể chụp PNG ở độ phân giải hiện tại. Hãy chọn chất lượng thấp hơn rồi thử lại.')
    }
  }, [photoSignal])

  return (
    <div className="world-viewport" data-testid="world-viewport">
      <div ref={hostRef} className="world-canvas-host" />
      {error ? (
        <div className="webgl-fallback" role="alert">
          <span className="eyebrow">Chế độ dự phòng</span>
          <strong>Bản đồ 3D không khả dụng</strong>
          <p>{error} Bạn vẫn có thể thay đổi seed và xem trạng thái mô phỏng.</p>
          <button type="button" className="secondary-button" onClick={() => { setError(null); setAttempt((value) => value + 1) }}>Thử lại đồ họa 3D</button>
        </div>
      ) : null}
      <div className="viewport-vignette" aria-hidden="true" />
    </div>
  )
})
