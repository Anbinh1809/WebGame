import { useCallback, useEffect, useMemo, useState } from 'react'
import type { JSX, PropsWithChildren } from 'react'
import {
  getLocalPlayerSession,
  LOCAL_PLAYER_ACCOUNTS_KEY,
  LOCAL_PLAYER_SESSION_KEY,
  registerLocalPlayer,
  signInLocalPlayer,
  signOutLocalPlayer,
} from './localPlayerAuth'
import type { LocalAuthResult, LocalCredentials, LocalSignOutResult } from './localPlayerAuth'
import { PlayerAuthContext } from './playerAuthStore'
import type { PlayerAuthContextValue, PlayerAuthState } from './playerAuthStore'

export function PlayerAuthProvider({ children }: PropsWithChildren): JSX.Element {
  const [session, setSession] = useState<PlayerAuthState>(() => getLocalPlayerSession())

  useEffect(() => {
    const onStorageChange = (event: StorageEvent): void => {
      if (event.key === LOCAL_PLAYER_ACCOUNTS_KEY || event.key === LOCAL_PLAYER_SESSION_KEY) setSession(getLocalPlayerSession())
    }
    window.addEventListener('storage', onStorageChange)
    return () => window.removeEventListener('storage', onStorageChange)
  }, [])

  const register = useCallback(async (input: LocalCredentials): Promise<LocalAuthResult> => {
    const result = await registerLocalPlayer(input)
    if (result.ok) setSession({ status: 'authenticated', player: result.player })
    return result
  }, [])

  const signIn = useCallback(async (input: LocalCredentials): Promise<LocalAuthResult> => {
    const result = await signInLocalPlayer(input)
    if (result.ok) setSession({ status: 'authenticated', player: result.player })
    return result
  }, [])

  const signOut = useCallback((): LocalSignOutResult => {
    const result = signOutLocalPlayer()
    if (result.ok) setSession({ status: 'anonymous' })
    return result
  }, [])

  const value = useMemo<PlayerAuthContextValue>(() => ({ session, register, signIn, signOut }), [register, session, signIn, signOut])
  return <PlayerAuthContext value={value}>{children}</PlayerAuthContext>
}
