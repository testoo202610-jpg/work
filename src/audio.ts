// Original generated audio cues via WebAudio oscillators. No external assets.
// See ASSET_LICENSES.md.
export type Cue = 'click' | 'select' | 'move' | 'place' | 'construct' | 'melee' | 'ranged' | 'destroy' | 'victory' | 'defeat' | 'error'

interface CueSpec { freq: number; end: number; duration: number; type: OscillatorType; gain: number }
const CUES: Record<Cue, CueSpec> = {
  click: { freq: 660, end: 520, duration: 0.06, type: 'square', gain: 0.12 },
  select: { freq: 520, end: 760, duration: 0.08, type: 'triangle', gain: 0.14 },
  move: { freq: 320, end: 240, duration: 0.1, type: 'sine', gain: 0.16 },
  place: { freq: 240, end: 170, duration: 0.18, type: 'triangle', gain: 0.2 },
  construct: { freq: 190, end: 230, duration: 0.12, type: 'square', gain: 0.1 },
  melee: { freq: 150, end: 80, duration: 0.12, type: 'sawtooth', gain: 0.14 },
  ranged: { freq: 880, end: 420, duration: 0.1, type: 'sine', gain: 0.12 },
  destroy: { freq: 120, end: 40, duration: 0.4, type: 'sawtooth', gain: 0.2 },
  victory: { freq: 420, end: 840, duration: 0.6, type: 'triangle', gain: 0.18 },
  defeat: { freq: 300, end: 90, duration: 0.7, type: 'sine', gain: 0.18 },
  error: { freq: 220, end: 160, duration: 0.15, type: 'square', gain: 0.16 },
}

let context: AudioContext | null = null
let soundVolume = 0.8
let musicVolume = 0.5
let muted = false
let musicOsc: OscillatorNode | null = null
let musicGain: GainNode | null = null

export function configureAudio(settings: { soundVolume: number; musicVolume: number; muted: boolean }): void {
  soundVolume = settings.soundVolume
  musicVolume = settings.musicVolume
  muted = settings.muted
  if (musicGain) musicGain.gain.value = muted ? 0 : musicVolume * 0.05
}
function ctx(): AudioContext | null {
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return null
  if (!context) try { context = new AudioContext() } catch { return null }
  if (context.state === 'suspended') void context.resume()
  return context
}
export function playCue(cue: Cue): void {
  if (muted) return
  const audio = ctx()
  if (!audio) return
  const spec = CUES[cue]
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = spec.type
  osc.frequency.setValueAtTime(spec.freq, audio.currentTime)
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, spec.end), audio.currentTime + spec.duration)
  gain.gain.setValueAtTime(spec.gain * soundVolume, audio.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + spec.duration)
  osc.connect(gain).connect(audio.destination)
  osc.start()
  osc.stop(audio.currentTime + spec.duration)
}
export function startMusic(): void {
  if (musicOsc || muted) return
  const audio = ctx()
  if (!audio) return
  musicOsc = audio.createOscillator()
  musicGain = audio.createGain()
  musicOsc.type = 'sine'
  musicOsc.frequency.value = 92
  musicGain.gain.value = musicVolume * 0.05
  musicOsc.connect(musicGain).connect(audio.destination)
  musicOsc.start()
}
export function stopMusic(): void { try { musicOsc?.stop() } catch { /* stopped */ } musicOsc = null; musicGain = null }
