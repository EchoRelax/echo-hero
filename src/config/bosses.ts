type AttackShape = { kind: 'circle' | 'blast' | 'storm'; radius: number } | { kind: 'line'; length: number; width: number }

export type BossAttack = AttackShape & {
  roots?: boolean
  rays?: number
  name: string
  warning: number
  damage: number
}

export interface BossDefinition {
  name: string
  health: number
  engageRadius: number
  resetRadius: number
  recovery: number
  enrageAt: number
  enrageTempo: number
  basic: { range: number; damage: number; windup: number; cooldown: number }
  attacks: readonly [BossAttack, ...BossAttack[]]
  xp: number
  gold: number
}

export const bosses = {
  rootGuardian: {
    name: 'Ancient Root Guardian',
    health: 480,
    engageRadius: 5.6,
    resetRadius: 8.5,
    recovery: 1.55,
    enrageAt: 0.5,
    enrageTempo: 0.76,
    basic: { range: 3.05, damage: 8, windup: 0.34, cooldown: 1.35 },
    attacks: [
      { name: 'Piercing Roots', kind: 'line', length: 7.4, width: 1.65, warning: 1.25, damage: 18, roots: true },
      { name: 'Root Star', kind: 'line', length: 6.8, width: 1.45, warning: 1.55, damage: 22, roots: true, rays: 6 },
    ],
    xp: 150,
    gold: 180,
  },
  ashGolem: {
    name: 'Ash Golem', health: 2600, engageRadius: 5.8, resetRadius: 12.5,
    recovery: 2.2, enrageAt: 0.5, enrageTempo: 0.85,
    basic: { range: 2.8, damage: 26, windup: 0.65, cooldown: 1.25 },
    attacks: [
      { name: 'Stone Eruption', kind: 'circle', radius: 1.15, warning: 1.5, damage: 57 },
      { name: 'Rolling Stone Waves', kind: 'line', length: 9.6, width: 2.8, warning: 1.6, damage: 46 },
    ],
    xp: 400, gold: 600,
  },
  stormLord: {
    name: 'Storm Lord', health: 15000, engageRadius: 6, resetRadius: 13,
    recovery: 2.2, enrageAt: 0.5, enrageTempo: 0.85,
    basic: { range: 2.9, damage: 55, windup: 0.68, cooldown: 1.3 },
    attacks: [
      { name: 'Roaming Tempests', kind: 'circle', radius: .85, warning: 1.3, damage: 42 },
      { name: 'Lightning Rain', kind: 'storm', radius: 1.1, warning: 1.15, damage: 95 },
    ],
    xp: 1000, gold: 2400,
  },
} satisfies Record<string, BossDefinition>

export type BossId = keyof typeof bosses

export const stoneBossCombat = {
  walkSpeed: 1.05,
  walkRadius: 3.2,
  meleeRecovery: .42,
  slamRecovery: .65,
  chargeRecovery: .4,
  waveInterval: .72,
  waveContact: .21,
  waveRelease: .6,
  waveSpeed: 7.5,
  waveCount: 6,
} as const

export const stormBossCombat = {
  flySpeed: 1.15, flyRadius: 2.8,
  vortexCount: 6, vortexDuration: 10, vortexRadius: .85,
  vortexTravelRadius: 5.8, vortexCrossingTime: 5.5, vortexHitCooldown: .8,
  castDuration: 5, batchCount: 3, batchSize: 6, batchInterval: 1.7,
  boltRadius: 1.1, boltWarning: 1.15, arenaRadius: 6.7,
  meleeRecovery: .4, vortexRecovery: .55, stormRecovery: .45,
} as const
