import { t, onLanguageChange } from '../i18n'
import type { FirstBossRun } from '../systems/FirstBossRun'
import { timerIcon } from './CartoonIcons'

export function formatRunTime(seconds: number) {
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor(total / 60) % 60
  const secs = String(total % 60).padStart(2, '0')
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}` : `${String(minutes).padStart(2, '0')}:${secs}`
}

export class FirstBossTimer {
  private root = document.createElement('aside')
  private label: HTMLElement
  private value: HTMLTimeElement

  constructor(parent: HTMLElement, private run: FirstBossRun) {
    this.root.className = 'first-boss-timer'
    this.root.setAttribute('role', 'timer')
    this.root.setAttribute('aria-live', 'off')
    this.root.innerHTML = `${timerIcon}<div><span></span><time></time></div>`
    this.label = this.root.querySelector('span')!
    this.value = this.root.querySelector('time')!
    parent.append(this.root)
    onLanguageChange(() => this.update())
    this.update()
  }

  update() {
    this.root.hidden = this.run.seconds === undefined
    if (this.run.seconds === undefined) return
    const label = this.run.completed ? t('First boss defeated') : t('Time to first boss')
    const value = formatRunTime(this.run.seconds)
    if (this.label.textContent !== label) this.label.textContent = label
    if (this.value.textContent !== value) {
      this.value.textContent = value
      this.value.dateTime = `PT${Math.floor(this.run.seconds)}S`
    }
    this.root.classList.toggle('completed', this.run.completed)
    const title = t('Active playtime. Paused in menus.')
    if (this.root.title !== title) this.root.title = title
  }
}
