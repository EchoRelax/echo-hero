import type { Language } from '../i18n'
import { crazyGames, gameStorage } from '../platform/CrazyGames'
export type Quality = 'auto' | 'low' | 'high'
export interface Settings {
  muted: boolean
  master: number
  effects: number
  quality: Quality
  language: Language
}
const key = 'echo-hunt-settings'
export const defaultSettings: Settings = { muted: false, master: 0.7, effects: 0.8, quality: 'auto', language: 'ru' }
export function loadSettings(): Settings {
  try {
    const data = JSON.parse(gameStorage.getItem(key) ?? '{}')
    const initialLanguage = crazyGames.enabled ? (crazyGames.locale?.toLowerCase().startsWith('ru') ? 'ru' : 'en') : defaultSettings.language
    const volume = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback
    return {
      language: data?.language === 'en' || data?.language === 'ru' ? data.language : initialLanguage,
      muted: typeof data?.muted === 'boolean' ? data.muted : false,
      master: volume(data?.master, defaultSettings.master),
      effects: volume(data?.effects, defaultSettings.effects),
      quality: ['auto', 'low', 'high'].includes(data?.quality) ? data.quality : 'auto',
    }
  } catch { return { ...defaultSettings } }
}
export function storeSettings(settings: Settings) {
  try { gameStorage.setItem(key, JSON.stringify(settings)); return true } catch { return false }
}
