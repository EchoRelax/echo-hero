export class Health {
  current: number

  constructor(private maximum: number) {
    this.current = maximum
  }

  get max() {
    return this.maximum
  }

  get alive() {
    return this.current > 0
  }

  damage(amount: number) {
    const dealt = Math.min(this.current, amount)
    this.current -= dealt
    return dealt
  }

  heal(amount: number) {
    if (!this.alive) return
    this.current = Math.min(this.max, this.current + Math.max(0, amount))
  }

  restore() {
    this.current = this.max
  }

  grow(maximum: number) {
    this.current += maximum - this.maximum
    this.maximum = maximum
  }
}

export class AutoAttack {
  private remaining = 0

  update(dt: number, hasTarget: boolean, interval: number) {
    this.remaining = Math.max(0, this.remaining - dt)
    if (!hasTarget || this.remaining > 0) return false
    this.remaining = interval
    return true
  }

  reset() {
    this.remaining = 0
  }
}
