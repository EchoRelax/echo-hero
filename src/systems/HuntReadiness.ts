import type { CampId } from '../config/camps'

export interface HuntRecord {
  campKills: Partial<Record<CampId, number>>
  firstBossSeconds?: number
}

export class HuntReadiness {
  constructor(readonly record: HuntRecord) {}

  kill(camp: CampId) {
    this.record.campKills[camp] = (this.record.campKills[camp] ?? 0) + 1
  }

}
