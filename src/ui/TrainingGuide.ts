import { t, localize } from '../i18n'
import { upgrades } from '../config/balance'
import { camps, campStats } from '../config/camps'
import type { Progression } from '../systems/Progression'
import { recommendedTraining } from '../systems/Training'
import { zones, zonePoint } from '../config/zones'

export interface GuideDestination { kind: 'camp' | 'home' | 'boss' | 'upgrades'; x: number; z: number; camp?: string }

export class TrainingGuide {
  destination?: GuideDestination
  private card = document.createElement('aside')
  private title = document.createElement('strong')
  private text = document.createElement('p')
  private action = document.createElement('button')
  private active = true
  private complete = false
  private dismissed = false

  constructor(parent: HTMLElement, openUpgrades: () => void) {
    this.card.className = 'training-guide'
    this.card.setAttribute('aria-label', 'First hunt guide')
    const close = document.createElement('button')
    close.className = 'training-dismiss'
    close.textContent = '×'
    close.setAttribute('aria-label', 'Hide guide for this session')
    close.onclick = () => { this.dismissed = true; this.refresh() }
    this.action.onclick = openUpgrades
    this.card.append(close, this.title, this.text, this.action)
    parent.append(this.card)
    localize(this.card)
  }

  setActive(active: boolean) { this.active = active; this.refresh() }
  private refresh() {
    this.card.hidden = !this.active || this.complete || this.dismissed
    if (this.card.hidden) this.destination = undefined
  }

  update(progress: Progression, bossDefeated: boolean, healthFraction: number, fourthCampKills: number) {
    this.complete = bossDefeated
    this.refresh()
    if (this.card.hidden) return
    const key = recommendedTraining(progress)
    let title: string, text: string
    let action = t("Open upgrades")
    if (healthFraction < .4 && progress.baseUnlocked) {
      title = t("Rest at your camp")
      this.destination = { kind: 'home', x: 0, z: 0 }
      text = t("Stay in the campfire circle to fully heal in 3 seconds.")
    } else if (progress.cargo >= progress.stat('capacity') || (progress.cargo > 0 && key && progress.gold < progress.price(key))) {
      title = t("Bring your coins home")
      this.destination = { kind: 'home', x: 0, z: 0 }
      text = t`Bring your ${progress.cargo} coins to the campfire. Bank them to buy upgrades.`
    } else if (key && progress.gold >= progress.price(key)) {
      title = t`Train ${upgrades[key].label}`
      this.destination = { kind: 'upgrades', x: 0, z: 0 }
      const benefit = key === 'damage' ? t("Defeat enemies in fewer swings.") : key === 'health' ? t("Survive more hits before returning to camp.") : t("Carry 20 more coins on every trip.")
      text = matchMedia('(max-width:370px)').matches ? t`Next upgrade: ${progress.price(key)} gold.` : t`${benefit} Next upgrade: ${progress.price(key)} gold.`
      action = t`Train ${upgrades[key].label}`
    } else if (!key && fourthCampKills > 0) {
      title = t("Challenge the Root Guardian")
      this.destination = { kind: 'boss', ...zonePoint(zones[0], 0, zones[0].arena) }
      text = t("Go to the arena. Dodge roots and star rays.")
    } else {
      const valley = camps.filter(camp => camp.zone === 'valley')
      const best = [...valley].reverse().find(camp => campStats(camp).health <= progress.stat('damage') * 4) ?? valley[0]
      const index = valley.indexOf(best)
      this.destination = { kind: 'camp', x: best.x, z: best.z, camp: best.id }
      title = progress.rank('damage') === 0 ? t("Collect 3 coins") : t`Try camp ${index + 1}`
      text = progress.rank('damage') === 0
        ? t("Move with WASD, arrows or joystick. Attacks are automatic.")
        : t`Follow the arrows to enemies. ${key ? t`Save ${progress.price(key)} gold for ${upgrades[key].label}.` : t("Practice here, then head to the boss arena.")}`
    }
    if (this.title.textContent !== title) this.title.textContent = title
    if (this.text.textContent !== text) this.text.textContent = text
    if (this.action.textContent !== action) this.action.textContent = action
  }
}
