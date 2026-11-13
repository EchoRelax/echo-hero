import type { Vector3 } from 'three'
import { effects, type RuneId, type Synergy } from '../config/runes'
import type { CombatTarget } from './RuneSystem'

interface Status {
  rooted: number
  burnTicks: number
  untilTick: number
}

export interface SpellOutput {
  hit(target: CombatTarget, damage: number, element: RuneId): void
  burst(point: Vector3, element: RuneId, radius: number): void
  arc(from: Vector3, to: Vector3): void
}

export class CombatEffects {
  private statuses = new Map<CombatTarget, Status>()

  constructor(private readonly output: SpellOutput) {}

  clear(target?: CombatTarget) {
    if (target) this.statuses.delete(target)
    else this.statuses.clear()
  }

  update(dt: number) {
    for (const [target, status] of this.statuses) {
      if (!target.health.alive) {
        this.clear(target)
        continue
      }
      status.rooted = Math.max(0, status.rooted - dt)
      if (status.burnTicks > 0) {
        status.untilTick -= dt
        if (status.untilTick <= 0) {
          status.untilTick += effects.fire.tickInterval
          status.burnTicks--
          this.output.hit(target, effects.fire.tickDamage, 'fire')
        }
      }
      if (!status.rooted && !status.burnTicks) this.clear(target)
    }
  }

  cast(rune: RuneId, origin: Vector3, targets: readonly CombatTarget[], synergy?: Synergy) {
    if (rune === 'lightning') {
      this.lightning(origin, targets, synergy)
      return
    }
    const config = effects[rune]
    this.output.burst(origin, rune, config.radius)
    for (const target of this.inArea(origin, targets, config.radius)) {
      this.output.hit(target, config.damage, rune)
      if (!target.health.alive) continue
      const status = this.status(target)
      if (rune === 'root') {
        status.rooted = effects.root.duration
        target.slow?.(effects.root.slow, effects.root.duration)
      } else {
        if (!status.burnTicks) status.untilTick = effects.fire.tickInterval
        status.burnTicks = effects.fire.ticks
      }
      if (synergy === 'burningRoots' && status.rooted > 0 && status.burnTicks > 0) {
        this.output.hit(target, effects.burningRoots.damage, 'fire')
      }
    }
  }

  private lightning(origin: Vector3, targets: readonly CombatTarget[], synergy?: Synergy) {
    const config = effects.lightning
    let point = origin
    let limit = config.jumps
    const struck = new Set<CombatTarget>()
    for (let i = 0; i < limit; i++) {
      let nearest: CombatTarget | undefined
      let distance = config.reach ** 2
      for (const target of targets) {
        if (!target.health.alive || target.targetable === false || struck.has(target)) continue
        const squared = target.position.distanceToSquared(point)
        if (squared > distance) continue
        nearest = target
        distance = squared
      }
      if (!nearest) break
      struck.add(nearest)
      this.output.arc(point, nearest.position)
      const status = this.statuses.get(nearest)
      this.output.hit(nearest, config.damage, 'lightning')
      if (synergy === 'stormVines' && status?.rooted && limit === config.jumps) limit += effects.stormVines.jumps
      if (synergy === 'plasmaBurst' && status?.burnTicks) {
        status.burnTicks = 0
        const { radius, damage } = effects.plasmaBurst
        this.output.burst(nearest.position, 'lightning', radius)
        for (const target of this.inArea(nearest.position, targets, radius)) this.output.hit(target, damage, 'lightning')
      }
      point = nearest.position
    }
  }

  private status(target: CombatTarget) {
    let status = this.statuses.get(target)
    if (!status) {
      status = { rooted: 0, burnTicks: 0, untilTick: 0 }
      this.statuses.set(target, status)
    }
    return status
  }

  private inArea(point: Vector3, targets: readonly CombatTarget[], radius: number) {
    return targets.filter(target => target.health.alive && target.targetable !== false && target.position.distanceToSquared(point) <= radius ** 2)
  }
}
