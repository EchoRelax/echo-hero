import { Vector3 } from 'three'
import type { EnemyDefinition } from '../config/balance'
import type { CampId } from '../config/camps'
import { zoneAt } from '../config/zones'
import { Health } from '../game/combat'
import { World } from '../world/World'
import { EnemyModel } from './ActorModels'

type EnemyState = 'idle' | 'chase' | 'attack' | 'dash' | 'return' | 'dead'

export class Enemy {
  readonly model: EnemyModel
  readonly health: Health
  readonly zone
  private state: EnemyState = 'idle'
  private timer = 0
  private flash = 0
  private defeat = 0
  private slowTime = 0
  private slowFraction = 0
  private offset = new Vector3()
  private attackDirection = new Vector3()
  private impact = 0

  constructor(readonly config: EnemyDefinition, readonly home: Vector3, readonly camp?: CampId) {
    this.model = new EnemyModel(config)
    this.zone = zoneAt(home.x, home.z)
    this.health = new Health(config.health)
    this.reset()
  }

  get position() {
    return this.model.root.position
  }

  reset() {
    this.position.copy(this.home)
    this.model.root.rotation.y = 0
    this.health.restore()
    this.state = 'idle'
    this.timer = this.flash = this.defeat = this.impact = 0
    this.slowTime = 0
    this.model.animate(0, false, 0, 0, 0)
  }

  damage(amount: number) {
    this.flash = 0.16
    const dealt = this.health.damage(Math.max(1, Math.round(amount * (1 - (this.config.armor ?? 0)))))
    if (!this.health.alive) this.state = 'dead'
    return dealt
  }

  slow(fraction: number, duration: number) {
    this.slowFraction = fraction
    this.slowTime = duration
  }

  separate(other: Enemy, world: World, dt: number) {
    if (!this.health.alive || !other.health.alive || this.state === 'idle' && other.state === 'idle') return
    const x = this.position.x - other.position.x
    const z = this.position.z - other.position.z
    const squared = x * x + z * z
    if (squared >= 1.06 ** 2) return
    const distance = Math.sqrt(squared)
    const push = Math.min(0.55 * (1.06 - distance), dt * 1.8)
    const dx = distance > 0.0001 ? x / distance * push : push
    const dz = distance > 0.0001 ? z / distance * push : 0
    world.move(this.position, dx, dz, 0.43, this.zone)
    world.move(other.position, -dx, -dz, 0.43, other.zone)
  }

  update(world: World, player: Vector3, dt: number, time: number) {
    const { detection, leash, range, recovery, windup, speed, damage, dash } = this.config
    this.slowTime = Math.max(0, this.slowTime - dt)
    const step = speed * dt * (this.slowTime > 0 ? 1 - this.slowFraction : 1)
    const distance = this.position.distanceTo(player)
    let dealt = 0
    let charge = 0
    let moving = false
    this.flash = Math.max(0, this.flash - dt)
    this.impact = Math.max(0, this.impact - dt * 6)

    if (this.state === 'dead') {
      this.defeat = Math.min(1, this.defeat + dt * 3)
    } else if (this.state === 'dash') {
      this.timer -= dt
      const speed = (dash ?? 0) * dt * (this.slowTime > 0 ? 1 - this.slowFraction : 1)
      world.move(this.position, this.attackDirection.x * speed, this.attackDirection.z * speed, 0.43, this.zone)
      moving = true
      if (this.timer <= 0) dealt = damage
      if (dealt || this.timer <= 0) {
        this.state = 'chase'
        this.timer = recovery
      }
    } else if (this.state === 'attack') {
      this.timer -= dt
      charge = 1 - Math.max(0, this.timer) / windup
      if (this.timer <= 0) {
        this.impact = 1
        if (dash) {
          this.state = 'dash'
          this.timer = 0.38
        } else {
          dealt = damage
          this.state = 'chase'
          this.timer = recovery
        }
      }
    } else {
      this.timer = Math.max(0, this.timer - dt)
      const homeDistance = this.position.distanceTo(this.home)
      if (this.state === 'return' && homeDistance < 0.1) this.state = 'idle'
      if (this.state === 'idle' && distance < detection) this.state = 'chase'
      if (this.state === 'chase') {
        if (homeDistance > leash || distance > detection + 2) {
          this.state = 'return'
        } else if (distance <= range + (dash && this.timer === 0 ? 1.4 : 0)) {
          if (this.timer === 0) {
            this.state = 'attack'
            this.timer = windup
            this.attackDirection.subVectors(player, this.position).normalize()
            if (this.attackDirection.lengthSq() < 0.001) this.attackDirection.set(
              Math.sin(this.model.root.rotation.y), 0, Math.cos(this.model.root.rotation.y),
            )
            this.model.root.rotation.y = Math.atan2(this.attackDirection.x, this.attackDirection.z)
          }
        } else {
          moving = this.move(world, player, step)
        }
      }
      if (this.state === 'return') moving = this.move(world, this.home, step)
    }

    this.model.animate(time, moving, charge, this.flash, this.defeat, this.impact, dt)
    return dealt
  }

  private move(world: World, target: Vector3, step: number) {
    this.offset.subVectors(target, this.position).clampLength(0, step)
    this.model.root.rotation.y = Math.atan2(this.offset.x, this.offset.z)
    const { x, z } = this.position
    world.move(this.position, this.offset.x, this.offset.z, 0.43, this.zone)
    return x !== this.position.x || z !== this.position.z
  }
}
