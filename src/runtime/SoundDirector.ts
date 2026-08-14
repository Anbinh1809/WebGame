import { GAME_PACK_AUDIO } from '../assets/packManifest'

export type SoundCue =
  | 'buttonHover'
  | 'buttonClick'
  | 'menuOpen'
  | 'menuClose'
  | 'pause'
  | 'resume'
  | 'godPowerSelected'
  | 'godPowerCast'
  | 'eraAdvance'
  | 'stormAlert'
  | 'notification'
  | 'tileInspect'
  | 'tileModified'
  | 'success'
  | 'warning'
  | 'danger'
  | 'tool'
  | 'event'
  | 'era'
  | 'storm'

type AudioContextConstructor = typeof AudioContext

function audioContextConstructor(): AudioContextConstructor | undefined {
  if (typeof window === 'undefined') return undefined
  const candidate = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext
  return typeof candidate === 'function' ? candidate : undefined
}

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum))
}

const AMBIENT_PLAYLIST = [
  GAME_PACK_AUDIO.ambientTheme,
  GAME_PACK_AUDIO.ambientPeaceful,
  GAME_PACK_AUDIO.ambientExplore,
]

export class SoundDirector {
  private context: AudioContext | undefined
  private masterGain: GainNode | undefined
  private sfxGain: GainNode | undefined
  private musicGain: GainNode | undefined
  private stormOscillator: OscillatorNode | undefined
  private stormGain: GainNode | undefined
  private ambientOscillatorA: OscillatorNode | undefined
  private ambientOscillatorB: OscillatorNode | undefined
  private ambientGain: GainNode | undefined
  private ambientAudioElement: HTMLAudioElement | undefined
  private currentTrackIndex = 0
  private enabled = true
  private masterVolume = 1.0
  private musicVolume = 0.55
  private sfxVolume = 0.85
  private ambientPlaying = false

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) {
      this.stopStorm()
      this.stopAmbient()
    } else if (this.ambientPlaying) {
      this.startAmbient()
    }
  }

  public isEnabled(): boolean {
    return this.enabled
  }

  public setMasterVolume(volume: number): void {
    this.masterVolume = clamp(volume)
    if (this.masterGain && this.context) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.context.currentTime, 0.05)
    }
    this.updateAmbientAudioVolume()
  }

  public getMasterVolume(): number {
    return this.masterVolume
  }

  public setMusicVolume(volume: number): void {
    this.musicVolume = clamp(volume)
    if (this.musicGain && this.context) {
      this.musicGain.gain.setTargetAtTime(this.musicVolume * 0.02, this.context.currentTime, 0.05)
    }
    this.updateAmbientAudioVolume()
  }

  public getMusicVolume(): number {
    return this.musicVolume
  }

  public setSfxVolume(volume: number): void {
    this.sfxVolume = clamp(volume)
    if (this.sfxGain && this.context) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.context.currentTime, 0.05)
    }
  }

  public getSfxVolume(): number {
    return this.sfxVolume
  }

  private updateAmbientAudioVolume(): void {
    if (this.ambientAudioElement) {
      this.ambientAudioElement.volume = clamp(this.masterVolume * this.musicVolume * 0.42)
    }
  }

  public async unlock(): Promise<void> {
    if (!this.enabled) return
    const context = this.ensureContext()
    if (context && context.state === 'suspended') {
      try {
        await context.resume()
      } catch {
        // Safe degrade
      }
    }
  }

  public play(cue: SoundCue): void {
    this.playCue(cue)
  }

  public setStormActive(active: boolean): void {
    this.updateStorm(active ? 1.0 : 0)
  }

  private sfxOutput(): AudioNode | undefined {
    return this.sfxGain ?? this.masterGain ?? this.context?.destination
  }

  public playCue(cue: SoundCue): void {
    if (!this.enabled || this.sfxVolume <= 0.001 || this.masterVolume <= 0.001) return
    const context = this.ensureContext()
    if (!context) return
    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined)
    }

    const output = this.sfxOutput()
    if (!output) return

    const now = context.currentTime

    switch (cue) {
      case 'buttonHover': {
        const osc = context.createOscillator()
        const gain = context.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(440, now)
        osc.frequency.exponentialRampToValueAtTime(520, now + 0.04)
        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.exponentialRampToValueAtTime(0.018, now + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045)
        osc.connect(gain).connect(output)
        osc.start(now)
        try {
          osc.stop(now + 0.05)
        } catch {
          // Safe ignore
        }
        break
      }

      case 'buttonClick': {
        const osc = context.createOscillator()
        const gain = context.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(523.25, now)
        osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.06)
        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.exponentialRampToValueAtTime(0.04, now + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07)
        osc.connect(gain).connect(output)
        osc.start(now)
        try {
          osc.stop(now + 0.08)
        } catch {
          // Safe ignore
        }
        break
      }

      case 'menuOpen':
      case 'pause': {
        const osc = context.createOscillator()
        const gain = context.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(330, now)
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12)
        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.exponentialRampToValueAtTime(0.035, now + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
        osc.connect(gain).connect(output)
        osc.start(now)
        try {
          osc.stop(now + 0.13)
        } catch {
          // Safe ignore
        }
        break
      }

      case 'menuClose':
      case 'resume': {
        const osc = context.createOscillator()
        const gain = context.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(659.25, now)
        osc.frequency.exponentialRampToValueAtTime(330, now + 0.1)
        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.exponentialRampToValueAtTime(0.03, now + 0.015)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1)
        osc.connect(gain).connect(output)
        osc.start(now)
        try {
          osc.stop(now + 0.11)
        } catch {
          // Safe ignore
        }
        break
      }

      case 'tool':
      case 'godPowerSelected': {
        const osc = context.createOscillator()
        const gain = context.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(293.66, now)
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.08)
        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.exponentialRampToValueAtTime(0.045, now + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1)
        osc.connect(gain).connect(output)
        osc.start(now)
        try {
          osc.stop(now + 0.11)
        } catch {
          // Safe ignore
        }
        break
      }

      case 'godPowerCast': {
        const osc1 = context.createOscillator()
        const osc2 = context.createOscillator()
        const gain = context.createGain()
        osc1.type = 'triangle'
        osc2.type = 'sine'
        osc1.frequency.setValueAtTime(146.83, now)
        osc1.frequency.exponentialRampToValueAtTime(587.33, now + 0.22)
        osc2.frequency.setValueAtTime(220, now)
        osc2.frequency.exponentialRampToValueAtTime(880, now + 0.24)
        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.exponentialRampToValueAtTime(0.06, now + 0.03)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25)
        osc1.connect(gain)
        osc2.connect(gain)
        gain.connect(output)
        osc1.start(now)
        osc2.start(now)
        try {
          osc1.stop(now + 0.26)
          osc2.stop(now + 0.26)
        } catch {
          // Safe ignore
        }
        break
      }

      case 'era':
      case 'eraAdvance': {
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25]
        notes.forEach((freq, index) => {
          const osc = context.createOscillator()
          const gain = context.createGain()
          const start = now + index * 0.08
          osc.type = 'triangle'
          osc.frequency.setValueAtTime(freq, start)
          gain.gain.setValueAtTime(0.0001, start)
          gain.gain.exponentialRampToValueAtTime(0.05, start + 0.02)
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3)
          osc.connect(gain).connect(output)
          osc.start(start)
          try {
            osc.stop(start + 0.32)
          } catch {
            // Safe ignore
          }
        })
        break
      }

      case 'storm':
      case 'stormAlert': {
        const osc = context.createOscillator()
        const gain = context.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(110, now)
        osc.frequency.linearRampToValueAtTime(73.42, now + 0.35)
        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.exponentialRampToValueAtTime(0.05, now + 0.04)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35)
        osc.connect(gain).connect(output)
        osc.start(now)
        try {
          osc.stop(now + 0.36)
        } catch {
          // Safe ignore
        }
        break
      }

      case 'event':
      case 'notification': {
        const osc = context.createOscillator()
        const gain = context.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(587.33, now)
        osc.frequency.setValueAtTime(880, now + 0.07)
        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.exponentialRampToValueAtTime(0.04, now + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
        osc.connect(gain).connect(output)
        osc.start(now)
        try {
          osc.stop(now + 0.19)
        } catch {
          // Safe ignore
        }
        break
      }

      case 'tileInspect': {
        const osc = context.createOscillator()
        const gain = context.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(220, now)
        osc.frequency.exponentialRampToValueAtTime(330, now + 0.07)
        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.exponentialRampToValueAtTime(0.03, now + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08)
        osc.connect(gain).connect(output)
        osc.start(now)
        try {
          osc.stop(now + 0.09)
        } catch {
          // Safe ignore
        }
        break
      }

      case 'tileModified':
      case 'success': {
        const osc = context.createOscillator()
        const gain = context.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(330, now)
        osc.frequency.exponentialRampToValueAtTime(493.88, now + 0.12)
        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.exponentialRampToValueAtTime(0.04, now + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14)
        osc.connect(gain).connect(output)
        osc.start(now)
        try {
          osc.stop(now + 0.15)
        } catch {
          // Safe ignore
        }
        break
      }

      case 'warning': {
        const osc = context.createOscillator()
        const gain = context.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(220, now)
        osc.frequency.setValueAtTime(196, now + 0.06)
        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.exponentialRampToValueAtTime(0.03, now + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
        osc.connect(gain).connect(output)
        osc.start(now)
        try {
          osc.stop(now + 0.13)
        } catch {
          // Safe ignore
        }
        break
      }

      case 'danger': {
        const osc = context.createOscillator()
        const gain = context.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(164.81, now)
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.18)
        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.exponentialRampToValueAtTime(0.05, now + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)
        osc.connect(gain).connect(output)
        osc.start(now)
        try {
          osc.stop(now + 0.22)
        } catch {
          // Safe ignore
        }
        break
      }
    }
  }

  public updateStorm(intensity: number): void {
    if (!this.enabled || intensity <= 0.01 || this.sfxVolume <= 0.001 || this.masterVolume <= 0.001) {
      this.stopStorm()
      return
    }

    const context = this.ensureContext()
    if (!context) return
    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined)
    }

    const output = this.sfxOutput()
    if (!output) return

    const targetGain = Math.min(0.06, intensity * 0.06)
    const targetFreq = 55 + intensity * 45

    if (!this.stormOscillator || !this.stormGain) {
      const osc = context.createOscillator()
      const gain = context.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(targetFreq, context.currentTime)
      gain.gain.setValueAtTime(0.0001, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(targetGain, context.currentTime + 0.2)
      osc.connect(gain).connect(output)
      osc.start()
      this.stormOscillator = osc
      this.stormGain = gain
      return
    }

    this.stormOscillator.frequency.setTargetAtTime(targetFreq, context.currentTime, 0.2)
    this.stormGain.gain.setTargetAtTime(targetGain, context.currentTime, 0.2)
  }

  public startAmbient(): void {
    this.ambientPlaying = true
    if (!this.enabled || this.musicVolume <= 0.001 || this.masterVolume <= 0.001) return

    if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      try {
        const trackUrl = AMBIENT_PLAYLIST[this.currentTrackIndex % AMBIENT_PLAYLIST.length] ?? GAME_PACK_AUDIO.ambientTheme
        if (!this.ambientAudioElement) {
          const audio = new Audio(trackUrl)
          audio.loop = false
          audio.addEventListener('ended', () => {
            this.currentTrackIndex = (this.currentTrackIndex + 1) % AMBIENT_PLAYLIST.length
            if (this.ambientAudioElement && this.ambientPlaying) {
              this.ambientAudioElement.src = AMBIENT_PLAYLIST[this.currentTrackIndex] ?? GAME_PACK_AUDIO.ambientTheme
              this.ambientAudioElement.play().catch(() => this.startAmbientSynth())
            }
          })
          this.ambientAudioElement = audio
        } else {
          if (!this.ambientAudioElement.src.includes(trackUrl)) {
            this.ambientAudioElement.src = trackUrl
          }
        }
        this.updateAmbientAudioVolume()
        const playPromise = this.ambientAudioElement.play()
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            this.startAmbientSynth()
          })
        }
        return
      } catch {
        // Fallback
      }
    }

    this.startAmbientSynth()
  }

  public pauseAmbient(): void {
    if (this.ambientAudioElement) {
      try {
        this.ambientAudioElement.pause()
      } catch {
        // Ignore
      }
    }
    this.stopAmbientSynth()
  }

  public resumeAmbient(): void {
    if (this.ambientPlaying && this.enabled) {
      this.startAmbient()
    }
  }

  private startAmbientSynth(): void {
    const context = this.ensureContext()
    if (!context || this.ambientGain) return
    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined)
    }

    const output = this.musicGain ?? this.masterGain ?? context.destination

    const now = context.currentTime
    const oscA = context.createOscillator()
    const oscB = context.createOscillator()
    const gain = context.createGain()

    oscA.type = 'sine'
    oscA.frequency.setValueAtTime(110, now) // A2
    oscB.type = 'sine'
    oscB.frequency.setValueAtTime(164.81, now) // E3

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.008 * this.musicVolume, now + 2.0)

    oscA.connect(gain)
    oscB.connect(gain)
    gain.connect(output)

    oscA.start(now)
    oscB.start(now)

    this.ambientOscillatorA = oscA
    this.ambientOscillatorB = oscB
    this.ambientGain = gain
  }

  private stopAmbientSynth(): void {
    const context = this.context
    const oscA = this.ambientOscillatorA
    const oscB = this.ambientOscillatorB
    const gain = this.ambientGain
    this.ambientOscillatorA = undefined
    this.ambientOscillatorB = undefined
    this.ambientGain = undefined

    if (!context || !gain) return
    gain.gain.cancelScheduledValues(context.currentTime)
    gain.gain.setTargetAtTime(0.0001, context.currentTime, 0.4)
    try {
      oscA?.stop(context.currentTime + 0.5)
      oscB?.stop(context.currentTime + 0.5)
    } catch {
      // Safe ignore
    }
  }

  public stopAmbient(): void {
    this.ambientPlaying = false
    if (this.ambientAudioElement) {
      try {
        this.ambientAudioElement.pause()
        this.ambientAudioElement.currentTime = 0
      } catch {
        // Ignore
      }
      this.ambientAudioElement = undefined
    }
    this.stopAmbientSynth()
  }

  public dispose(): void {
    this.stopStorm()
    this.stopAmbient()
    void this.context?.close().catch(() => undefined)
    this.context = undefined
    this.masterGain = undefined
    this.sfxGain = undefined
    this.musicGain = undefined
  }

  private ensureContext(): AudioContext | undefined {
    if (this.context) return this.context
    const Constructor = audioContextConstructor()
    if (!Constructor) return undefined
    try {
      const context = new Constructor()
      const master = context.createGain()
      master.gain.setValueAtTime(this.masterVolume, context.currentTime)
      master.connect(context.destination)

      const sfx = context.createGain()
      sfx.gain.setValueAtTime(this.sfxVolume, context.currentTime)
      sfx.connect(master)

      const music = context.createGain()
      music.gain.setValueAtTime(this.musicVolume * 0.02, context.currentTime)
      music.connect(master)

      this.context = context
      this.masterGain = master
      this.sfxGain = sfx
      this.musicGain = music
      return this.context
    } catch {
      return undefined
    }
  }

  private stopStorm(): void {
    const context = this.context
    const oscillator = this.stormOscillator
    const gain = this.stormGain
    this.stormOscillator = undefined
    this.stormGain = undefined
    if (!oscillator || !gain || !context) return
    gain.gain.cancelScheduledValues(context.currentTime)
    gain.gain.setTargetAtTime(0.0001, context.currentTime, 0.06)
    try {
      oscillator.stop(context.currentTime + 0.2)
    } catch {
      // Safe ignore
    }
  }
}
