import { t, localize, getLanguage } from '../i18n'
import { Camera, Vector3 } from 'three'
import { progressionBalance, type Upgrade, type Talent } from '../config/balance'
import type { BossId } from '../config/bosses'
import { runes, type RuneId, type RuneSlots } from '../config/runes'
import type { LootKind } from '../systems/LootSystem'
import type { Progression } from '../systems/Progression'
import { SettingsMenu } from './SettingsMenu'
import type { Settings } from '../systems/Settings'
import { UpgradesMenu } from './UpgradesMenu'
import { runeIcons, RuneMenu } from './RuneMenu'
import { RuneReward } from './RuneReward'
import { GoldTransfer } from './GoldTransfer'

import { coinIcon, emptyRuneIcon, upgradeIcon, settingsIcon, pauseIcon } from './CartoonIcons'
const compactNumbers = {
  en: new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }),
  ru: new Intl.NumberFormat('ru', { notation: 'compact', maximumFractionDigits: 1 }),
}

export type OverlayMode = 'active' | 'paused' | 'dead' | 'upgrades' | 'runes' | 'victory' | 'settings'

interface DamageLabel {
  element: HTMLSpanElement
  point: Vector3
  life: number
}

export class HUD {
  private settingsMenu: SettingsMenu
  private pauseSettings: HTMLButtonElement
  private cargoBar: HTMLProgressElement
  private cargoLabel: HTMLElement
  private cargoHint: HTMLElement
  private cargo: HTMLElement
  private goldTransfer: GoldTransfer
  private enemyBar: HTMLProgressElement
  private enemyValue: HTMLElement
  private enemyPlate: HTMLElement
  private enemyName: HTMLElement
  private warning: HTMLElement
  private slots: HTMLElement[]
  private xpBar: HTMLProgressElement
  private xpValue: HTMLElement
  private level: HTMLElement
  private gold: HTMLElement
  private bankGold = 0
  private pendingGold = 0
  private saveStatus: HTMLElement
  private overlay: HTMLElement
  private title: HTMLElement
  private message: HTMLElement
  private overlayAction: HTMLButtonElement
  private upgradesButton: HTMLButtonElement
  private talentBadge: HTMLElement
  private levelNotice = document.createElement('aside')
  private noticeUntil = 0
  private pauseButton: HTMLButtonElement
  private upgradesMenu: UpgradesMenu
  private runeMenu: RuneMenu
  private runeReward: RuneReward
  private runesButtons: HTMLButtonElement[]
  private lastRuneButton = 0
  private background: HTMLElement[]
  private labels: DamageLabel[]
  private labelIndex = 0
  private projected = new Vector3()

  constructor(private readonly root: HTMLElement, actions: {
    settings: Settings
    toggleSettings: () => void
    changeSettings: () => boolean
    resetProgress: () => boolean
    pause: () => void
    respawn: () => void
    toggleUpgrades: () => void
    toggleRunes: () => void
    equip: (slot: 0 | 1, id: RuneId | null) => void
    equipReward: (slot: 0 | 1, id: RuneId) => void
    buy: (key: Upgrade) => void
    chooseTalent: (key: Talent) => void
  }) {
    const ui = document.createElement('div')
    ui.className = 'hud'
    ui.innerHTML = `
      <header class="top">
        <div class="status-cluster">
          <div class="progression">
            <div class="level-medal"><span>LVL</span><strong class="level"></strong></div>
            <div class="xp-track"><progress aria-label="Level experience"></progress><strong class="xp-value"></strong></div>
          </div>
          <div class="resources">
            <div class="wallet" aria-label="Banked gold" title="Banked gold · Spend on upgrades">${coinIcon}<strong></strong></div>
          </div>
        </div>
        <div class="top-actions">
          <button class="open-settings icon-button" type="button" aria-label="Settings" title="Settings">${settingsIcon}</button>
          <button class="pause icon-button" type="button" aria-label="Pause" title="Pause (Esc)">${pauseIcon}</button>
        </div>
      </header>
      <div class="encounter">
        <div class="enemy plate" hidden>
          <div class="meter-header"><span class="enemy-name"></span><strong class="enemy-value"></strong></div>
          <progress aria-label="Enemy health"></progress>
        </div>
        <p class="boss-warning" role="status" hidden></p>
      </div>
      <footer class="bottom">
        <span class="save-status" role="status" hidden>Saving unavailable</span>
        <div class="bottom-actions" role="group" aria-label="Runes and upgrades">
          <button class="open-runes action-tile" type="button" aria-label="Rune slot 1, empty" title="Rune slot 1"><span class="rune-slot">${emptyRuneIcon}</span><span class="slot-number" aria-hidden="true">1</span></button>
          <button class="open-runes action-tile" type="button" aria-label="Rune slot 2, empty" title="Rune slot 2"><span class="rune-slot">${emptyRuneIcon}</span><span class="slot-number" aria-hidden="true">2</span></button>
          <button class="open-upgrades action-tile" type="button" aria-label="Upgrades" title="Upgrades">${upgradeIcon}<span class="talent-badge" hidden></span></button>
        </div>
      </footer>
      <div class="feedback" aria-hidden="true"></div>
      <div class="cargo" title="Carried coins · Deposit at your camp" hidden><strong class="cargo-value"></strong><progress aria-label="Coins carried"></progress><span class="cargo-hint" hidden></span></div>
      <section class="overlay" role="dialog" aria-modal="true" aria-labelledby="overlay-title" hidden>
        <div class="panel">
          <h2 id="overlay-title"></h2><p></p><button type="button"></button><button class="pause-settings" type="button">Settings</button>
        </div>
      </section>`
    localize(ui)
    root.append(ui)

    this.cargoBar = ui.querySelector('.cargo progress')!
    this.cargo = ui.querySelector('.cargo')!
    this.cargoLabel = ui.querySelector('.cargo-value')!
    this.cargoHint = ui.querySelector('.cargo-hint')!
    this.enemyBar = ui.querySelector<HTMLProgressElement>('.enemy progress')!
    this.enemyValue = ui.querySelector('.enemy-value')!
    this.enemyPlate = ui.querySelector('.enemy')!
    this.enemyName = ui.querySelector('.enemy-name')!
    this.warning = ui.querySelector('.boss-warning')!
    this.slots = Array.from(ui.querySelectorAll('.rune-slot'))
    this.xpBar = ui.querySelector('.progression progress')!
    this.xpValue = ui.querySelector('.xp-value')!
    this.level = ui.querySelector('.level')!
    this.gold = ui.querySelector('.wallet strong')!
    this.goldTransfer = new GoldTransfer(ui, this.gold.parentElement!)
    this.saveStatus = ui.querySelector('.save-status')!
    this.overlay = ui.querySelector('.overlay')!
    this.title = ui.querySelector('#overlay-title')!
    this.message = this.overlay.querySelector('p')!
    this.overlayAction = this.overlay.querySelector('button')!
    this.background = Array.from(ui.querySelectorAll('.top, .encounter, .bottom, .cargo'))
    this.upgradesButton = ui.querySelector('.open-upgrades')!
    this.talentBadge = ui.querySelector('.talent-badge')!
    this.pauseButton = ui.querySelector('.pause')!
    this.runesButtons = Array.from(ui.querySelectorAll<HTMLButtonElement>('.open-runes'))
    this.upgradesButton.addEventListener('click', actions.toggleUpgrades)
    this.pauseButton.addEventListener('click', actions.pause)
    this.runesButtons.forEach((button, index) => button.addEventListener('click', () => {
      this.lastRuneButton = index
      actions.toggleRunes()
    }))
    this.overlayAction.addEventListener('click', () => {
      if (this.overlay.dataset.mode === 'paused') actions.pause()
      else actions.respawn()
    })
    this.pauseSettings = ui.querySelector('.pause-settings')!
    this.pauseSettings.addEventListener('click', actions.toggleSettings)
    ui.querySelector('.open-settings')!.addEventListener('click', actions.toggleSettings)
    this.settingsMenu = new SettingsMenu(ui, actions.settings, { close: actions.toggleSettings, change: actions.changeSettings, reset: actions.resetProgress })
    this.upgradesMenu = new UpgradesMenu(ui, actions.toggleUpgrades, actions.buy, actions.chooseTalent)
    this.runeMenu = new RuneMenu(ui, actions.toggleRunes, actions.equip)
    this.runeReward = new RuneReward(ui, actions.equipReward)
    this.levelNotice.className = 'level-notice'
    this.levelNotice.hidden = true
    this.levelNotice.setAttribute('role', 'status')
    this.levelNotice.setAttribute('aria-live', 'polite')
    ui.append(this.levelNotice)

    const feedback = ui.querySelector('.feedback')!
    this.labels = Array.from({ length: 10 }, () => {
      const element = document.createElement('span')
      element.hidden = true
      feedback.append(element)
      return { element, point: new Vector3(), life: 0 }
    })
  }

  update(enemy: { name: string; health: number; max: number; engaged: boolean; enraged?: boolean; warning?: string }) {
    this.updateMeter(this.enemyBar, this.enemyValue, enemy.health, enemy.max)
    this.enemyPlate.hidden = !enemy.engaged || enemy.health === 0
    if (this.enemyName.textContent !== t(enemy.name)) {
      this.enemyName.textContent = t(enemy.name)
      this.enemyBar.setAttribute('aria-label', t`${enemy.name} health`)
    }
    const warning = enemy.warning ?? (enemy.enraged ? t("Enraged") : '')
    if (this.warning.textContent !== t(warning)) this.warning.textContent = t(warning)
    this.warning.hidden = !warning
  }

  updateRunes(defeated: ReadonlySet<BossId>, slots: RuneSlots) {
    this.runeMenu.update(defeated, slots)
    this.runeReward.updateSlots(slots)
    slots.forEach((id, index) => {
      this.slots[index].dataset.rune = id ?? 'empty'
      this.slots[index].innerHTML = id ? runeIcons[id] : emptyRuneIcon
      const button = this.runesButtons[index]
      button.dataset.rune = id ?? 'empty'
      button.classList.toggle('attuned', !!id)
      button.setAttribute('aria-label', t`Rune slot ${index + 1}: ${id ? runes[id].name : t("empty")}`)
      button.title = id ? t(runes[id].name) : t`Empty rune slot ${index + 1}`
      this.slots[index].style.color = id ? runes[id].color : ''
      this.slots[index].title = id ? t(runes[id].name) : t`Empty slot ${index + 1}`
    })
  }

  updateProgress(progress: Progression) {
    this.talentBadge.hidden = progress.talentPoints === 0
    this.talentBadge.textContent = String(progress.talentPoints)
    const upgradeLabel = progress.talentPoints ? t`Upgrades · Talents available: ${progress.talentPoints}` : t('Upgrades')
    this.upgradesButton.title = upgradeLabel
    this.upgradesButton.setAttribute('aria-label', upgradeLabel)
    this.level.textContent = String(progress.level)
    this.bankGold = progress.gold
    this.renderGold()
    this.gold.parentElement!.setAttribute('aria-label', t`${progress.gold} banked gold`)
    this.gold.parentElement!.title = t`${progress.gold} banked gold · Spend on upgrades`
    this.updateMeter(this.xpBar, this.xpValue, progress.xp, progress.nextLevel, t(" XP"))
    this.upgradesMenu.update(progress)
    this.updateMeter(this.cargoBar, this.cargoLabel, progress.cargo, progress.stat('capacity'))
    this.cargo.classList.toggle('full', progress.cargo >= progress.stat('capacity'))
    this.cargo.setAttribute('aria-label', t`Carried coins: ${progress.cargo} / ${progress.stat('capacity')}`)
    this.cargoHint.textContent = progress.cargo >= progress.stat('capacity') ? t("Cargo full · Return to your camp") : progress.baseUnlocked ? t("Deposit at your camp to spend coins") : t("Collect your first coin to unlock camp")

  }

  setSaveAvailable(available: boolean) {
    this.saveStatus.hidden = available
  }

  private updateMeter(bar: HTMLProgressElement, label: HTMLElement, value: number, max: number, suffix = '') {
    bar.max = max
    bar.value = value
    label.textContent = t`${Math.ceil(value)} / ${max}${suffix}`
  }

  showOverlay(mode: OverlayMode, victory?: BossId) {
    if (mode !== 'active') {
      this.cargo.hidden = true
      this.goldTransfer.clear()
      this.pendingGold = 0
      this.renderGold()
    }
    const previous = this.overlay.dataset.mode
    this.overlay.parentElement!.classList.toggle('showing-rune-reward', mode === 'victory')
    for (const element of this.background) element.inert = mode !== 'active'
    this.overlay.hidden = mode !== 'paused' && mode !== 'dead'
    this.overlay.dataset.mode = mode
    this.pauseSettings.hidden = mode !== 'paused'
    this.settingsMenu.show(mode === 'settings')
    this.upgradesMenu.setVisible(mode === 'upgrades')
    this.runeMenu.show(mode === 'runes')
    this.runeReward.show(mode === 'victory' ? victory : undefined)
    if (mode === 'active') {
      if (previous === 'settings') this.root.querySelector<HTMLButtonElement>('.open-settings')?.focus()
      if (previous === 'upgrades') this.upgradesButton.focus()
      if (previous === 'paused') this.pauseButton.focus()
      if (previous === 'runes' || previous === 'victory') this.runesButtons[this.lastRuneButton].focus()
      return
    }
    if (mode !== 'paused' && mode !== 'dead') return
    const paused = mode === 'paused'
    this.title.textContent = paused ? t("Hunt paused") : t("Hunter fallen")
    this.message.textContent = paused ? t("The valley will wait.") : t("Return to the checkpoint and try again.")
    this.overlayAction.textContent = paused ? t("Resume hunt") : t("Respawn")
    this.overlayAction.focus()
  }

  damage(point: Vector3, amount: number, isHero: boolean) {
    this.floatText(point, String(amount), isHero ? 'damage taken' : 'damage', 0.7)
  }

  criticalDamage(point: Vector3, amount: number) {
    this.floatText(point, t`${amount} CRIT`, 'damage critical', 0.85)
  }

  runeDamage(point: Vector3, amount: number, element: RuneId) {
    this.floatText(point, String(amount), `damage ${element}-damage`, 0.9, 0.58)
  }

  reward(point: Vector3, amount: number, kind: LootKind) {
    this.floatText(point, kind === 'xp' ? t`+${amount} XP` : t`+${amount} Gold`, `damage reward-${kind}`, 1.2, kind === 'xp' ? 0 : 0.55)
  }

  renderPlayer(camera: Camera, point: Vector3, visible: boolean) {
    this.projected.copy(point).setY(point.y + .05).project(camera)
    this.cargo.hidden = !visible || this.projected.z < -1 || this.projected.z > 1
    if (this.cargo.hidden) return
    const x = Math.max(76, Math.min(this.root.clientWidth - 76, (this.projected.x + 1) * this.root.clientWidth / 2))
    const y = Math.max(0, Math.min(this.root.clientHeight - 42, (1 - this.projected.y) * this.root.clientHeight / 2 + 18))
    this.cargo.style.transform = `translate(${x}px,${y}px) translate(-50%,0)`
  }

  deposit(point: Vector3, camera: Camera, amount: number) {
    camera.updateMatrixWorld()
    this.projected.copy(point).setY(point.y + .5).project(camera)
    this.pendingGold += amount
    this.goldTransfer.play((this.projected.x + 1) * this.root.clientWidth / 2, (1 - this.projected.y) * this.root.clientHeight / 2, amount, arrived => {
      this.pendingGold = Math.max(0, this.pendingGold - arrived)
      this.renderGold()
    })
  }

  private renderGold() {
    this.gold.textContent = compactNumbers[getLanguage()].format(Math.max(0, this.bankGold - this.pendingGold))
  }

  levelUp(progress: Progression, previous: { level: number; health: number; damage: number }) {
    const health = progress.stat('health') - previous.health
    const damage = progress.stat('damage')
    const percent = Math.round((progress.level - previous.level) * progressionBalance.damagePerLevel * 100)
    const benefit = damage === previous.damage ? t`+${percent}% damage` : t`Damage ${previous.damage} → ${damage}`
    this.levelNotice.innerHTML = `<strong>${t`Level ${progress.level}!`}</strong><span>${t`+${health} HP`} · ${benefit}</span><small>${progress.talentPoints ? t('Talent available in Upgrades') : t('Health restored')}</small>`
    this.levelNotice.hidden = false
    this.noticeUntil = performance.now() + 4500
  }

  private floatText(point: Vector3, text: string, classes: string, life: number, lift = 0) {
    const label = this.labels[this.labelIndex]
    this.labelIndex = (this.labelIndex + 1) % this.labels.length
    label.point.copy(point)
    label.point.y = 1.65 + lift
    label.life = life
    label.element.textContent = text
    label.element.className = classes
    label.element.hidden = false
  }

  clearDamage() {
    for (const label of this.labels) {
      label.life = 0
      label.element.hidden = true
    }
  }

  renderDamage(camera: Camera, dt: number) {
    if (!this.levelNotice.hidden && performance.now() >= this.noticeUntil) this.levelNotice.hidden = true
    for (const label of this.labels) {
      if (label.life <= 0) continue
      label.life -= dt
      label.element.hidden = label.life <= 0
      if (label.life <= 0) continue
      label.point.y += dt * 1.05
      this.projected.copy(label.point).project(camera)
      const x = (this.projected.x + 1) * this.root.clientWidth / 2
      const y = (1 - this.projected.y) * this.root.clientHeight / 2
      label.element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
      label.element.style.opacity = String(Math.min(1, label.life * 3.5))
    }
  }
}
