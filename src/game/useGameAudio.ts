import { useCallback, useEffect, useRef } from 'react'
import { SoundDirector } from '../runtime/SoundDirector'
import type { SoundCue } from '../runtime/SoundDirector'

interface UseGameAudioOptions {
  soundEnabled: boolean
  masterVolume: number
  musicVolume: number
  sfxVolume: number
  isStormActive: boolean
  isPaused: boolean
}

export function useGameAudio({
  soundEnabled,
  masterVolume,
  musicVolume,
  sfxVolume,
  isStormActive,
  isPaused,
}: UseGameAudioOptions): {
  playSound: (cue: SoundCue) => void
  soundDirectorRef: React.RefObject<SoundDirector | null>
} {
  const soundDirectorRef = useRef<SoundDirector | null>(null)

  useEffect(() => {
    const director = new SoundDirector()
    soundDirectorRef.current = director
    return () => {
      soundDirectorRef.current = null
      director.dispose()
    }
  }, [])

  useEffect(() => {
    soundDirectorRef.current?.setEnabled(soundEnabled)
  }, [soundEnabled])

  useEffect(() => {
    soundDirectorRef.current?.setMasterVolume(masterVolume)
  }, [masterVolume])

  useEffect(() => {
    soundDirectorRef.current?.setMusicVolume(musicVolume)
  }, [musicVolume])

  useEffect(() => {
    soundDirectorRef.current?.setSfxVolume(sfxVolume)
  }, [sfxVolume])

  useEffect(() => {
    if (isPaused || document.hidden) {
      soundDirectorRef.current?.pauseAmbient()
    } else if (soundEnabled) {
      soundDirectorRef.current?.resumeAmbient()
    }
  }, [isPaused, soundEnabled])

  useEffect(() => {
    const handleVisibilityChange = (): void => {
      if (document.hidden) {
        soundDirectorRef.current?.pauseAmbient()
      } else if (!isPaused && soundEnabled) {
        soundDirectorRef.current?.resumeAmbient()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isPaused, soundEnabled])

  useEffect(() => {
    soundDirectorRef.current?.setStormActive(isStormActive)
  }, [isStormActive])

  const playSound = useCallback((cue: SoundCue): void => {
    const director = soundDirectorRef.current
    if (!director) return
    void director.unlock().then(() => {
      director.play(cue)
      if (cue === 'storm') {
        director.setStormActive(true)
      }
      if (director.isEnabled() && !isPaused) {
        director.startAmbient()
      }
    })
  }, [isPaused])

  return { playSound, soundDirectorRef }
}
