import { Scene, Vector3 } from 'three'
import type { BossDefinition, BossId } from '../config/bosses'
import { GroundWarning } from '../effects/GroundWarning'
import { Health } from '../game/combat'
import type { BossModel } from './RootGuardianModel'

export class BossController {
  readonly health: Health
  active = false
  targetable = true
  private warnings: GroundWarning[][]
  private current?: GroundWarning[]
  private center = new Vector3()
  private anchor = new Vector3()
  private next = 0
  private timer = 0.7
  private windup = 0
  private impact = 0
  private flash = 0
  private basicWindup = 0
  private basicCooldown = 0
  private basicImpact = 0

  constructor(readonly id: BossId, readonly config: BossDefinition, private model: BossModel, position: Vector3, scene: Scene) {
    this.health = new Health(config.health)
    model.root.position.copy(position)
    this.anchor.copy(position)
    this.warnings = config.attacks.map(attack => Array.from({ length: attack.rays ?? (attack.kind === 'storm' ? 3 : 1) }, () => new GroundWarning(attack)))
    scene.add(model.root, ...this.warnings.flat().flatMap(warning => [warning.root, warning.rootEffects]))
  }

  get position() { return this.model.root.position }
  get warningName() { return this.current?.[0].attack.name ?? (this.basicWindup > 0 ? 'Quick Strike' : undefined) }
  get enraged() { return this.health.current <= this.health.max * this.config.enrageAt }

  damage(amount: number) {
    if (!this.targetable) return 0
    this.flash = 0.17
    return this.health.damage(amount)
  }

  reset() {
    this.model.root.visible = true
    this.active = false
    this.position.copy(this.anchor)
    this.health.restore()
    this.next = 0
    this.timer = 0.7
    this.windup = this.impact = this.flash = 0
    this.basicWindup = this.basicCooldown = this.basicImpact = 0
    this.clearWarning()
    this.model.root.rotation.y = 0
    this.model.animate(0, 0, 0, false, false)
  }

  remove() {
    this.model.root.visible = false
    this.active = false
    this.clearWarning()
  }

  update(player: Vector3, dt: number, time: number) {
    for (const warning of this.warnings.flat()) warning.update(dt)
    if (!this.health.alive || !this.targetable) return 0
    const distance = this.position.distanceTo(player)
    if (this.active && distance > this.config.resetRadius) this.reset()
    if (!this.active && distance <= this.config.engageRadius) this.active = true
    this.flash = Math.max(0, this.flash - dt)
    this.basicCooldown = Math.max(0, this.basicCooldown - dt)
    this.basicImpact = Math.max(0, this.basicImpact - dt * 7)

    let damage = 0
    let charge = 0
    let moving = false
    if (this.active) {
      const { basic } = this.config
      const inMelee = distance <= basic.range
      if (this.basicWindup > 0) {
        this.model.root.rotation.y = Math.atan2(player.x - this.position.x, player.z - this.position.z)
        this.basicWindup = Math.max(0, this.basicWindup - dt)
        charge = 1 - this.basicWindup / basic.windup
        if (this.basicWindup === 0) {
          damage = basic.damage
          this.basicCooldown = basic.cooldown * (this.enraged ? this.config.enrageTempo : 1)
          this.basicImpact = 1
          charge = 0
        }
      } else if (!this.current) {
        this.timer -= dt
        if (this.timer <= 0) {
          const warnings = this.warnings[this.next]
          const attack = warnings[0].attack
          this.next = (this.next + 1) % this.warnings.length
          const facing = Math.atan2(player.x - this.position.x, player.z - this.position.z)
          this.model.root.rotation.y = facing
          this.windup = attack.warning * (this.enraged ? this.config.enrageTempo : 1)
          this.timer = this.windup
          for (let i = 0; i < warnings.length; i++) {
            this.center.copy(attack.kind === 'blast' || attack.kind === 'storm' ? player : this.position)
            if (i > 0 && !attack.rays) {
              const offset = i === 1 ? -2.3 : 2.3
              this.center.x += Math.cos(facing) * offset
              this.center.z -= Math.sin(facing) * offset
            }
            warnings[i].aim(this.center, facing + (attack.rays ? i * Math.PI * 2 / attack.rays : 0))
          }
          this.current = warnings
        } else if (inMelee && this.basicCooldown === 0) {
          this.basicWindup = basic.windup
          this.model.root.rotation.y = Math.atan2(player.x - this.position.x, player.z - this.position.z)
          charge = 0
        }
      } else if (this.impact > 0) {
        this.impact = Math.max(0, this.impact - dt * 5)
        if (this.impact > 0) this.current.forEach(warning => warning.show(1, this.impact))
        else this.clearWarning()
      } else {
        this.timer -= dt
        charge = 1 - Math.max(0, this.timer) / this.windup
        this.current.forEach(warning => warning.show(charge, 0))
        if (this.timer <= 0) {
          damage = this.current.some(warning => warning.contains(player)) ? this.current[0].attack.damage : 0
          this.impact = 1
          this.current.forEach(warning => warning.show(1, 1))
          this.timer = this.config.recovery * (this.enraged ? this.config.enrageTempo : 1)
          charge = 0
        }
      }
    }
    if (this.id === 'rootGuardian' && this.active && !this.current && this.basicWindup === 0 && this.basicImpact === 0 && distance > this.config.basic.range * .9) {
      const direction = player.clone().sub(this.position).setY(0).normalize()
      const candidate = this.position.clone().addScaledVector(direction, dt * .85)
      if (candidate.distanceTo(this.anchor) < 2.8) {
        this.position.copy(candidate)
        this.model.root.rotation.y = Math.atan2(direction.x, direction.z)
        moving = true
      }
    }
    this.model.animate(time, charge, Math.max(this.impact, this.basicImpact), this.enraged, this.flash > 0, moving, !!this.current, dt)
    return damage
  }

  private clearWarning() {
    this.current?.forEach(warning => { warning.root.visible = false })
    this.current = undefined
    if (!this.active) for (const warning of this.warnings.flat()) warning.clearEffects()
  }
}
