import { useContext } from 'react'
import { PlayerAuthContext } from './playerAuthStore'
import type { PlayerAuthContextValue } from './playerAuthStore'

export function usePlayerAuth(): PlayerAuthContextValue {
  const value = useContext(PlayerAuthContext)
  if (!value) throw new Error('usePlayerAuth must be used inside PlayerAuthProvider.')
  return value
}
