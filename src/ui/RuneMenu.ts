import { t, localize } from '../i18n'
import { bosses, type BossId } from '../config/bosses'
import { runeIds, runes, synergies, synergyFor, type RuneId, type RuneSlots } from '../config/runes'

import { closeIcon, cartoonRuneIcons } from './CartoonIcons'

export const runeIcons: Record<RuneId, string> = cartoonRuneIcons

export class RuneMenu {
  private overlay = document.createElement('section')
  private title: HTMLElement
  private combo: HTMLElement
  private close: HTMLButtonElement
  private rows: { id: RuneId; status: HTMLElement; buttons: HTMLButtonElement[] }[]

  constructor(parent: HTMLElement, close: () => void, equip: (slot: 0 | 1, id: RuneId | null) => void) {
    this.overlay.className = 'overlay rune-overlay'
    this.overlay.hidden = true
    this.overlay.setAttribute('role', 'dialog')
    this.overlay.setAttribute('aria-modal', 'true')
    this.overlay.setAttribute('aria-labelledby', 'rune-title')
    this.overlay.innerHTML = `
      <div class="panel rune-panel">
        <header class="modal-header">
          <h2 id="rune-title" tabindex="-1"></h2>
          <button class="panel-close close-runes" type="button" aria-label="Close runes">${closeIcon}</button>
        </header>
        <div class="modal-body" tabindex="0" role="region" aria-label="Weapon runes">
        <p class="rune-combination"></p>
        <div class="rune-list"></div>
        </div>
      </div>`
    parent.append(this.overlay)
    this.title = this.overlay.querySelector('#rune-title')!
    this.combo = this.overlay.querySelector('.rune-combination')!
    this.close = this.overlay.querySelector('.close-runes')!
    this.close.addEventListener('click', close)
    this.rows = runeIds.map(id => {
      const row = document.createElement('div')
      row.className = 'rune-card'
      row.innerHTML = `<div class="rune-sigil" style="color:${runes[id].color}">${runeIcons[id]}</div>
        <div class="rune-detail"><strong>${runes[id].name}</strong><p>${runes[id].description}</p><small></small></div>
        <div class="rune-actions"><button type="button"></button><button type="button"></button></div>`
      this.overlay.querySelector('.rune-list')!.append(row)
      const buttons = Array.from(row.querySelectorAll('button'))
      for (const slot of [0, 1] as const) {
        buttons[slot].addEventListener('click', () => equip(slot, buttons[slot].getAttribute('aria-pressed') === 'true' ? null : id))
      }
      return { id, status: row.querySelector('small')!, buttons }
    })
    localize(this.overlay)
  }

  update(defeated: ReadonlySet<BossId>, slots: RuneSlots) {
    const synergy = synergyFor(slots)
    this.combo.textContent = synergy
      ? t`${synergies[synergy].name} · ${synergies[synergy].description}`
      : t("Equip two different runes to activate a combination.")
    for (const { id, status, buttons } of this.rows) {
      const rune = runes[id]
      const unlocked = defeated.has(rune.unlock)
      const active = slots.indexOf(id)
      status.textContent = unlocked ? (active < 0 ? t("Unlocked") : t`Equipped · Slot ${active + 1}`) : t`Locked · Defeat ${bosses[rune.unlock].name}`
      buttons.forEach((button, slot) => {
        const selected = slot === active
        button.disabled = !unlocked
        button.textContent = selected ? t`Remove ${slot + 1}` : t`Slot ${slot + 1}`
        button.setAttribute('aria-pressed', String(selected))
        button.setAttribute('aria-label', selected ? t`Unequip ${rune.name} from slot ${slot + 1}` : t`Equip ${rune.name} in slot ${slot + 1}`)
      })
    }
  }

  show(visible: boolean) {
    this.overlay.hidden = !visible
    if (!visible) return
    this.title.textContent = t("Weapon runes")
    this.title.focus({ preventScroll: true })
    this.overlay.querySelector('.modal-body')!.scrollTop = 0
  }
}
