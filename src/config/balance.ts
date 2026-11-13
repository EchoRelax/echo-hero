export const hero = {
  health: 100,
  damage: 1,
  attackInterval: 1.1,
  speed: 4.5,
  range: 2.7,
  sweepAngle: Math.PI * 2 / 3,
  pickupRadius: 2,
}

export interface EnemyDefinition {
  name: string
  model: 'slime' | 'beetle' | 'imp' | 'guardian' | 'wisp'
  color: string
  health: number
  damage: number
  speed: number
  detection: number
  leash: number
  range: number
  windup: number
  recovery: number
  xp: number
  gold: number
  respawnTime: number
  armor?: number
  dash?: number
}

export const slime: EnemyDefinition = {
  name: 'Forest Slime',
  model: 'slime',
  color: '#a3d64b',
  health: 48,
  damage: 8,
  speed: 1.9,
  detection: 6.2,
  leash: 10,
  range: 1.25,
  windup: 0.45,
  recovery: 0.95,
  xp: 15,
  gold: 12,
  respawnTime: 4,
}

const baseEnemies = {
  slime,
  beetle: { ...slime, name: 'Forest Beetle', model: 'beetle', color: '#3a8b79', health: 36, speed: 3.05, damage: 7, xp: 13, gold: 10 },
  imp: { ...slime, name: 'Ash Imp', model: 'imp', color: '#d16b43', health: 72, damage: 14, speed: 2.5, dash: 5.5, xp: 24, gold: 19 },
  stone: { ...slime, name: 'Stone Guardian', model: 'guardian', color: '#9c7964', health: 108, damage: 19, speed: 1.55, windup: 0.7, xp: 31, gold: 24 },
  wisp: { ...slime, name: 'Storm Wisp', model: 'wisp', color: '#a392eb', health: 94, damage: 20, speed: 2.2, range: 2.25, windup: 0.68, xp: 37, gold: 28 },
  thunder: { ...slime, name: 'Thunder Beetle', model: 'beetle', color: '#6951b7', health: 118, armor: 0.2, speed: 2.45, damage: 23, xp: 44, gold: 33 },
} satisfies Record<string, EnemyDefinition>

export const enemies = {
  ...baseEnemies,
  thorn: { ...baseEnemies.beetle, name: 'Thorn Beetle', color: '#ad9a48', speed: 3.35, windup: 0.4 },
  ironbark: { ...baseEnemies.beetle, name: 'Ironbark Beetle', color: '#725b45', armor: 0.16, speed: 2.55 },
  mossback: { ...slime, name: 'Mossback Slime', color: '#507936', armor: 0.10 },
  cinder: { ...baseEnemies.imp, name: 'Cinder Imp', color: '#ef774a', dash: 7.1, speed: 2.75 },
  basalt: { ...baseEnemies.stone, name: 'Basalt Sentinel', color: '#65454d', armor: 0.14 },
  kiln: { ...baseEnemies.stone, name: 'Kiln Warden', color: '#ad6152', armor: 0.21, range: 1.55 },
  conductor: { ...baseEnemies.wisp, name: 'Conduit Wisp', color: '#78c6e7', range: 2.45 },
  tempest: { ...baseEnemies.thunder, name: 'Tempest Beetle', color: '#a35cca', armor: 0.23, speed: 2.75 },
  crown: { ...baseEnemies.wisp, name: 'Crown Wisp', color: '#e491f2', range: 2.6, windup: 0.72 },
} satisfies Record<string, EnemyDefinition>

export const progressionBalance = {
  firstLevelXp: 30,
  xpIncrease: 15,
  healthPerLevel: 8,
  damagePerLevel: 0.01,
  xpCurveAfterLevel: 5,
  xpCurve: 4,
  talentInterval: 5,
  milestoneGold: 20,
}

export const talents = {
  warrior: { label: 'Warrior', stat: 'damage', gain: 0.03 },
  resilience: { label: 'Resilience', stat: 'health', gain: 0.05 },
  gatherer: { label: 'Gatherer', stat: 'capacity', gain: 0.08 },
} as const
export type Talent = keyof typeof talents
export const talentKeys = Object.keys(talents) as Talent[]

export const upgrades = {
  damage: { label: 'Damage', basePrice: 3, gain: 1, limit: 200 },
  health: { label: 'Max Health', basePrice: 4, gain: 10, limit: 200 },
  regeneration: { label: 'Health Regeneration', basePrice: 150, gain: 1, limit: 100 },
  speed: { label: 'Attack Speed', basePrice: 250, gain: 1, limit: 120 },
  criticalChance: { label: 'Critical Chance', basePrice: 250, gain: 0.01, limit: 50 },
  criticalDamage: { label: 'Critical Multiplier', basePrice: 250, gain: 0.05, limit: 100 },
  movement: { label: 'Movement Speed', basePrice: 100, gain: 0.05, limit: 60 },
  doubleAttack: { label: 'Double Attack Chance', basePrice: 350, gain: 0.01, limit: 50 },
  tripleAttack: { label: 'Triple Attack Chance', basePrice: 500, gain: 0.01, limit: 30 },
  capacity: { label: 'Cargo Capacity', basePrice: 12, gain: 20, limit: 200 },
  runeDamage: { label: 'Rune Damage', basePrice: 200, gain: 0.05, limit: 200 },
  pickup: { label: 'Pickup Radius', basePrice: 50, gain: 0.1, limit: 30 },
} as const

export type Upgrade = keyof typeof upgrades
export const upgradeKeys = Object.keys(upgrades) as Upgrade[]
export const upgradePriceGrowth = {
  earlyPurchases: 10,
  basicSecondPrice: 6,
  basicPriceStep: 3,
  earlyMultiplier: 1.06,
  laterMultiplier: 1.13,
  basicGentleMultiplier: 1.09,
  basicMediumMultiplier: 1.075,
  basicLateMultiplier: 1.045,
}

export function tieredGain(rank: number) {
  const tiers = Math.floor(rank / 40)
  return 40 * tiers * (tiers + 1) / 2 + (rank % 40) * (tiers + 1)
}

// Damage rewards double every 20 purchases as upgrade prices and enemy HP rise.
export function damageUpgradeGain(rank: number) {
  const tiers = Math.floor(rank / 20)
  const gain = 2 ** tiers
  return 20 * (gain - 1) + (rank % 20) * gain
}

// Carry upgrades keep pace with larger drops in the later biomes.
export function capacityUpgradeGain(rank: number) {
  const tiers = Math.floor(rank / 10)
  return 20 * (10 * tiers * (tiers + 1) / 2 + (rank % 10) * (tiers + 1))
}
