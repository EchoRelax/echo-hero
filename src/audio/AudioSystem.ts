import type { Settings } from '../systems/Settings'
import { soundCues, type Sound } from './SoundBank'
import { crazyGames } from '../platform/CrazyGames'
export type { Sound } from './SoundBank'

/** Plays licensed local recordings. No oscillators or procedural audio fallback. */
export class AudioSystem {
  private context?: AudioContext
  private master?: GainNode
  private buffers = new Map<string, AudioBuffer>()
  private downloads = new Map<string, Promise<ArrayBuffer | undefined>>()
  private decoding = new Map<string, Promise<void>>()
  private voices = new Map<AudioBufferSourceNode, Sound>()
  private last = new Map<Sound, number>()
  private variants = new Map<Sound, number>()
  private hidden = document.hidden
  private available = true
  private epoch = 0
  private platformMuted = false
  private suspended = false

  constructor(private settings: Settings) {
    crazyGames.onAudioChanged(muted => { this.platformMuted = muted; this.apply(this.settings) })
    // Fetch without creating an AudioContext or blocking the first playable frame.
    for (const cue of Object.values(soundCues)) {
      for (const file of cue.files) this.download(file)
    }
    const unlock = () => { void this.unlock() }
    window.addEventListener('pointerdown', unlock, { capture: true })
    window.addEventListener('keydown', unlock, { capture: true })
    document.addEventListener('visibilitychange', () => {
      this.hidden = document.hidden
      if (this.hidden) this.stop()
      this.apply(this.settings)
    })
  }

  private async unlock() {
    if (!this.available) return
    try {
      if (!this.context) {
        this.context = new AudioContext()
        this.master = this.context.createGain()
        const limiter = this.context.createDynamicsCompressor()
        limiter.threshold.value = -10
        limiter.knee.value = 8
        limiter.ratio.value = 5
        this.master.connect(limiter).connect(this.context.destination)
        this.apply(this.settings)
        for (const file of this.downloads.keys()) void this.decode(file)
      }
      if (this.context.state === 'suspended') await this.context.resume()
    } catch (error) { console.warn('Audio unavailable', error); this.available = false }
  }

  private download(file: string) {
    if (this.downloads.has(file) || this.decoding.has(file)) return
    this.downloads.set(file, fetch(`${import.meta.env.BASE_URL}audio/${file}.wav`)
      .then(response => {
        if (!response.ok) throw new Error(`Audio ${file}: HTTP ${response.status}`)
        return response.arrayBuffer()
      }).catch(error => { console.warn('Audio file unavailable', file, error); return undefined }))
  }

  private decode(file: string): Promise<void> {
    let pending = this.decoding.get(file)
    if (!pending) {
      pending = (async () => {
        const bytes = await this.downloads.get(file)
        if (!bytes || !this.context) return
        try { this.buffers.set(file, await this.context.decodeAudioData(bytes)) }
        catch (error) { console.warn('Audio decode failed', file, error) }
        finally { this.downloads.delete(file) }
      })()
      this.decoding.set(file, pending)
    }
    return pending
  }

  apply(settings: Settings) {
    this.settings = settings
    if (!this.context || !this.master) return
    this.master.gain.setTargetAtTime(settings.muted || this.hidden || this.platformMuted || this.suspended ? 0 : settings.master * settings.effects, this.context.currentTime, 0.025)
    if (settings.muted || this.platformMuted || this.suspended) this.stop()
  }

  setSuspended(suspended: boolean) {
    this.suspended = suspended
    this.apply(this.settings)
    if (suspended) this.stop()
  }

  async preview(sound: Sound) {
    this.stop()
    const epoch = this.epoch
    await this.unlock()
    await Promise.all(soundCues[sound].files.map(file => this.decode(file)))
    if (epoch !== this.epoch) return false
    return this.play(sound)
  }

  play(sound: Sound): boolean {
    const context = this.context
    if (!context || context.state !== 'running' || !this.master || this.hidden || this.platformMuted || this.suspended || this.settings.muted || this.settings.master * this.settings.effects === 0) return false
    const cue = soundCues[sound]
    const now = context.currentTime
    if (now - (this.last.get(sound) ?? -10) < cue.spacing) return false
    const candidates = cue.files.filter(file => this.buffers.has(file))
    if (!candidates.length) return false // Never play stale attacks after a download completes.
    const variant = this.variants.get(sound) ?? 0
    const buffer = this.buffers.get(candidates[variant % candidates.length])!
    this.variants.set(sound, variant + 1)
    const matching = [...this.voices].filter(([, playing]) => playing === sound)
    if (matching.length >= cue.limit) {
      const oldest = matching[0][0]
      oldest.stop()
      this.voices.delete(oldest)
    }
    if (this.voices.size >= 16) {
      const oldest = this.voices.keys().next().value!
      oldest.stop()
      this.voices.delete(oldest)
    }
    this.last.set(sound, now)
    const source = context.createBufferSource()
    const gain = context.createGain()
    source.buffer = buffer
    gain.gain.value = cue.gain
    source.connect(gain).connect(this.master)
    this.voices.set(source, sound)
    source.onended = () => { source.disconnect(); gain.disconnect(); this.voices.delete(source) }
    source.start()
    return true
  }

  stop() {
    this.epoch++
    for (const voice of this.voices.keys()) voice.stop()
    this.voices.clear()
    this.last.clear()
  }
}
