/**
 * Aetheria Unified Diagnostic & Telemetry Logger.
 * 
 * Tracks system events, WebGL lifecycle, simulation ticks, errors and warnings
 * in a bounded in-memory ring buffer (up to 200 items) and persists critical errors
 * into the IndexedDB telemetry store.
 */
import { aetheriaDb } from '../game/db'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  id: string
  timestamp: string
  level: LogLevel
  category: string
  message: string
  details?: Record<string, unknown> | undefined
}

export type LogListener = (entry: LogEntry) => void

const MAX_BUFFER_SIZE = 200

class GameLogger {
  private buffer: LogEntry[] = []
  private listeners = new Set<LogListener>()
  private sequence = 0
  private initializedGlobalHandlers = false

  public initGlobalErrorHandlers(): void {
    if (this.initializedGlobalHandlers || typeof window === 'undefined') return
    this.initializedGlobalHandlers = true

    window.addEventListener('error', (event) => {
      this.error('runtime', `Unhandled error: ${event.message}`, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error ? String(event.error) : undefined,
      })
    })

    window.addEventListener('unhandledrejection', (event) => {
      this.error('runtime', `Unhandled Promise Rejection: ${String(event.reason)}`, {
        reason: typeof event.reason === 'object' ? JSON.stringify(event.reason) : String(event.reason),
      })
    })
  }

  public log(level: LogLevel, category: string, message: string, details?: Record<string, unknown>): void {
    this.sequence += 1
    const entry: LogEntry = {
      id: `log-${Date.now()}-${this.sequence}`,
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      details,
    }

    this.buffer.unshift(entry)
    if (this.buffer.length > MAX_BUFFER_SIZE) {
      this.buffer.pop()
    }

    // Persist warnings and errors to IndexedDB asynchronously
    if (level === 'error' || level === 'warn') {
      void aetheriaDb.logTelemetry({
        level,
        category,
        message,
        details,
      })
    }

    for (const listener of this.listeners) {
      try {
        listener(entry)
      } catch {
        // Safe listener dispatch
      }
    }
  }

  public debug(category: string, message: string, details?: Record<string, unknown>): void {
    this.log('debug', category, message, details)
  }

  public info(category: string, message: string, details?: Record<string, unknown>): void {
    this.log('info', category, message, details)
  }

  public warn(category: string, message: string, details?: Record<string, unknown>): void {
    this.log('warn', category, message, details)
  }

  public error(category: string, message: string, details?: Record<string, unknown>): void {
    this.log('error', category, message, details)
  }

  public getEntries(): readonly LogEntry[] {
    return this.buffer
  }

  public clear(): void {
    this.buffer = []
  }

  public subscribe(listener: LogListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  public exportDiagnosticReport(): string {
    const report = {
      appName: 'Aetheria: World Shaper',
      clientTime: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node/Test',
      screen: typeof window !== 'undefined' ? {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
      } : undefined,
      logs: this.buffer,
    }

    return JSON.stringify(report, null, 2)
  }
}

export const gameLogger = new GameLogger()
