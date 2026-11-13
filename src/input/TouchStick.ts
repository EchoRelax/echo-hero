import { localize } from '../i18n'
import { Vector3 } from 'three'

/** One captured pointer owns the stick; other fingers remain available for HUD buttons. */
export class TouchStick {
  readonly element = document.createElement('div')
  private pad = document.createElement('div')
  private thumb = document.createElement('span')
  private pointer?: number
  private centerX = 0
  private centerY = 0
  private radius = 1
  private x = 0
  private z = 0
  private enabled = true

  constructor(root: HTMLElement) {
    this.element.className = 'touch-controls'
    this.pad.className = 'touch-stick'
    this.pad.setAttribute('role', 'group')
    this.pad.setAttribute('aria-label', 'Movement joystick. Drag to move. Attacks are automatic.')
    this.thumb.className = 'touch-thumb'
    this.thumb.setAttribute('aria-hidden', 'true')
    const hint = document.createElement('span')
    hint.className = 'touch-hint'
    hint.textContent = 'Drag to move · Auto-attack'
    this.pad.append(this.thumb)
    this.element.append(this.pad, hint)
    root.append(this.element)
    localize(this.element)

    this.pad.addEventListener('pointerdown', event => {
      if (!this.enabled || this.pointer !== undefined || event.button !== 0) return
      event.preventDefault()
      const bounds = this.pad.getBoundingClientRect()
      this.centerX = bounds.left + bounds.width / 2
      this.centerY = bounds.top + bounds.height / 2
      this.radius = bounds.width * 0.34
      this.pointer = event.pointerId
      this.pad.setPointerCapture(event.pointerId)
      this.pad.classList.add('engaged')
      this.move(event)
    })
    this.pad.addEventListener('pointermove', event => {
      if (event.pointerId !== this.pointer) return
      event.preventDefault()
      this.move(event)
    })
    const release = (event: PointerEvent) => {
      if (event.pointerId === this.pointer) this.clear()
    }
    this.pad.addEventListener('pointerup', release)
    this.pad.addEventListener('pointercancel', release)
    this.pad.addEventListener('lostpointercapture', release)
    this.pad.addEventListener('contextmenu', event => event.preventDefault())
    window.addEventListener('blur', () => this.clear())
    window.addEventListener('resize', () => this.clear())
  }

  private move(event: PointerEvent) {
    const dx = event.clientX - this.centerX, dz = event.clientY - this.centerY
    const distance = Math.hypot(dx, dz)
    const reach = Math.min(distance, this.radius)
    const nx = distance > 0 ? dx / distance : 0
    const nz = distance > 0 ? dz / distance : 0
    // Small finger tremors do not move the hero; full deflection matches keyboard speed.
    const strength = Math.max(0, (reach / this.radius - 0.15) / 0.85)
    this.x = nx * strength
    this.z = nz * strength
    this.thumb.style.transform = `translate(${nx * reach}px, ${nz * reach}px)`
  }

  read(direction: Vector3) {
    return direction.set(this.x, 0, this.z)
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    this.element.hidden = !enabled
    this.clear()
  }

  clear() {
    const pointer = this.pointer
    this.pointer = undefined
    if (pointer !== undefined && this.pad.hasPointerCapture(pointer)) this.pad.releasePointerCapture(pointer)
    this.x = this.z = 0
    this.thumb.style.transform = ''
    this.pad.classList.remove('engaged')
  }
}
