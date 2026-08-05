import { commitGameChange } from './session'
import type { GameState } from './session'
import { recordGodToolUse, resolveCouncilDecision, spawnSettlersAt, triggerStorm } from '../simulation/engine'
import type { CouncilChoiceId } from '../simulation/types'
import { applyTerrainTool } from '../world/commands'
import { TERRAIN_TOOL_LABELS } from '../world/types'
import type { ToolId } from '../world/types'

export interface GameActionResult {
  game: GameState
  notice: string
}

/**
 * Keeps deterministic gameplay mutations out of React orchestration. The AI
 * layer never imports this module, so it has no path to change world state.
 */
export function applyMapToolAction(game: GameState, tool: Exclude<ToolId, 'storm'>, tileIndex: number): GameActionResult {
  if (tool === 'settler') {
    const result = spawnSettlersAt(game.session.simulation, game.session.world, tileIndex)
    if (!result.ok) return { game, notice: result.reason }
    const world = result.createdVillage
      ? { ...game.session.world, villages: [...game.session.world.villages, result.villageSite], revision: game.session.world.revision + 1 }
      : game.session.world
    const label = result.createdVillage ? 'Lập ' + result.villageSite.name : 'Đón cư dân đến ' + result.villageSite.name
    const simulation = recordGodToolUse(result.simulation, tool)
    return {
      game: commitGameChange(game, { world, simulation }, label),
      notice: result.createdVillage ? 'Đã lập ' + result.villageSite.name + '.' : 'Cư dân đã nhập vào ' + result.villageSite.name + '.',
    }
  }

  const result = applyTerrainTool(game.session.world, tileIndex, tool, TERRAIN_TOOL_LABELS[tool])
  if (!result) return { game, notice: 'Quyền năng này không thể thay đổi ô đất đang chọn.' }
  const simulation = recordGodToolUse(game.session.simulation, tool)
  return {
    game: commitGameChange(game, { world: result.world, simulation }, result.command.label),
    notice: result.command.label + ': thay đổi đã được lưu vào lịch sử.',
  }
}

export function triggerGlobalStormAction(game: GameState): GameState {
  const simulation = recordGodToolUse(triggerStorm(game.session.simulation), 'storm')
  return commitGameChange(game, { ...game.session, simulation }, 'Gọi mưa lớn toàn cõi')
}

export function resolveCouncilAction(game: GameState, choice: CouncilChoiceId): GameState {
  const simulation = resolveCouncilDecision(game.session.simulation, choice)
  if (simulation === game.session.simulation) return game
  const label = choice === 'stockpile' ? 'Chuẩn bị kho lương' : 'Gia cố phòng vệ'
  return commitGameChange(game, { ...game.session, simulation }, label)
}
