import { gsap } from 'gsap'
import { t, onLanguageChange } from '../i18n'
import { bosses, type BossId } from '../config/bosses'
import { runeIds, runes, type RuneId, type RuneSlots } from '../config/runes'
import { cartoonRuneIcons, emptyRuneIcon } from './CartoonIcons'
import './rune-reward.css'

/** A boss reward reveal, separate from the equipment management screen. */
export class RuneReward {
  private overlay = document.createElement('section')
  private motion?: gsap.MatchMedia
  private rune?: RuneId
  private slots: RuneSlots = [null, null]
  private selected: 0 | 1 = 0
  private title: HTMLElement
  private description: HTMLElement
  private source: HTMLElement
  private sigil: HTMLElement
  private choice: HTMLElement
  private buttons: HTMLButtonElement[]
  private action: HTMLButtonElement

  constructor(parent: HTMLElement, equip: (slot: 0 | 1, id: RuneId) => void) {
    this.overlay.className = 'rune-reward'
    this.overlay.hidden = true
    this.overlay.setAttribute('role', 'dialog')
    this.overlay.setAttribute('aria-modal', 'true')
    this.overlay.setAttribute('aria-labelledby', 'reward-rune-title')
    this.overlay.setAttribute('aria-describedby', 'reward-rune-description')
    this.overlay.innerHTML = `
      <div class="rune-reward-backdrop" aria-hidden="true"></div>
      <div class="rune-reward-content">
        <p class="rune-reward-eyebrow"></p>
        <div class="rune-reward-art" aria-hidden="true">
          <div class="rune-reward-halo"></div>
          <div class="rune-reward-orbits">
            <div class="rune-reward-orbit rune-reward-orbit-outer"></div>
            <div class="rune-reward-orbit rune-reward-orbit-inner"></div>
          </div>
          <div class="rune-reward-sigil"></div>
          <i class="rune-reward-spark spark-one"></i><i class="rune-reward-spark spark-two"></i>
          <i class="rune-reward-spark spark-three"></i><i class="rune-reward-spark spark-four"></i>
        </div>
        <h2 id="reward-rune-title" tabindex="-1"></h2>
        <p class="rune-reward-source"></p>
        <p id="reward-rune-description"></p>
        <div class="rune-reward-choice" role="group">
          <p class="rune-reward-hint"></p>
          <div class="rune-reward-slots"><button type="button"></button><button type="button"></button></div>
        </div>
        <button class="rune-reward-equip" type="button"></button>
      </div>`
    parent.append(this.overlay)
    this.title = this.overlay.querySelector('h2')!
    this.description = this.overlay.querySelector('#reward-rune-description')!
    this.source = this.overlay.querySelector('.rune-reward-source')!
    this.sigil = this.overlay.querySelector('.rune-reward-sigil')!
    this.choice = this.overlay.querySelector('.rune-reward-choice')!
    this.buttons = Array.from(this.overlay.querySelectorAll('.rune-reward-slots button'))
    this.action = this.overlay.querySelector('.rune-reward-equip')!
    this.buttons.forEach((button, slot) => button.addEventListener('click', () => {
      this.selected = slot as 0 | 1
      this.render()
    }))
    this.action.addEventListener('click', () => {
      if (this.rune && !this.overlay.hidden) equip(this.selected, this.rune)
    })
    this.overlay.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return
      const controls = [...(this.choice.hidden ? [] : this.buttons), this.action]
      const index = controls.indexOf(document.activeElement as HTMLButtonElement)
      event.preventDefault()
      const next = index < 0 ? (event.shiftKey ? controls.length - 1 : 0)
        : (index + (event.shiftKey ? controls.length - 1 : 1)) % controls.length
      controls[next].focus()
    })
    onLanguageChange(() => this.render())
  }

  updateSlots(slots: RuneSlots) { this.slots = [...slots] }

  show(boss?: BossId) {
    const id = runeIds.find(id => runes[id].unlock === boss)
    this.motion?.revert()
    this.motion = undefined
    this.overlay.hidden = !id
    this.rune = id
    if (!id) return
    const equipped = this.slots.indexOf(id)
    const empty = this.slots.indexOf(null)
    this.selected = (equipped >= 0 ? equipped : empty >= 0 ? empty : 0) as 0 | 1
    this.overlay.dataset.rune = id
    this.overlay.style.setProperty('--reward-color', runes[id].color)
    this.sigil.innerHTML = cartoonRuneIcons[id]
    this.render()
    this.title.focus({ preventScroll: true })
    this.overlay.scrollTop = 0
    this.playReveal()
  }

  private playReveal() {
    this.motion = gsap.matchMedia(this.overlay)
    this.motion.add({ always: 'all', reduced: '(prefers-reduced-motion: reduce)' }, ({ conditions }) => {
      const reduced = conditions?.reduced
      const copy = [this.title, this.source, this.description]
      if (!this.choice.hidden) copy.push(this.choice)
      copy.push(this.action)

      const reveal = gsap.timeline({ defaults: { ease: 'power2.out' } })
        .from('.rune-reward-backdrop', { opacity: 0, duration: 1.25, ease: 'sine.inOut' }, 0)
        .from('.rune-reward-halo', { opacity: 0, duration: .95 }, .22)
        .from(this.sigil, { opacity: 0, duration: .55 }, .32)
        .from('.rune-reward-orbits', { opacity: 0, duration: .85 }, .48)
        .from('.rune-reward-eyebrow', { opacity: 0, duration: .48 }, .64)
        .from(copy, { opacity: 0, duration: .52, stagger: .12, ...(reduced ? {} : { y: 14 }) }, .82)

      if (reduced) return

      reveal
        .from(this.sigil, { y: 30, scale: .45, rotation: -24, duration: 1.02, ease: 'back.out(1.2)' }, .32)
        .from('.rune-reward-orbits', { scale: .66, duration: .92, ease: 'power3.out' }, .48)

      gsap.to('.rune-reward-orbit-outer', { rotation: 360, duration: 7, ease: 'none', repeat: -1, delay: .48 })
      gsap.to('.rune-reward-orbit-inner', { rotation: -360, duration: 11, ease: 'none', repeat: -1, delay: .48 })
      gsap.to(this.sigil, { y: -7, rotation: 2, duration: 2, ease: 'sine.inOut', repeat: -1, yoyo: true, delay: 1.34 })
      gsap.fromTo('.rune-reward-spark', { opacity: 0, scale: .5, y: 5 }, {
        opacity: .9, scale: 1, y: -8, duration: 1.3, ease: 'sine.inOut', repeat: -1, yoyo: true,
        delay: .35, stagger: .18,
      })
    })
  }

  private render() {
    if (!this.rune) return
    const rune = runes[this.rune]
    this.overlay.querySelector('.rune-reward-eyebrow')!.textContent = t('New rune acquired')
    this.title.textContent = t(rune.name)
    this.source.textContent = t`Reward for defeating ${bosses[rune.unlock].name}`
    this.description.textContent = t(rune.description)
    this.action.textContent = t('Equip')
    this.choice.hidden = this.slots.includes(null) || this.slots.includes(this.rune)
    this.choice.setAttribute('aria-label', t('Choose a rune to replace'))
    this.overlay.querySelector('.rune-reward-hint')!.textContent = t('Both slots are occupied. Choose a rune to replace:')
    this.buttons.forEach((button, slot) => {
      const id = this.slots[slot]
      button.innerHTML = `<span aria-hidden="true">${id ? cartoonRuneIcons[id] : emptyRuneIcon}</span><span>${t`Slot ${slot + 1}`}<strong>${id ? t(runes[id].name) : t('empty')}</strong></span>`
      button.style.setProperty('--slot-color', id ? runes[id].color : '#fff')
      button.setAttribute('aria-pressed', String(slot === this.selected))
      button.setAttribute('aria-label', t`Replace ${id ? runes[id].name : 'empty'} in slot ${slot + 1}`)
    })
  }
}
