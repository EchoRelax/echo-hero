import { t } from '../i18n'
import * as T from 'three'
import type { Health } from '../game/combat'
import type { Enemy } from '../entities/Enemy'
import { coinIcon } from '../ui/CartoonIcons'

interface Actor { position: T.Vector3; health: Health }
interface EnemyWidget { root: HTMLElement; gold: HTMLElement; bar: HTMLProgressElement }
const capacity = 24

export class WorldVitals {
  private frame: T.Mesh
  private fill: T.Mesh
  private right = new T.Vector3()
  private forward = new T.Vector3()
  private projected = new T.Vector3()
  private revealed = new Map<Enemy, number>()
  private time = 0
  private widgets: EnemyWidget[]

  constructor(scene: T.Scene, private root: HTMLElement) {
    const geometry = new T.PlaneGeometry(1, 1)
    this.frame = new T.Mesh(geometry, new T.MeshBasicMaterial({ color: '#303944', toneMapped: false }))
    this.fill = new T.Mesh(geometry, new T.MeshBasicMaterial({ color: '#9ff16d', toneMapped: false }))
    scene.add(this.frame, this.fill)
    const layer = document.createElement('div')
    layer.className = 'world-vitals'
    layer.setAttribute('aria-hidden', 'true')
    this.widgets = Array.from({ length: capacity }, () => {
      const root = document.createElement('div')
      root.className = 'mob-vitals'
      root.hidden = true
      root.innerHTML = `<progress></progress><span class="mob-gold">${coinIcon}<b></b></span>`
      layer.append(root)
      return { root, gold: root.querySelector<HTMLElement>('b')!, bar: root.querySelector<HTMLProgressElement>('progress')! }
    })
    root.append(layer)
  }

  reveal(enemy: Enemy) {
    this.revealed.set(enemy, this.time + (enemy.health.alive ? 5 : 0.65))
  }

  clear() { this.revealed.clear() }

  update(camera: T.Camera, player: Actor, enemies: readonly Enemy[], dt: number) {
    this.time += dt
    this.right.set(1, 0, 0).applyQuaternion(camera.quaternion)
    this.forward.set(0, 0, 1).applyQuaternion(camera.quaternion)
    const fraction = player.health.current / player.health.max
    this.frame.visible = this.fill.visible = player.health.alive
    this.frame.quaternion.copy(camera.quaternion)
    this.fill.quaternion.copy(camera.quaternion)
    this.frame.position.copy(player.position).setY(2.16)
    this.frame.scale.set(0.84, 0.125, 1)
    this.fill.position.copy(this.frame.position).addScaledVector(this.right, -0.78 * (1 - fraction) * 0.5).addScaledVector(this.forward, 0.012)
    this.fill.scale.set(0.78 * fraction, 0.073, 1)
    for (const [enemy, until] of this.revealed) if (until <= this.time) this.revealed.delete(enemy)
    let slot = 0
    for (const enemy of enemies) {
      if (!this.revealed.has(enemy) || enemy.position.distanceToSquared(player.position) > 12 ** 2) continue
      this.projected.copy(enemy.position)
      this.projected.y += 1.65
      this.projected.project(camera)
      if (this.projected.z < -1 || this.projected.z > 1 || Math.abs(this.projected.x) > 1.1 || Math.abs(this.projected.y) > 1.1) continue
      if (slot === capacity) break
      const widget = this.widgets[slot++]
      const health = t`${Math.ceil(enemy.health.current)} / ${enemy.health.max} HP`
      if (widget.bar.getAttribute('aria-valuetext') !== health) widget.bar.setAttribute('aria-valuetext', health)
      const coins = String(enemy.config.gold)
      if (widget.gold.textContent !== coins) widget.gold.textContent = coins
      widget.bar.max = enemy.health.max
      widget.bar.value = enemy.health.current
      widget.root.classList.toggle('low-health', enemy.health.current / enemy.health.max < 0.3)
      widget.root.hidden = false
      const x = (this.projected.x + 1) * this.root.clientWidth / 2
      const y = (1 - this.projected.y) * this.root.clientHeight / 2
      widget.root.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`
    }
    for (; slot < capacity; slot++) this.widgets[slot].root.hidden = true
  }
}
