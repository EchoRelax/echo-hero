import type { BossId } from './bosses'

interface RuneDefinition {
  name: string
  description: string
  unlock: BossId
  interval: number
  color: string
}

export const runes = {
  root: {
    name: 'Root Rune', unlock: 'rootGuardian', interval: 4, color: '#c6fb82',
    description: 'Every fourth strike raises thorns, dealing 10 damage and slowing nearby enemies by 45% for 2.5 seconds.',
  },
  fire: {
    name: 'Fire Rune', unlock: 'ashGolem', interval: 3, color: '#ffa365',
    description: 'Every third strike erupts for 16 area damage and ignites enemies for three ticks of 5 damage.',
  },
  lightning: {
    name: 'Lightning Rune', unlock: 'stormLord', interval: 5, color: '#c3c5ff',
    description: 'Every fifth strike chains 18 lightning damage through up to three nearby enemies.',
  },
} as const satisfies Record<string, RuneDefinition>

export type RuneId = keyof typeof runes
export const runeIds = Object.keys(runes) as RuneId[]
export type RuneSlots = [RuneId | null, RuneId | null]

export const effects = {
  root: { damage: 10, radius: 3, slow: 0.45, duration: 2.5 },
  fire: { damage: 16, radius: 2.8, tickDamage: 5, ticks: 3, tickInterval: 0.8 },
  lightning: { damage: 18, reach: 4, jumps: 3 },
  burningRoots: { damage: 9 },
  stormVines: { jumps: 1 },
  plasmaBurst: { damage: 11, radius: 1.85 },
}

export const synergies = {
  burningRoots: { pair: ['root', 'fire'], name: 'Burning Roots', description: 'Enemies affected by both thorns and Burning take bonus fire damage.' },
  stormVines: { pair: ['root', 'lightning'], name: 'Storm Vines', description: 'Hitting a rooted enemy lets lightning jump to one extra target.' },
  plasmaBurst: { pair: ['fire', 'lightning'], name: 'Plasma Burst', description: 'Lightning detonates Burning enemies for extra area damage.' },
} as const

export type Synergy = keyof typeof synergies

export function synergyFor(slots: RuneSlots): Synergy | undefined {
  return (Object.keys(synergies) as Synergy[]).find(key => synergies[key].pair.every(id => slots.includes(id)))
}
