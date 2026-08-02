import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { WorldRenderer } from '../renderer/WorldRenderer'
import type { HoveredTile, RenderStats } from '../renderer/WorldRenderer'
import type { SimulationState } from '../simulation/types'
import type { HeatmapMode, ToolId, World } from '../world/types'

interface WorldViewportProps {
  world: World
  simulation: SimulationState
  tool: ToolId
  heatmap: HeatmapMode
  photoSignal: number
  onTileHover: (tile: HoveredTile | undefined) => void
  onTileActivate: (tileIndex: number) => void
  onStats: (stats: RenderStats) => void
  onPhotoReady: (dataUrl: string) => void
}

export function WorldViewport({
  world,
  simulation,
  tool,
  heatmap,
  photoSignal,
  onTileHover,
  onTileActivate,
  onStats,
  onPhotoReady,
}: WorldViewportProps): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<WorldRenderer | null>(null)
  const callbacksRef = useRef({ onTileHover, onTileActivate, onStats, onPhotoReady })
  const worldRef = useRef(world)
  const simulationRef = useRef(simulation)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    callbacksRef.current = { onTileHover, onTileActivate, onStats, onPhotoReady }
  }, [onPhotoReady, onStats, onTileActivate, onTileHover])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined

    try {
      const renderer = new WorldRenderer(host, worldRef.current, simulationRef.current, {
        onTileHover: (tile) => callbacksRef.current.onTileHover(tile),
        onTileActivate: (tileIndex) => callbacksRef.current.onTileActivate(tileIndex),
        onStats: (stats) => callbacksRef.current.onStats(stats),
      })
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
  }, [])

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
    if (photoSignal === 0) return
    const renderer = rendererRef.current
    if (!renderer) return
    callbacksRef.current.onPhotoReady(renderer.capturePhoto())
  }, [photoSignal])

  return (
    <div className="world-viewport" data-testid="world-viewport">
      <div ref={hostRef} className="world-canvas-host" />
      {error ? (
        <div className="webgl-fallback" role="alert">
          <span className="eyebrow">Chế độ dự phòng</span>
          <strong>Bản đồ 3D không khả dụng</strong>
          <p>{error} Bạn vẫn có thể thay đổi seed và xem trạng thái mô phỏng.</p>
        </div>
      ) : null}
      <div className="viewport-vignette" aria-hidden="true" />
    </div>
  )
}
