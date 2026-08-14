/**
 * Local player profiles deliberately live only in this browser. They are not a
 * substitute for server-side identity, cloud saves, or purchase entitlements.
 * Passwords are never persisted; only a salted PBKDF2 verifier is stored.
 */
export const LOCAL_PLAYER_ACCOUNTS_KEY = 'aetheria.local-player-accounts.v1'
export const LOCAL_PLAYER_SESSION_KEY = 'aetheria.local-player-session.v1'
export const LOCAL_PLAYER_PBKDF2_ITERATIONS = 210_000

const LOCAL_PLAYER_SCHEMA_VERSION = 1
const MIN_PBKDF2_ITERATIONS = 100_000
const MAX_PBKDF2_ITERATIONS = 1_000_000
const PASSWORD_SALT_BYTES = 16
const PASSWORD_HASH_BITS = 256
const MIN_PASSWORD_LENGTH = 10
const MAX_PASSWORD_LENGTH = 128
const DISPLAY_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} _.-]*$/u

export interface StorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export interface LocalAuthEnvironment {
  accountStorage: StorageLike
  sessionStorage: StorageLike
  crypto: Crypto
  iterations?: number
  now?: () => number
}

export interface LocalPlayer {
  id: string
  displayName: string
}

export interface LocalCredentials {
  displayName: string
  password: string
}

export type LocalPlayerSession =
  | { status: 'anonymous' }
  | { status: 'authenticated'; player: LocalPlayer }
  | { status: 'unavailable'; message: string }

export type LocalAuthResult =
  | { ok: true; player: LocalPlayer }
  | { ok: false; code: 'validation' | 'duplicate' | 'invalid-credentials' | 'unavailable'; message: string }

export type LocalSignOutResult =
  | { ok: true }
  | { ok: false; message: string }

interface PasswordVerifier {
  algorithm: 'PBKDF2-SHA-256'
  iterations: number
  salt: string
  hash: string
}

interface StoredAccount {
  id: string
  displayName: string
  normalizedName: string
  createdAt: number
  verifier: PasswordVerifier
}

interface StoredAccountsDocument {
  schemaVersion: number
  accounts: StoredAccount[]
}

interface StoredSession {
  schemaVersion: number
  accountId: string
}

type AccountsReadResult =
  | { ok: true; accounts: StoredAccount[] }
  | { ok: false }

type SessionReadResult =
  | { ok: true; accountId: string | null }
  | { ok: false }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function isHex(value: unknown, length: number): value is string {
  return typeof value === 'string' && value.length === length && /^[0-9a-f]+$/iu.test(value)
}

function normalizeDisplayName(value: string): string | null {
  const normalized = value.normalize('NFKC').trim().replace(/\s+/gu, ' ')
  const characterCount = Array.from(normalized).length
  if (characterCount < 3 || characterCount > 32 || !DISPLAY_NAME_PATTERN.test(normalized)) return null
  return normalized
}

function normalizedLookupName(displayName: string): string {
  return displayName.toLocaleLowerCase('vi')
}

function isRegistrationPasswordValid(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH
    && password.length <= MAX_PASSWORD_LENGTH
    && /\S/u.test(password)
}

function isStoredVerifier(value: unknown): value is PasswordVerifier {
  if (!isRecord(value)) return false
  return value.algorithm === 'PBKDF2-SHA-256'
    && typeof value.iterations === 'number'
    && Number.isInteger(value.iterations)
    && value.iterations >= MIN_PBKDF2_ITERATIONS
    && value.iterations <= MAX_PBKDF2_ITERATIONS
    && isHex(value.salt, PASSWORD_SALT_BYTES * 2)
    && isHex(value.hash, PASSWORD_HASH_BITS / 4)
}

function isStoredAccount(value: unknown): value is StoredAccount {
  if (!isRecord(value)) return false
  return typeof value.id === 'string'
    && value.id.length >= 16
    && value.id.length <= 64
    && typeof value.displayName === 'string'
    && normalizeDisplayName(value.displayName) === value.displayName
    && typeof value.normalizedName === 'string'
    && value.normalizedName === normalizedLookupName(value.displayName)
    && typeof value.createdAt === 'number'
    && Number.isSafeInteger(value.createdAt)
    && value.createdAt > 0
    && isStoredVerifier(value.verifier)
}

function parseAccounts(raw: string | null): AccountsReadResult {
  if (raw === null) return { ok: true, accounts: [] }

  try {
    const value = JSON.parse(raw) as unknown
    if (!isRecord(value) || value.schemaVersion !== LOCAL_PLAYER_SCHEMA_VERSION || !Array.isArray(value.accounts) || !value.accounts.every(isStoredAccount)) {
      return { ok: false }
    }
    const accounts = value.accounts as StoredAccount[]
    const accountIds = new Set(accounts.map((account) => account.id))
    const accountNames = new Set(accounts.map((account) => account.normalizedName))
    if (accountIds.size !== accounts.length || accountNames.size !== accounts.length) return { ok: false }
    return { ok: true, accounts }
  } catch {
    return { ok: false }
  }
}

function readAccounts(storage: StorageLike): AccountsReadResult {
  try {
    return parseAccounts(storage.getItem(LOCAL_PLAYER_ACCOUNTS_KEY))
  } catch {
    return { ok: false }
  }
}

function readSession(storage: StorageLike): SessionReadResult {
  try {
    const raw = storage.getItem(LOCAL_PLAYER_SESSION_KEY)
    if (raw === null) return { ok: true, accountId: null }
    const value = JSON.parse(raw) as unknown
    if (!isRecord(value) || value.schemaVersion !== LOCAL_PLAYER_SCHEMA_VERSION || typeof value.accountId !== 'string' || value.accountId.length === 0) {
      return { ok: true, accountId: null }
    }
    return { ok: true, accountId: value.accountId }
  } catch {
    return { ok: false }
  }
}

function browserEnvironment(): LocalAuthEnvironment | null {
  if (typeof window === 'undefined' || !window.crypto?.subtle) return null
  try {
    return {
      accountStorage: window.localStorage,
      sessionStorage: window.sessionStorage,
      crypto: window.crypto,
    }
  } catch {
    return null
  }
}

function resolvedEnvironment(environment?: LocalAuthEnvironment): LocalAuthEnvironment | null {
  return environment ?? browserEnvironment()
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}

function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return copy
}

async function derivePasswordHash(password: string, salt: Uint8Array, iterations: number, cryptoApi: Crypto): Promise<Uint8Array> {
  const passwordKey = await cryptoApi.subtle.importKey(
    'raw',
    copyToArrayBuffer(new TextEncoder().encode(password)),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await cryptoApi.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: copyToArrayBuffer(salt), iterations },
    passwordKey,
    PASSWORD_HASH_BITS,
  )
  return new Uint8Array(bits)
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  let difference = left.length ^ right.length
  const longestLength = Math.max(left.length, right.length)
  for (let index = 0; index < longestLength; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0)
  }
  return difference === 0
}

function playerFromAccount(account: StoredAccount): LocalPlayer {
  return { id: account.id, displayName: account.displayName }
}

function unavailableResult(): LocalAuthResult {
  return {
    ok: false,
    code: 'unavailable',
    message: 'Không thể dùng hồ sơ cục bộ trong trình duyệt này. Hãy kiểm tra quyền lưu dữ liệu của trang.',
  }
}

function invalidCredentialsResult(): LocalAuthResult {
  return {
    ok: false,
    code: 'invalid-credentials',
    message: 'Tên người chơi hoặc mật khẩu không đúng.',
  }
}

function writeSession(storage: StorageLike, accountId: string): void {
  const session: StoredSession = { schemaVersion: LOCAL_PLAYER_SCHEMA_VERSION, accountId }
  storage.setItem(LOCAL_PLAYER_SESSION_KEY, JSON.stringify(session))
}

export function getLocalPlayerSession(environment?: LocalAuthEnvironment): LocalPlayerSession {
  const resolved = resolvedEnvironment(environment)
  if (!resolved) {
    return { status: 'unavailable', message: 'Trình duyệt không hỗ trợ hồ sơ cục bộ an toàn.' }
  }

  const accounts = readAccounts(resolved.accountStorage)
  const session = readSession(resolved.sessionStorage)
  if (!accounts.ok || !session.ok) {
    return { status: 'unavailable', message: 'Không thể đọc hồ sơ cục bộ một cách an toàn.' }
  }
  if (!session.accountId) return { status: 'anonymous' }

  const account = accounts.accounts.find((candidate) => candidate.id === session.accountId)
  return account ? { status: 'authenticated', player: playerFromAccount(account) } : { status: 'anonymous' }
}

export async function registerLocalPlayer(input: LocalCredentials, environment?: LocalAuthEnvironment): Promise<LocalAuthResult> {
  const displayName = normalizeDisplayName(input.displayName)
  if (!displayName) {
    return { ok: false, code: 'validation', message: 'Tên người chơi cần 3–32 ký tự; chỉ dùng chữ, số, khoảng trắng, gạch nối, gạch dưới hoặc dấu chấm.' }
  }
  if (!isRegistrationPasswordValid(input.password)) {
    return { ok: false, code: 'validation', message: `Mật khẩu cần từ ${MIN_PASSWORD_LENGTH} đến ${MAX_PASSWORD_LENGTH} ký tự và không được chỉ có khoảng trắng.` }
  }

  const resolved = resolvedEnvironment(environment)
  if (!resolved) return unavailableResult()

  const accounts = readAccounts(resolved.accountStorage)
  if (!accounts.ok) return unavailableResult()
  const lookupName = normalizedLookupName(displayName)
  if (accounts.accounts.some((account) => account.normalizedName === lookupName)) {
    return { ok: false, code: 'duplicate', message: 'Tên người chơi này đã có trên thiết bị. Hãy đăng nhập hoặc chọn tên khác.' }
  }

  try {
    const salt = new Uint8Array(PASSWORD_SALT_BYTES)
    resolved.crypto.getRandomValues(salt)
    const iterations = resolved.iterations ?? LOCAL_PLAYER_PBKDF2_ITERATIONS
    if (iterations < MIN_PBKDF2_ITERATIONS || iterations > MAX_PBKDF2_ITERATIONS || !Number.isInteger(iterations)) return unavailableResult()
    const hash = await derivePasswordHash(input.password, salt, iterations, resolved.crypto)
    const identifierBytes = new Uint8Array(16)
    resolved.crypto.getRandomValues(identifierBytes)
    const account: StoredAccount = {
      id: `player-${bytesToHex(identifierBytes)}`,
      displayName,
      normalizedName: lookupName,
      createdAt: resolved.now?.() ?? Date.now(),
      verifier: {
        algorithm: 'PBKDF2-SHA-256',
        iterations,
        salt: bytesToHex(salt),
        hash: bytesToHex(hash),
      },
    }
    const document: StoredAccountsDocument = {
      schemaVersion: LOCAL_PLAYER_SCHEMA_VERSION,
      accounts: [...accounts.accounts, account],
    }
    resolved.accountStorage.setItem(LOCAL_PLAYER_ACCOUNTS_KEY, JSON.stringify(document))
    writeSession(resolved.sessionStorage, account.id)
    return { ok: true, player: playerFromAccount(account) }
  } catch {
    return unavailableResult()
  }
}

export async function signInLocalPlayer(input: LocalCredentials, environment?: LocalAuthEnvironment): Promise<LocalAuthResult> {
  const displayName = normalizeDisplayName(input.displayName)
  if (!displayName || input.password.length === 0 || input.password.length > MAX_PASSWORD_LENGTH) return invalidCredentialsResult()

  const resolved = resolvedEnvironment(environment)
  if (!resolved) return unavailableResult()
  const accounts = readAccounts(resolved.accountStorage)
  if (!accounts.ok) return unavailableResult()
  const account = accounts.accounts.find((candidate) => candidate.normalizedName === normalizedLookupName(displayName))
  if (!account) return invalidCredentialsResult()

  try {
    const derivedHash = await derivePasswordHash(
      input.password,
      hexToBytes(account.verifier.salt),
      account.verifier.iterations,
      resolved.crypto,
    )
    if (!constantTimeEqual(derivedHash, hexToBytes(account.verifier.hash))) return invalidCredentialsResult()
    writeSession(resolved.sessionStorage, account.id)
    return { ok: true, player: playerFromAccount(account) }
  } catch {
    return unavailableResult()
  }
}

export function signOutLocalPlayer(environment?: LocalAuthEnvironment): LocalSignOutResult {
  const resolved = resolvedEnvironment(environment)
  if (!resolved) return { ok: false, message: 'Không thể đóng hồ sơ cục bộ trong trình duyệt này.' }
  try {
    resolved.sessionStorage.removeItem(LOCAL_PLAYER_SESSION_KEY)
    return { ok: true }
  } catch {
    return { ok: false, message: 'Không thể đóng hồ sơ cục bộ. Hãy kiểm tra quyền lưu dữ liệu của trang.' }
  }
}

export function listSavedAccountProfiles(environment?: LocalAuthEnvironment): Array<{ id: string; displayName: string }> {
  const resolved = resolvedEnvironment(environment)
  if (!resolved) return []
  const accounts = readAccounts(resolved.accountStorage)
  if (!accounts.ok) return []
  return accounts.accounts.map((a) => ({ id: a.id, displayName: a.displayName }))
}
