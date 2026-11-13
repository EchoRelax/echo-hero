import { Vector3 } from 'three'

const keys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'])

export class Keyboard {
  private held = new Set<string>()
  private enabled = true

  constructor(togglePause: () => void) {
    window.addEventListener('keydown', event => {
      if (event.code === 'Escape' && !event.repeat) togglePause()
      if (!this.enabled || !keys.has(event.code)) return
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]')) return
      event.preventDefault()
      this.held.add(event.code)
    })
    window.addEventListener('keyup', event => this.held.delete(event.code))
    window.addEventListener('blur', () => this.clear())
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    this.clear()
  }

  clear() {
    this.held.clear()
  }

  read(direction: Vector3) {
    const left = this.held.has('KeyA') || this.held.has('ArrowLeft')
    const right = this.held.has('KeyD') || this.held.has('ArrowRight')
    const up = this.held.has('KeyW') || this.held.has('ArrowUp')
    const down = this.held.has('KeyS') || this.held.has('ArrowDown')
    return direction.set(Number(right) - Number(left), 0, Number(down) - Number(up)).normalize()
  }
}
