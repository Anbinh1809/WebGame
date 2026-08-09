import { describe, expect, it } from 'vitest'
import {
  getLocalPlayerSession,
  LOCAL_PLAYER_ACCOUNTS_KEY,
  LOCAL_PLAYER_SESSION_KEY,
  registerLocalPlayer,
  signInLocalPlayer,
  signOutLocalPlayer,
} from './localPlayerAuth'
import type { LocalAuthEnvironment, StorageLike } from './localPlayerAuth'

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

function createEnvironment(): { environment: LocalAuthEnvironment; accountStorage: MemoryStorage; sessionStorage: MemoryStorage } {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto is required for local profile tests.')
  const accountStorage = new MemoryStorage()
  const sessionStorage = new MemoryStorage()
  return {
    accountStorage,
    sessionStorage,
    environment: {
      accountStorage,
      sessionStorage,
      crypto: globalThis.crypto,
      iterations: 100_000,
      now: () => 1_800_000_000_000,
    },
  }
}

describe('local player authentication', () => {
  it('stores a salted verifier instead of a raw password and opens a session after registration', async () => {
    const { environment, accountStorage, sessionStorage } = createEnvironment()
    const password = 'mangrove-valley-2026'
    const result = await registerLocalPlayer({ displayName: 'Người Chơi', password }, environment)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.message)
    expect(getLocalPlayerSession(environment)).toEqual({ status: 'authenticated', player: result.player })

    const storedAccounts = accountStorage.getItem(LOCAL_PLAYER_ACCOUNTS_KEY)
    expect(storedAccounts).not.toBeNull()
    expect(storedAccounts).not.toContain(password)
    expect(storedAccounts).toContain('PBKDF2-SHA-256')
    expect(storedAccounts).toMatch(/"salt":"[0-9a-f]{32}"/u)
    expect(storedAccounts).toMatch(/"hash":"[0-9a-f]{64}"/u)
    expect(sessionStorage.getItem(LOCAL_PLAYER_SESSION_KEY)).toContain(result.player.id)
  })

  it('requires the correct password to restore a signed-out local session', async () => {
    const { environment } = createEnvironment()
    const registered = await registerLocalPlayer({ displayName: 'Linh', password: 'river-stone-2026' }, environment)
    if (!registered.ok) throw new Error(registered.message)

    expect(signOutLocalPlayer(environment)).toEqual({ ok: true })
    expect(getLocalPlayerSession(environment)).toEqual({ status: 'anonymous' })

    const rejected = await signInLocalPlayer({ displayName: 'linh', password: 'wrong-passphrase' }, environment)
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) expect(rejected.code).toBe('invalid-credentials')
    expect(getLocalPlayerSession(environment)).toEqual({ status: 'anonymous' })

    const signedIn = await signInLocalPlayer({ displayName: 'LINH', password: 'river-stone-2026' }, environment)
    expect(signedIn).toEqual({ ok: true, player: registered.player })
    expect(getLocalPlayerSession(environment)).toEqual({ status: 'authenticated', player: registered.player })
  })

  it('rejects duplicate names and malformed local account data without overwriting it', async () => {
    const { environment, accountStorage } = createEnvironment()
    const first = await registerLocalPlayer({ displayName: 'Đá Cuội', password: 'basalt-grove-2026' }, environment)
    if (!first.ok) throw new Error(first.message)

    const duplicate = await registerLocalPlayer({ displayName: 'đá cuội', password: 'another-safe-pass' }, environment)
    expect(duplicate.ok).toBe(false)
    if (!duplicate.ok) expect(duplicate.code).toBe('duplicate')

    accountStorage.setItem(LOCAL_PLAYER_ACCOUNTS_KEY, '{corrupt')
    expect(getLocalPlayerSession(environment).status).toBe('unavailable')
    const unavailable = await registerLocalPlayer({ displayName: 'Mộc', password: 'forest-river-2026' }, environment)
    expect(unavailable.ok).toBe(false)
    if (!unavailable.ok) expect(unavailable.code).toBe('unavailable')
    expect(accountStorage.getItem(LOCAL_PLAYER_ACCOUNTS_KEY)).toBe('{corrupt')
  })

  it('validates registration input before creating any local account record', async () => {
    const { environment, accountStorage } = createEnvironment()
    const result = await registerLocalPlayer({ displayName: '@@', password: 'short' }, environment)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('validation')
    expect(accountStorage.getItem(LOCAL_PLAYER_ACCOUNTS_KEY)).toBeNull()
  })
})
