import { Vector3 } from 'three'
import { Keyboard } from './Keyboard'
import { TouchStick } from './TouchStick'

export class InputManager {
  private keyboard: Keyboard
  private touch: TouchStick
  private active = true

  constructor(root: HTMLElement, togglePause: () => void) {
    this.keyboard = new Keyboard(togglePause)
    this.touch = new TouchStick(root)
  }

  setActive(active: boolean) {
    this.active = active
    this.keyboard.setEnabled(active)
    this.touch.setEnabled(active)
  }

  read(direction: Vector3) {
    if (!this.active) return direction.set(0, 0, 0)
    this.keyboard.read(direction)
    if (direction.lengthSq() > 0) return direction
    return this.touch.read(direction)
  }
}
