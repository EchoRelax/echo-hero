import type { HuntRecord } from './HuntReadiness'

/** Measures active wall time, independently of the capped combat simulation step. */
export class FirstBossRun {
  private since?: number

  constructor(private record: HuntRecord, public completed: boolean) {
    if (!completed) this.record.firstBossSeconds ??= 0
  }

  get seconds() { return this.record.firstBossSeconds }

  update(now = performance.now()) {
    if (this.since === undefined) return
    this.record.firstBossSeconds = (this.seconds ?? 0) + Math.max(0, now - this.since) / 1000
    this.since = now
  }

  setRunning(running: boolean, now = performance.now()) {
    this.update(now)
    this.since = running && !this.completed ? now : undefined
  }

  finish(now = performance.now()) {
    this.setRunning(false, now)
    this.completed = true
  }
}
