import { describe, expect, it } from 'vitest'
import { SoundDirector } from './SoundDirector'

describe('sound director', () => {
  it('degrades safely where Web Audio is unavailable', async () => {
    const director = new SoundDirector()
    director.setEnabled(false)
    await expect(director.unlock()).resolves.toBeUndefined()
    expect(() => {
      director.play('tool')
      director.setStormActive(true)
      director.dispose()
    }).not.toThrow()
  })

  it('manages master, music, and sfx volumes with clamping', () => {
    const director = new SoundDirector()
    director.setMasterVolume(0.7)
    expect(director.getMasterVolume()).toBe(0.7)
    director.setMasterVolume(1.5)
    expect(director.getMasterVolume()).toBe(1)
    director.setMasterVolume(-0.5)
    expect(director.getMasterVolume()).toBe(0)

    director.setMusicVolume(0.4)
    expect(director.getMusicVolume()).toBe(0.4)

    director.setSfxVolume(0.9)
    expect(director.getSfxVolume()).toBe(0.9)

    expect(() => {
      director.startAmbient()
      director.pauseAmbient()
      director.resumeAmbient()
      director.stopAmbient()
    }).not.toThrow()
  })
})

