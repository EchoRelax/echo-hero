import type { Upgrade } from '../config/balance'
import type { Progression } from './Progression'

// Derived from saved ranks, so completing a step never requires a second purchase.
export function recommendedTraining(progress: Progression): Upgrade | undefined {
  if (progress.rank('damage') < 1) return 'damage'
  if (progress.rank('health') < 1) return 'health'
  if (progress.rank('damage') < 3) return 'damage'
  if (progress.rank('capacity') < 2) return 'capacity'
  if (progress.rank('damage') < 8) return 'damage'
  if (progress.rank('health') < 5) return 'health'
  if (progress.rank('capacity') < 4) return 'capacity'
  if (progress.rank('damage') < 20) return 'damage'
  return undefined
}
