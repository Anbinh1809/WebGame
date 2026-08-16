import { memo, useCallback, useEffect, useRef, useState } from 'react'
import type { JSX, MouseEvent } from 'react'
import type { SimulationState } from '../simulation/types'
import type { Tile, World } from '../world/types'

interface MinimapProps {
  world: World
  simulation: SimulationState
  hoveredTile?: { index: number; tile: Tile } | undefined
  onSelectTile?: (tileIndex: number) => void
}

const BIOME_CANVAS_COLORS: Record<Tile['biome'], string> = {
  biển: '#19557f',
  'bờ cát': '#d9be79',
  'đồng cỏ': '#669848',
  'sa mạc': '#dbae52',
  rừng: '#2d6e42',
  'rừng nhiệt đới': '#1c5e37',
  'đầm lầy': '#485e3b',
  đồi: '#7a7f52',
  núi: '#72767d',
  tuyết: '#e2edf2',
  'san hô': '#1ba5bf',
  'hoa anh đào': '#f472b6',
  'núi lửa': '#dc2626',
  'hẻm núi': '#b85d38',
  'sông băng': '#a5f3fc',
}

const BIOME_ICONS: Record<Tile['biome'], string> = {
  biển: '🌊',
  'bờ cát': '🏖️',
  'đồng cỏ': '🌱',
  'sa mạc': '🏜️',
  rừng: '🌲',
  'rừng nhiệt đới': '🌴',
  'đầm lầy': '🐊',
  đồi: '⛰️',
  núi: '🏔️',
  tuyết: '❄️',
  'san hô': '🪸',
  'hoa anh đào': '🌸',
  'núi lửa': '🌋',
  'hẻm núi': '🏜️',
  'sông băng': '🧊',
}

export const Minimap = memo(function Minimap({
  world,
  simulation,
  hoveredTile,
  onSelectTile,
}: MinimapProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Day / Night cycle calculations
  const phase = (simulation.tick % 96) / 96
  const sunAngle = phase * Math.PI * 2
  const isDay = Math.sin(sunAngle) > 0
  const hour24 = Math.floor(phase * 24)
  const timeString = `${hour24.toString().padStart(2, '0')}:00`
  const weatherIcon = simulation.activeStorm ? '⛈️ Bão lớn' : isDay ? (hour24 < 9 ? '🌅 Bình minh' : hour24 > 17 ? '🌇 Hoàng hôn' : '☀️ Nắng ấm') : '🌙 Đêm sao'

  const size = world.config.size
  const mapPixelSize = isExpanded ? 240 : 140

  // Cached offscreen canvas for static terrain
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Render static terrain only when world structure/revision or pixel size changes
  useEffect(() => {
    let offscreen = baseCanvasRef.current
    if (!offscreen) {
      offscreen = document.createElement('canvas')
      baseCanvasRef.current = offscreen
    }
    offscreen.width = mapPixelSize
    offscreen.height = mapPixelSize
    const ctx = offscreen.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, mapPixelSize, mapPixelSize)
    const tileSize = mapPixelSize / size

    for (let z = 0; z < size; z += 1) {
      for (let x = 0; x < size; x += 1) {
        const tileIndex = z * size + x
        const tile = world.tiles[tileIndex]
        if (!tile) continue

        ctx.fillStyle = BIOME_CANVAS_COLORS[tile.biome] ?? '#555555'
        ctx.fillRect(x * tileSize, z * tileSize, Math.ceil(tileSize), Math.ceil(tileSize))
      }
    }
  }, [world, size, mapPixelSize])

  // Draw composite minimap (static background + dynamic village markers & hover cursor)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, mapPixelSize, mapPixelSize)
    const tileSize = mapPixelSize / size

    // Draw cached base terrain
    if (baseCanvasRef.current) {
      ctx.drawImage(baseCanvasRef.current, 0, 0)
    }

    // Draw villages with glowing markers
    for (const village of simulation.villages) {
      const home = world.tiles[village.tileIndex]
      if (!home) continue
      const vx = home.x * tileSize + tileSize / 2
      const vz = home.z * tileSize + tileSize / 2

      // Outer glow circle
      ctx.beginPath()
      ctx.arc(vx, vz, isExpanded ? 6 : 4.5, 0, Math.PI * 2)
      ctx.fillStyle = '#fbbf24'
      ctx.shadowColor = '#f59e0b'
      ctx.shadowBlur = 6
      ctx.fill()
      ctx.shadowBlur = 0

      // Inner crown dot
      ctx.beginPath()
      ctx.arc(vx, vz, isExpanded ? 2.5 : 1.8, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
    }

    // Highlight hovered tile
    if (hoveredTile?.tile) {
      const hx = hoveredTile.tile.x * tileSize
      const hz = hoveredTile.tile.z * tileSize
      ctx.strokeStyle = '#38bdf8'
      ctx.lineWidth = 1.5
      ctx.strokeRect(hx - 0.5, hz - 0.5, Math.ceil(tileSize) + 1, Math.ceil(tileSize) + 1)
    }
  }, [world.tiles, simulation.villages, hoveredTile, size, mapPixelSize, isExpanded])

  const handleCanvasClick = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      if (!onSelectTile) return
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const clickX = event.clientX - rect.left
      const clickY = event.clientY - rect.top

      const tileX = Math.floor((clickX / mapPixelSize) * size)
      const tileZ = Math.floor((clickY / mapPixelSize) * size)
      const clampedX = Math.max(0, Math.min(size - 1, tileX))
      const clampedZ = Math.max(0, Math.min(size - 1, tileZ))
      const tileIndex = clampedZ * size + clampedX
      onSelectTile(tileIndex)
    },
    [mapPixelSize, onSelectTile, size],
  )

  const activeTileInfo = hoveredTile?.tile

  return (
    <div className={`aetheria-minimap-container ${isExpanded ? 'expanded' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Header Bar */}
      <div className="minimap-header">
        <div className="minimap-time-badge" title="Thời gian trong ngày & Thời tiết">
          <span>{weatherIcon}</span>
          <span className="minimap-time-text">{timeString}</span>
        </div>
        <div className="minimap-controls">
          <button
            type="button"
            className="minimap-btn"
            onClick={() => setIsExpanded((prev) => !prev)}
            title={isExpanded ? 'Thu nhỏ bản đồ' : 'Mở rộng bản đồ toàn cảnh'}
            aria-label="Đổi kích thước bản đồ"
          >
            {isExpanded ? '↙' : '↗'}
          </button>
          <button
            type="button"
            className="minimap-btn"
            onClick={() => setIsCollapsed((prev) => !prev)}
            title={isCollapsed ? 'Hiện bản đồ mini' : 'Ẩn bản đồ mini'}
            aria-label="Ẩn hiện bản đồ"
          >
            {isCollapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* 2D Canvas Radar */}
          <div className="minimap-viewport-wrapper">
            <canvas
              ref={canvasRef}
              width={mapPixelSize}
              height={mapPixelSize}
              className="minimap-canvas"
              onClick={handleCanvasClick}
              title="Nhấp vào bất kỳ điểm nào để di chuyển camera đến đó"
            />
          </div>

          {/* Realtime Inspector Overlay */}
          <div className="minimap-footer">
            {activeTileInfo ? (
              <div className="minimap-tile-info">
                <span className="biome-tag">
                  {BIOME_ICONS[activeTileInfo.biome]} {activeTileInfo.biome}
                </span>
                <span className="coord-tag">
                  [{activeTileInfo.x}, {activeTileInfo.z}]
                </span>
                <span className="elev-tag">
                  Cao: {(activeTileInfo.height * 100).toFixed(0)}m
                </span>
              </div>
            ) : (
              <div className="minimap-hint">Rê chuột lên bản đồ để soi địa hình</div>
            )}
          </div>
        </>
      )}
    </div>
  )
})
