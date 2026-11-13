import { Scene, Vector3 } from 'three'
import { bosses, stoneBossCombat as timing } from '../config/bosses'
import { Health } from '../game/combat'
import { StoneBossEffects } from '../effects/StoneBossEffects'
import { Boss2Model, type StonePose } from './Boss2Model'

type State = 'idle' | 'melee' | 'slam' | 'recoverMelee' | 'recoverSlam' | 'charge' | 'barrage' | 'recoverCharge'

export class StoneBossController {
  readonly id = 'ashGolem' as const
  readonly config = bosses.ashGolem
  readonly health = new Health(this.config.health)
  active = false
  targetable = true
  private anchor = new Vector3()
  private state: State = 'idle'
  private elapsed = 0
  private specialCooldown = 1
  private basicCooldown = 0
  private flash = 0
  private next: 'slam' | 'charge' = 'slam'
  private facing = 0
  private launched = 0
  private attackTempo = 1
  private effects: StoneBossEffects

  constructor(private model: Boss2Model, position: Vector3, scene: Scene) {
    this.anchor.copy(position);this.position.copy(position)
    const [eruption, waves] = this.config.attacks
    this.effects = new StoneBossEffects(eruption.radius, waves.width, waves.length)
    scene.add(model.root, this.effects.root)
  }

  get position() { return this.model.root.position }
  get enraged() { return this.health.current <= this.health.max * this.config.enrageAt }
  get warningName() {
    if (this.state === 'slam') return this.config.attacks[0].name
    if (this.state === 'charge' || this.state === 'barrage') return this.config.attacks[1].name
    if (this.state === 'melee') return 'Quick Strike'
    return undefined
  }
  private get tempo() { return this.enraged ? this.config.enrageTempo : 1 }

  damage(amount: number) { this.flash = .17;return this.health.damage(this.targetable ? amount : 0) }

  reset() {
    this.model.root.visible = true
    this.active = false;this.health.restore();this.position.copy(this.anchor);this.model.root.rotation.y = 0
    this.state = 'idle';this.elapsed = this.basicCooldown = this.flash = this.launched = 0
    this.specialCooldown = 1;this.next = 'slam';this.effects.clear();this.model.pose('Idle', 0, 0)
  }

  remove() { this.active = false;this.model.root.visible = false;this.effects.clear() }

  /** Explicit combat entry for the development panel; excluded from release behavior. */
  debugAttack(kind: 'melee' | 'slam' | 'charge', player: Vector3) {
    if (!import.meta.env.DEV) return
    this.reset();this.active = true;this.attackTempo = this.tempo
    this.facing = Math.atan2(player.x - this.position.x, player.z - this.position.z)
    this.model.root.rotation.y = this.facing
    if (kind === 'melee') this.enter('melee')
    else { this.next = kind;this.beginSpecial(player) }
  }

  private enter(state: State) { this.state = state;this.elapsed = 0 }

  private beginSpecial(player: Vector3) {
    this.attackTempo = this.tempo
    this.facing = Math.atan2(player.x - this.position.x, player.z - this.position.z)
    this.model.root.rotation.y = this.facing
    this.enter(this.next)
    if (this.next === 'slam') {
      const point = player.clone().sub(this.anchor).setY(0).clampLength(0, 6).add(this.anchor)
      const points = [this.position.clone().add(new Vector3(Math.sin(this.facing) * 1.6, 0, Math.cos(this.facing) * 1.6)), point]
      for (const offset of [-1.3, 1.3, Math.PI]) {
        const angle = this.facing + offset
        points.push(this.position.clone().add(new Vector3(Math.sin(angle) * 3.7, 0, Math.cos(angle) * 3.7)))
      }
      this.effects.markEruptions(points);this.next = 'charge'
    } else { this.launched = 0;this.next = 'slam' }
  }

  update(player: Vector3, dt: number, time: number) {
    if (!this.health.alive || !this.targetable) { this.effects.clear();return 0 }
    const distance = this.position.distanceTo(player)
    if (this.active && distance > this.config.resetRadius) { this.reset();return 0 }
    if (!this.active && distance <= this.config.engageRadius) this.active = true
    this.effects.update(dt, timing.waveSpeed)
    this.flash = Math.max(0, this.flash - dt);this.basicCooldown = Math.max(0, this.basicCooldown - dt)
    if (!this.active) { this.model.pose('Idle', 0, dt, this.flash > 0);return 0 }
    this.elapsed += dt
    let damage = 0, pose: StonePose = 'Idle', progress = 0, power = 0
    switch (this.state) {
      case 'idle': {
        this.specialCooldown -= dt
        if (this.specialCooldown <= 0) this.beginSpecial(player)
        else if (distance <= this.config.basic.range && this.basicCooldown === 0) {
          this.facing = Math.atan2(player.x - this.position.x, player.z - this.position.z)
          this.model.root.rotation.y = this.facing;this.attackTempo = this.tempo;this.enter('melee')
        } else if (distance > this.config.basic.range * .88) {
          const direction = player.clone().sub(this.position).setY(0).normalize()
          const candidate = this.position.clone().addScaledVector(direction, dt * timing.walkSpeed)
          if (candidate.distanceTo(this.anchor) <= timing.walkRadius) {
            this.position.copy(candidate);this.model.root.rotation.y = Math.atan2(direction.x, direction.z);pose = 'Walk'
          }
        }
        break
      }
      case 'melee': {
        const duration = this.config.basic.windup * this.attackTempo
        pose = 'Melee';progress = Math.min(1, this.elapsed / duration) * .62
        if (this.elapsed >= duration) {
          const offset = player.clone().sub(this.position)
          const ahead = offset.x * Math.sin(this.facing) + offset.z * Math.cos(this.facing)
          if (distance <= this.config.basic.range + .15 && ahead >= -.15) damage = this.config.basic.damage
          this.basicCooldown = this.config.basic.cooldown * this.tempo;this.enter('recoverMelee')
        }
        break
      }
      case 'recoverMelee':
        pose = 'Melee';progress = .62 + Math.min(1, this.elapsed / timing.meleeRecovery) * .38
        if (this.elapsed >= timing.meleeRecovery) this.enter('idle')
        break
      case 'slam': {
        const duration = this.config.attacks[0].warning * this.attackTempo
        const charge = Math.min(1, this.elapsed / duration)
        pose = 'GroundSlam';progress = charge * .64;this.effects.showEruptions(charge)
        if (this.elapsed >= duration) {
          if (this.effects.eruptions.some(e => e.warning.contains(player))) damage = this.config.attacks[0].damage
          this.effects.erupt(this.position);this.specialCooldown = this.config.recovery * this.tempo;this.enter('recoverSlam')
        }
        break
      }
      case 'recoverSlam':
        pose = 'GroundSlam';progress = .64 + Math.min(1, this.elapsed / timing.slamRecovery) * .36
        if (this.elapsed >= timing.slamRecovery) this.enter('idle')
        break
      case 'charge': {
        const duration = this.config.attacks[1].warning * this.attackTempo
        pose = 'Charge';progress = Math.min(1, this.elapsed / duration);power = progress
        if (progress > .6) this.effects.markLane(this.position, this.facing, (progress - .6) / .4)
        if (this.elapsed >= duration) this.enter('barrage')
        break
      }
      case 'barrage': {
        // Every wave gets its own anticipation, launch event and travelling hitbox.
        const cycle = timing.waveInterval * this.attackTempo
        pose = 'WaveRelease';progress = Math.min(1, (this.elapsed % cycle) / (timing.waveRelease * this.attackTempo));power = 1
        while (this.launched < timing.waveCount && this.elapsed >= this.launched * cycle + timing.waveContact * this.attackTempo) {
          this.effects.launch(this.launched, this.position, this.facing + this.launched * Math.PI / 3);this.launched++
        }
        if (this.launched < timing.waveCount) {
          const until = this.launched * cycle + timing.waveContact * this.attackTempo - this.elapsed
          const angle = this.facing + this.launched * Math.PI / 3
          if (until <= .5 * this.attackTempo) {
            this.effects.markLane(this.position, angle, 1 - until / (.5 * this.attackTempo))
            const delta = Math.atan2(Math.sin(angle - this.model.root.rotation.y), Math.cos(angle - this.model.root.rotation.y))
            this.model.root.rotation.y += delta * (1 - Math.exp(-12 * dt))
          }
        }
        if (this.elapsed >= (timing.waveCount - 1) * cycle + timing.waveRelease * this.attackTempo) {
          this.effects.lane.root.visible = false;this.specialCooldown = this.config.recovery * this.tempo;this.enter('recoverCharge')
        }
        break
      }
      case 'recoverCharge':
        pose = 'Charge';progress = power = 1 - Math.min(1, this.elapsed / timing.chargeRecovery)
        if (this.elapsed >= timing.chargeRecovery) this.enter('idle')
        break
    }
    for (const wave of this.effects.waves) {
      if (!wave.root.visible || wave.hit) continue
      const x = player.x - wave.origin.x, z = player.z - wave.origin.z
      const along = x * Math.sin(wave.angle) + z * Math.cos(wave.angle)
      const across = x * Math.cos(wave.angle) - z * Math.sin(wave.angle)
      if (along >= Math.max(0, wave.previous - .55) && along <= Math.min(this.config.attacks[1].length, wave.distance + .55) && Math.abs(across) <= this.config.attacks[1].width / 2) {
        damage += this.config.attacks[1].damage;wave.hit = true
      }
    }
    this.effects.charge(this.position, this.model.root.rotation.y, power, time)
    this.model.pose(pose, progress, dt, this.flash > 0, power)
    return damage
  }
}
