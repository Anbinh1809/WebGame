import { createContext } from 'react'
import type { LocalAuthResult, LocalCredentials, LocalPlayerSession, LocalSignOutResult } from './localPlayerAuth'

export type PlayerAuthState = LocalPlayerSession

export interface PlayerAuthContextValue {
  session: PlayerAuthState
  register: (input: LocalCredentials) => Promise<LocalAuthResult>
  signIn: (input: LocalCredentials) => Promise<LocalAuthResult>
  signOut: () => LocalSignOutResult
}

export const PlayerAuthContext = createContext<PlayerAuthContextValue | null>(null)
