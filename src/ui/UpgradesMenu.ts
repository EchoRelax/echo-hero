import { closeIcon, coinIcon, upgradeIcon, heartIcon, regenerationIcon, attackSpeedIcon, pickupIcon, criticalChanceIcon, criticalDamageIcon, movementIcon, doubleAttackIcon, tripleAttackIcon, bagIcon, lightningIcon } from './CartoonIcons'
import { t, localize, getLanguage } from '../i18n'
import { upgradeKeys, upgrades, type Upgrade, type Talent } from '../config/balance'
import { TalentChoices } from './TalentChoices'
import { Progression } from '../systems/Progression'
import { recommendedTraining } from '../systems/Training'

const formatStat: Record<Upgrade, (value: number) => string> = {
  damage: value => t`${value}`,
  health: value => String(value),
  regeneration: value => String(value),
  speed: value => value.toFixed(2),
  pickup: value => value.toFixed(1),
  criticalChance: value => t`${Math.round(value * 100)}%`,
  criticalDamage: value => t`×${value.toFixed(2)}`,
  movement: value => value.toFixed(2),
  doubleAttack: value => t`${Math.round(value * 100)}%`,
  tripleAttack: value => t`${Math.round(value * 100)}%`,
  capacity: value => String(value),
  runeDamage: value => t`×${value.toFixed(2)}`,

}

const labels: Record<Upgrade, string> = {
  damage: 'Damage', health: 'Health', regeneration: 'Regeneration', speed: 'Attack Speed',
  pickup: 'Pickup Radius', criticalChance: 'Crit chance', criticalDamage: 'Crit damage',
  movement: 'Movement', doubleAttack: 'Double strike', tripleAttack: 'Triple strike',
  capacity: 'Capacity', runeDamage: 'Rune Damage',
}
const icons: Record<Upgrade, string> = {
  damage: upgradeIcon, health: heartIcon, regeneration: regenerationIcon, speed: attackSpeedIcon,
  pickup: pickupIcon, criticalChance: criticalChanceIcon, criticalDamage: criticalDamageIcon,
  movement: movementIcon, doubleAttack: doubleAttackIcon, tripleAttack: tripleAttackIcon,
  capacity: bagIcon, runeDamage: lightningIcon,
}
const units: Partial<Record<Upgrade, string>> = { health: 'HP', regeneration: 'HP/s', speed: 's', pickup: 'm', movement: 'm/s' }
const compactPrices = {
  en: new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }),
  ru: new Intl.NumberFormat('ru', { notation: 'compact', maximumFractionDigits: 1 }),
}

const descriptions: Record<Upgrade, string> = {
  damage: "Increase your power",
  health: "Increase your health",
  regeneration: "Recover health faster",
  speed: "Strike more often",
  pickup: "Collect loot from farther away",
  criticalChance: "Land more critical hits",
  criticalDamage: "Strengthen critical hits",
  movement: "Move faster",
  doubleAttack: "Attack twice more often",
  tripleAttack: "Attack three times more often",
  capacity: "Carry more coins",
  runeDamage: "Strengthen rune damage",
}

export class UpgradesMenu {
  private readonly overlay = document.createElement('section')
  private readonly gold: HTMLElement
  private readonly close: HTMLButtonElement
  private readonly talentChoices: TalentChoices
  private readonly talentToggle: HTMLButtonElement
  private readonly title: HTMLElement
  private readonly list: HTMLElement
  private readonly talentView: HTMLElement
  private showingTalents = false
  private availableTalents = 0
  private readonly rows: { key: Upgrade; detail: HTMLElement; buy: HTMLButtonElement }[]

  constructor(parent: HTMLElement, close: () => void, buy: (key: Upgrade) => void, chooseTalent: (key: Talent) => void) {
    this.overlay.className = 'overlay upgrade-overlay'
    this.overlay.hidden = true
    this.overlay.setAttribute('role', 'dialog')
    this.overlay.setAttribute('aria-modal', 'true')
    this.overlay.setAttribute('aria-labelledby', 'upgrades-title')
    this.overlay.innerHTML = `
      <div class="panel upgrades-panel">
        <header class="modal-header">
          <h2 id="upgrades-title" tabindex="-1">Upgrades</h2>
          <button class="talent-toggle" type="button" aria-controls="upgrade-talents" aria-expanded="false"><span></span><b hidden></b></button>
          <span class="modal-wallet">${coinIcon}<span class="upgrade-gold"></span></span>
          <button class="panel-close close-upgrades" type="button" aria-label="Close upgrades">${closeIcon}</button>
        </header>
        <div class="modal-body upgrade-list" tabindex="0" role="region" aria-label="Upgrades"></div>
        <div class="modal-body upgrade-talents" id="upgrade-talents" tabindex="0" role="region" aria-label="Talents" hidden></div>
      </div>`
    parent.append(this.overlay)
    this.gold = this.overlay.querySelector('.upgrade-gold')!
    this.close = this.overlay.querySelector('.close-upgrades')!
    this.close.addEventListener('click', close)
    this.title = this.overlay.querySelector('#upgrades-title')!
    this.list = this.overlay.querySelector('.upgrade-list')!
    this.talentView = this.overlay.querySelector('.upgrade-talents')!
    this.talentToggle = this.overlay.querySelector('.talent-toggle')!
    this.talentToggle.addEventListener('click', () => { this.showingTalents = !this.showingTalents; this.renderView() })
    this.talentChoices = new TalentChoices(this.talentView, chooseTalent)
    this.rows = upgradeKeys.map(key => {
      const row = document.createElement('div')
      row.className = 'upgrade-row'
      row.dataset.upgrade = key
      row.innerHTML = `<div class="upgrade-info"><div class="upgrade-label"><span class="upgrade-icon">${icons[key]}</span><strong>${labels[key]}</strong></div><div class="upgrade-stats"></div></div><button class="upgrade-buy" type="button"></button>`
      row.title = descriptions[key]
      const button = row.querySelector('button')!
      button.addEventListener('click', () => {
        buy(key)
        if (button.disabled) this.close.focus()
      })
      this.list.append(row)
      return { key, detail: row.querySelector<HTMLElement>('.upgrade-stats')!, buy: button }
    })
    localize(this.overlay)
  }

  setVisible(visible: boolean) {
    this.overlay.hidden = !visible
    if (visible) {
      this.showingTalents = false
      this.renderView()
      this.overlay.querySelector<HTMLElement>('#upgrades-title')!.focus({ preventScroll: true })
      this.overlay.querySelector('.upgrade-list')!.scrollTop = 0
    }
  }

  update(progress: Progression) {
    this.talentChoices.update(progress)
    this.availableTalents = progress.talentPoints
    this.renderView()
    this.gold.textContent = String(progress.gold)
    this.gold.parentElement!.setAttribute('aria-label', t`${progress.gold} Gold banked`)
    const recommended = recommendedTraining(progress)
    for (const { key, detail, buy } of this.rows) {
      const rank = progress.rank(key)
      buy.closest('.upgrade-row')?.classList.toggle('recommended-upgrade', key === recommended)
      const maxed = rank === upgrades[key].limit
      const price = progress.price(key)
      const stat = formatStat[key](progress.stat(key))
      const next = maxed ? '' : formatStat[key](progress.stat(key, rank + 1))
      const unit = units[key] ? `<span class="upgrade-stat-unit">${t(units[key]!)}</span>` : ''
      detail.innerHTML = `<span>${stat}</span>${maxed ? '' : ` <span class="upgrade-stat-arrow" aria-hidden="true">›</span> <span class="upgrade-stat-next">${next}</span>`}${unit}`
      detail.setAttribute('aria-label', maxed ? t`Current value: ${stat}` : t`Current value: ${stat}, after upgrade: ${next}`)
      buy.innerHTML = maxed ? t("MAX") : `${coinIcon}<span>${compactPrices[getLanguage()].format(price).replace(/\s/g, '')}</span>`
      buy.setAttribute('aria-label', maxed ? t`${upgrades[key].label}, maximum reached` : t`Buy ${upgrades[key].label} for ${price} Gold`)
      buy.disabled = maxed || progress.gold < price
    }
  }

  private renderView() {
    this.title.textContent = t('Upgrades')
    this.list.hidden = this.showingTalents
    this.talentView.hidden = !this.showingTalents
    this.talentToggle.querySelector('span')!.textContent = this.showingTalents ? t('All upgrades') : t('Talents')
    const badge = this.talentToggle.querySelector('b')!
    badge.hidden = this.availableTalents === 0 || this.showingTalents
    badge.textContent = String(this.availableTalents)
    this.talentToggle.setAttribute('aria-expanded', String(this.showingTalents))
    this.overlay.querySelector('.upgrades-panel')!.classList.toggle('showing-talents', this.showingTalents)
  }
}
