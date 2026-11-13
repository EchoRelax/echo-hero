import { closeIcon } from './CartoonIcons'
import { t, localize, setLanguage, type Language } from '../i18n'
import type { Settings } from '../systems/Settings'

export class SettingsMenu {
  private overlay = document.createElement('section')
  private confirmation: HTMLElement
  private status: HTMLElement
  private opener?: HTMLElement

  constructor(root: HTMLElement, settings: Settings, actions: {
    close: () => void
    change: () => boolean
    reset: () => boolean
  }) {
    this.overlay.className = 'overlay settings-overlay'
    this.overlay.hidden = true
    this.overlay.setAttribute('role', 'dialog')
    this.overlay.setAttribute('aria-modal', 'true')
    this.overlay.setAttribute('aria-labelledby', 'settings-title')
    this.overlay.innerHTML = `<div class="panel settings-panel">
      <header class="modal-header">
        <h2 id="settings-title">Settings</h2>
        <button class="settings-close panel-close" aria-label="Close settings" type="button">${closeIcon}</button>
      </header>
      <div class="modal-body settings-body" tabindex="0" role="region" aria-label="Settings">
      <label class="setting-row"><span>Language</span><select class="language-choice" aria-label="Language"><option value="ru">Русский (RU)</option><option value="en">English (EN)</option></select></label>
      <label class="setting-row"><span>Sound enabled</span><input class="sound-enabled" type="checkbox"></label>
      <label class="setting-row volume-row"><span>Master volume <output></output></span><input type="range" min="0" max="100" step="1" data-volume="master"></label>
      <label class="setting-row volume-row"><span>Sound effects <output></output></span><input type="range" min="0" max="100" step="1" data-volume="effects"></label>
      <label class="setting-row"><span>Graphics quality</span><select class="graphics-quality" aria-label="Graphics quality"><option value="auto">Auto</option><option value="low">Low</option><option value="high">High</option></select></label>
      <p class="settings-help">Low uses a lighter render resolution. High gives a sharper picture. Changes apply immediately.</p>
      <div class="settings-danger"><h3>New adventure</h3><p>Start again from level 1. This resets gold, upgrades, quests, bosses and runes.</p><button class="reset-request" type="button">Reset progress…</button>
      <div class="reset-confirmation" hidden><p>Erase your saved adventure and start over?</p><div class="rune-actions"><button class="reset-cancel" type="button">Keep playing</button><button class="reset-confirm" type="button">Erase and restart</button></div></div></div>
      <p class="settings-status" role="status" aria-live="polite"></p>
      </div>
    </div>`
    root.append(this.overlay)
    this.confirmation = this.overlay.querySelector('.reset-confirmation')!
    this.status = this.overlay.querySelector('.settings-status')!
    const changed = () => { this.status.textContent = actions.change() ? t("Settings saved") : t("Settings applied for this session. Saving is unavailable.") }
    const language = this.overlay.querySelector<HTMLSelectElement>('.language-choice')!
    language.value = settings.language
    language.addEventListener('change', () => {
      settings.language = language.value as Language
      setLanguage(settings.language)
      changed()
    })
    const enabled = this.overlay.querySelector<HTMLInputElement>('.sound-enabled')!
    enabled.checked = !settings.muted
    enabled.addEventListener('change', () => { settings.muted = !enabled.checked; changed() })
    this.overlay.querySelectorAll<HTMLInputElement>('[data-volume]').forEach(input => {
      const key = input.dataset.volume as 'master' | 'effects'
      const output = input.closest('label')!.querySelector('output')!
      input.value = String(Math.round(settings[key] * 100))
      output.value = t`${input.value}%`
      input.addEventListener('input', () => {
        settings[key] = Number(input.value) / 100
        output.value = t`${input.value}%`
        changed()
      })
    })
    const quality = this.overlay.querySelector<HTMLSelectElement>('.graphics-quality')!
    quality.value = settings.quality
    quality.addEventListener('change', () => { settings.quality = quality.value as Settings['quality']; changed() })
    this.overlay.querySelector('.settings-close')!.addEventListener('click', actions.close)
    this.overlay.querySelector('.reset-request')!.addEventListener('click', () => {
      this.confirmation.hidden = false
      this.overlay.querySelector<HTMLButtonElement>('.reset-cancel')!.focus()
    })
    this.overlay.querySelector('.reset-cancel')!.addEventListener('click', () => {
      this.confirmation.hidden = true
      this.overlay.querySelector<HTMLButtonElement>('.reset-request')!.focus()
    })
    this.overlay.querySelector('.reset-confirm')!.addEventListener('click', () => {
      if (!actions.reset()) this.status.textContent = t("Could not erase the save. Your adventure has been kept.")
    })
    this.overlay.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return
      const controls = Array.from(this.overlay.querySelectorAll<HTMLElement>('button, input, select')).filter(element => element.getClientRects().length > 0)
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    })
    localize(this.overlay)
  }

  show(visible: boolean) {
    if (visible === !this.overlay.hidden) return
    if (visible) this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    this.overlay.hidden = !visible
    this.confirmation.hidden = true
    this.status.textContent = ''
    if (visible) this.overlay.querySelector<HTMLButtonElement>('.settings-close')!.focus()
    else if (this.opener?.isConnected && !this.opener.closest('[inert]')) this.opener.focus()
  }
}
