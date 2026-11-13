import { Vector3 } from 'three'
import type { BossId } from '../config/bosses'
import { runeIds, runes, synergyFor, type RuneId, type RuneSlots } from '../config/runes'
import type { Health } from '../game/combat'
import type { CombatEffects } from './CombatEffects'

export interface CombatTarget {
  position: Vector3
  health: Health
  targetable?: boolean
  damage(amount: number): number
  slow?(fraction: number, duration: number): void
}

export class RuneSystem {
  private strikes = 0

  constructor(private equipped: RuneSlots) {}

  get active() { return this.equipped }

  equip(slot: 0 | 1, id: RuneId | null, defeated: ReadonlySet<BossId>) {
    if (id === this.equipped[slot] || (id && !defeated.has(runes[id].unlock))) return false
    const other = slot === 0 ? 1 : 0
    if (id && this.equipped[other] === id) this.equipped[other] = null
    this.equipped[slot] = id
    this.resetChain()
    return true
  }

  resetChain() {
    this.strikes = 0
  }

  strike(origin: Vector3, targets: readonly CombatTarget[], effects: CombatEffects) {
    this.strikes++
    const synergy = synergyFor(this.equipped)
    for (const id of runeIds) {
      if (this.equipped.includes(id) && this.strikes % runes[id].interval === 0) effects.cast(id, origin, targets, synergy)
    }
  }
}
