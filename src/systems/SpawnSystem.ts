import { Enemy } from '../entities/Enemy'

export class SpawnSystem {
  private readonly slots: { enemy: Enemy; remaining: number }[]

  constructor(enemies: Enemy[]) {
    this.slots = enemies.map(enemy => ({ enemy, remaining: enemy.config.respawnTime }))
  }

  update(dt: number) {
    for (const slot of this.slots) {
      const { enemy } = slot
      if (enemy.health.alive) {
        slot.remaining = enemy.config.respawnTime
        continue
      }
      slot.remaining = Math.max(0, slot.remaining - dt)
      if (slot.remaining > 0) continue
      enemy.reset()
      slot.remaining = enemy.config.respawnTime
    }
  }
}
