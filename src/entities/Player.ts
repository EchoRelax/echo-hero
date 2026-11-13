import { MathUtils, Vector3 } from 'three'
import { hero } from '../config/balance'
import { AutoAttack, Health } from '../game/combat'
import { World } from '../world/World'
import { HeroModel, type HeroPose } from './HeroModel'

const swingLength = 0.50
const contactTime = 0.245

export class Player {
  readonly model = new HeroModel()
  readonly health: Health
  readonly attack = new AutoAttack()
  private strike = swingLength
  private strikeYaw = 0
  private reverse = true
  private moving = false
  private velocity = new Vector3()
  private hurt = 0

  constructor(maxHealth: number) {
    this.health = new Health(maxHealth)
  }

  get position() {
    return this.model.root.position
  }

  reset(checkpoint: number) {
    this.position.set(0, 0, checkpoint)
    this.model.root.rotation.y = Math.PI
    this.health.restore()
    this.attack.reset()
    this.strike = swingLength
    this.hurt = 0
    this.reverse = true
    this.moving = false
    this.velocity.set(0, 0, 0)
    this.model.reset()
    this.updateModel(0, 0, new Vector3())
  }

  move(world: World, direction: Vector3, dt: number, speed = hero.speed) {
    const { x, z } = this.position
    if (this.health.alive) world.move(this.position, direction.x * speed * dt, direction.z * speed * dt, 0.32)
    this.velocity.set(this.position.x - x, 0, this.position.z - z).divideScalar(Math.max(dt, 0.00001))
    this.moving = this.velocity.lengthSq() > 0.0001
  }

  startAttack(target: Vector3) {
    const dx = target.x - this.position.x, dz = target.z - this.position.z
    this.strikeYaw = dx || dz ? Math.atan2(dx, dz) : this.model.root.rotation.y
    this.strike = 0
    this.reverse = !this.reverse
  }

  advanceAttack(dt: number, interval = hero.attackInterval) {
    const previous = this.strike
    this.strike = Math.min(swingLength, this.strike + dt * Math.max(1, swingLength / (interval * 0.9)))
    if (previous >= contactTime || this.strike < contactTime) return false
    this.model.root.rotation.y = this.strikeYaw
    return true
  }

  damage(amount: number) {
    this.hurt = 0.22
    return this.health.damage(amount)
  }

  updateModel(dt: number, time: number, movement: Vector3, focus?: Vector3) {
    const moving = this.moving
    const attacking = this.strike < swingLength
    const pose: HeroPose = !this.health.alive ? 'dead'
      : this.hurt > 0 ? 'damaged'
      : attacking ? 'attacking'
      : moving ? 'running' : 'idle'
    const root = this.model.root
    if (pose !== 'dead' && (attacking || focus || moving)) {
      // A committed swing keeps its damage direction. Otherwise face actual
      // travel; only track the nearest target when standing still.
      const dx = moving ? this.velocity.x : focus ? focus.x - this.position.x : movement.x
      const dz = moving ? this.velocity.z : focus ? focus.z - this.position.z : movement.z
      const facing = attacking ? this.strikeYaw : dx || dz ? Math.atan2(dx, dz) : root.rotation.y
      const delta = MathUtils.euclideanModulo(facing - root.rotation.y + Math.PI, Math.PI * 2) - Math.PI
      root.rotation.y += delta * (1 - Math.exp(-24 * dt))
    }
    this.model.animate(pose, moving && pose !== 'dead', time, dt, attacking && pose !== 'dead' ? this.strike / swingLength : -1, this.reverse, this.velocity)
    this.hurt = Math.max(0, this.hurt - dt)
  }
}
