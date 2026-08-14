import { useEffect, useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { GameState } from './session'
import { advanceSimulation } from '../simulation/engine'

interface UseGameLoopOptions {
  game: GameState
  setGame: Dispatch<SetStateAction<GameState>>
  isPaused: boolean
}

/**
 * Decoupled fixed-step simulation accumulator loop.
 * Runs on requestAnimationFrame with delta-time clamping (max 0.25s) to guarantee
 * deterministic simulation ticks without frame spiraling under background tabs or hitches.
 */
export function useGameLoop({ game, setGame, isPaused }: UseGameLoopOptions): void {
  const gameRef = useRef(game)

  useEffect(() => {
    gameRef.current = game
  }, [game])

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
        !isPaused &&
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
  }, [isPaused, setGame])
}
