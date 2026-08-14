import { describe, expect, it } from 'vitest'
import { gameLogger } from './logger'

describe('GameLogger', () => {
  it('records logs with categories, levels, and sequence numbers', () => {
    gameLogger.clear()
    gameLogger.info('test-cat', 'Test info message', { val: 42 })
    gameLogger.warn('test-cat', 'Test warn message')
    gameLogger.error('test-cat', 'Test error message')

    const entries = gameLogger.getEntries()
    expect(entries.length).toBe(3)
    expect(entries[0]?.message).toBe('Test error message')
    expect(entries[0]?.level).toBe('error')
    expect(entries[1]?.message).toBe('Test warn message')
    expect(entries[2]?.message).toBe('Test info message')
    expect(entries[2]?.details).toEqual({ val: 42 })
  })

  it('exports a valid diagnostic JSON report', () => {
    const reportStr = gameLogger.exportDiagnosticReport()
    const parsed = JSON.parse(reportStr) as { appName: string; logs: unknown[] }
    expect(parsed.appName).toBe('Aetheria: World Shaper')
    expect(Array.isArray(parsed.logs)).toBe(true)
  })
})
