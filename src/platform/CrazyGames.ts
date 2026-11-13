export interface GameStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

interface PortalSettings { muteAudio?: boolean }
interface CrazyGamesSdk {
  init(): Promise<void>
  environment: 'local' | 'crazygames' | 'disabled'
  data: GameStorage
  game: {
    settings: PortalSettings
    addSettingsChangeListener(listener: (settings: PortalSettings) => void): void
    loadingStart(): void
    loadingStop(): void
    gameplayStart(): void
    gameplayStop(): void
    happytime(): void
    reportGameCompletedPercentage?(percentage: number): void
  }
  user?: {
    systemInfo?: { locale?: string }
    addAuthListener?(listener: () => void): void
  }
}

declare global {
  interface Window { CrazyGames?: { SDK: CrazyGamesSdk } }
}

const sdkUrl = 'https://sdk.crazygames.com/crazygames-sdk-v3.js'
const migrationKey = 'echo-hunt-sdk-migration-v1'
const saveKeys = ['echo-hunt-progress', 'echo-hunt-settings']

async function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error(message)), 10000)
    })])
  } finally { clearTimeout(timeout) }
}

export class CrazyGamesPlatform {
  private client?: CrazyGamesSdk
  private initialization?: Promise<void>
  private loading = false
  private playing = false
  private muted = false
  private storageLocked = false
  private audioListeners = new Set<(muted: boolean) => void>()

  get enabled() { return this.client !== undefined }
  get data() { return this.client?.data }
  get locale() { return this.client?.user?.systemInfo?.locale }

  initialize() {
    return this.initialization ??= this.initializeOnce()
  }

  private async initializeOnce() {
    // Standalone playtests remain offline. The portal build loads the official SDK.
    if (!window.CrazyGames?.SDK && import.meta.env.VITE_GAME_PLATFORM !== 'crazygames') return
    if (!window.CrazyGames?.SDK) {
      const script = document.createElement('script')
      script.src = sdkUrl
      script.async = true
      try {
        await withTimeout(new Promise<void>((resolve, reject) => {
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('CrazyGames SDK download failed'))
          document.head.append(script)
        }), 'CrazyGames SDK download timed out')
      } catch (error) { script.remove(); throw error }
    }
    const sdk = window.CrazyGames?.SDK
    if (!sdk) throw new Error('CrazyGames SDK is missing after loading')
    await withTimeout(sdk.init(), 'CrazyGames SDK initialization timed out')
    if (sdk.environment === 'disabled') return
    // Read before any game can save. A failed Data module must never become an empty save.
    for (const key of saveKeys) sdk.data.getItem(key)
    if (sdk.data.getItem(migrationKey) !== '1') {
      for (const key of saveKeys) {
        if (sdk.data.getItem(key) !== null) continue
        let legacy: string | null = null
        try { legacy = window.localStorage.getItem(key) } catch { /* Local storage may be blocked. */ }
        if (legacy !== null) sdk.data.setItem(key, legacy)
      }
      sdk.data.setItem(migrationKey, '1')
    }
    this.client = sdk
    // The Data module reloads on sign-in. Do not save the old guest run into the new account on pagehide.
    sdk.user?.addAuthListener?.(() => { this.storageLocked = true })
    const settingsChanged = (settings: PortalSettings) => {
      this.muted = settings.muteAudio === true
      for (const listener of this.audioListeners) listener(this.muted)
    }
    settingsChanged(sdk.game.settings)
    sdk.game.addSettingsChangeListener(settingsChanged)
  }

  onAudioChanged(listener: (muted: boolean) => void) {
    this.audioListeners.add(listener)
    listener(this.muted)
    return () => this.audioListeners.delete(listener)
  }

  assertWritable() {
    if (this.storageLocked) throw new Error('CrazyGames account is changing; waiting for the SDK reload')
  }

  private call(action: (sdk: CrazyGamesSdk) => void) {
    if (!this.client) return
    try { action(this.client) } catch (error) { console.warn('CrazyGames event unavailable', error) }
  }

  loadingStart() {
    if (this.loading) return
    this.loading = true
    this.call(sdk => sdk.game.loadingStart())
  }

  loadingStop() {
    if (!this.loading) return
    this.loading = false
    this.call(sdk => sdk.game.loadingStop())
  }

  setGameplay(playing: boolean) {
    if (this.playing === playing) return
    this.playing = playing
    this.call(sdk => playing ? sdk.game.gameplayStart() : sdk.game.gameplayStop())
  }

  bossDefeated() { this.call(sdk => sdk.game.happytime()) }

  reportProgress(percentage: number) {
    this.call(sdk => sdk.game.reportGameCompletedPercentage?.(Math.max(0, Math.min(100, percentage))))
  }
}

export const crazyGames = new CrazyGamesPlatform()

/** One authoritative provider per session: never fall back from portal data to stale local data. */
export const gameStorage: GameStorage = {
  getItem: key => (crazyGames.data ?? window.localStorage).getItem(key),
  setItem: (key, value) => { crazyGames.assertWritable(); (crazyGames.data ?? window.localStorage).setItem(key, value) },
  removeItem: key => { crazyGames.assertWritable(); (crazyGames.data ?? window.localStorage).removeItem(key) },
}
