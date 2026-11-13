import { talents, talentKeys, progressionBalance, type Talent } from '../config/balance'
import { t } from '../i18n'
import type { Progression } from '../systems/Progression'
import { upgradeIcon, shieldIcon, bagIcon } from './CartoonIcons'

const icons: Record<Talent, string> = { warrior: upgradeIcon, resilience: shieldIcon, gatherer: bagIcon }
const bonus: Record<Talent, (rank?: number) => string> = {
  warrior: (rank = 1) => t`+${Math.round(talents.warrior.gain * rank * 100)}% damage`,
  resilience: (rank = 1) => t`+${Math.round(talents.resilience.gain * rank * 100)}% health`,
  gatherer: (rank = 1) => t`+${Math.round(talents.gatherer.gain * rank * 100)}% capacity`,
}

export class TalentChoices {
  private root = document.createElement('section')
  private heading: HTMLElement
  private status: HTMLElement
  private summary: HTMLElement
  private choices: HTMLElement
  private buttons: { key: Talent; button: HTMLButtonElement }[]

  constructor(parent: HTMLElement, choose: (key: Talent) => void) {
    this.root.className = 'talent-section'
    this.root.setAttribute('aria-labelledby', 'talent-title')
    this.root.innerHTML = `<div class="talent-heading"><h3 id="talent-title" tabindex="-1"></h3><span class="talent-status"></span></div><p class="talent-summary"></p><div class="talent-choices"></div>`
    parent.prepend(this.root)
    this.heading = this.root.querySelector('h3')!
    this.status = this.root.querySelector('.talent-status')!
    this.summary = this.root.querySelector('.talent-summary')!
    this.choices = this.root.querySelector('.talent-choices')!
    this.buttons = talentKeys.map(key => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = `talent-choice talent-${key}`
      button.dataset.talent = key
      button.addEventListener('click', () => {
        choose(key)
        this.heading.focus({ preventScroll: true })
      })
      this.choices.append(button)
      return { key, button }
    })
  }

  update(progress: Progression) {
    const available = progress.talentPoints
    this.heading.textContent = t('Talents')
    this.status.textContent = available ? t`Choices: ${available}` : t`Next at level ${(Math.floor(progress.level / progressionBalance.talentInterval) + 1) * progressionBalance.talentInterval}`
    this.choices.hidden = available === 0
    const acquired = talentKeys.filter(key => progress.talentRank(key) > 0)
    this.summary.textContent = available ? t('Choose one permanent bonus.') : acquired.length
      ? acquired.map(key => `${t(talents[key].label)} ${progress.talentRank(key)} · ${bonus[key](progress.talentRank(key))}`).join(' / ')
      : t('One talent every 5 levels.')
    for (const { key, button } of this.buttons) {
      const stat = talents[key].stat
      const current = progress.stat(stat)
      const next = progress.stat(stat, progress.rank(stat), key)
      const currentLabel = current === next && key === 'warrior' ? `+${Math.round(progress.damageBonus * 100)}%` : String(current)
      const nextLabel = current === next && key === 'warrior' ? `+${Math.round((progress.damageBonus + talents.warrior.gain) * 100)}%` : String(next)
      button.disabled = available === 0
      button.innerHTML = `<span class="talent-icon">${icons[key]}</span><span class="talent-copy"><strong>${t(talents[key].label)}</strong><span>${bonus[key]()}</span></span><span class="talent-preview">${currentLabel} <span aria-hidden="true">›</span> <b>${nextLabel}</b></span>`
      button.setAttribute('aria-label', t`Choose ${talents[key].label}: ${currentLabel} to ${nextLabel}`)
    }
  }
}
