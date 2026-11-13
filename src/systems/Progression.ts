import { hero, progressionBalance, tieredGain, damageUpgradeGain, upgrades, upgradeKeys, upgradePriceGrowth, type Upgrade } from '../config/balance'
import { capacityUpgradeGain, talents, talentKeys, type Talent } from '../config/balance'

export interface ProgressData {
  level: number
  xp: number
  gold: number
  cargo: number
  baseUnlocked: boolean
  milestonePaid: number
  talents: Record<Talent, number>
  upgrades: Record<Upgrade, number>
}

export const newProgress = (): ProgressData => ({
  level: 1, xp: 0, gold: 0, cargo: 0, baseUnlocked: false, milestonePaid: 0,
  talents: { warrior: 0, resilience: 0, gatherer: 0 },
  upgrades: Object.fromEntries(upgradeKeys.map(key => [key, 0])) as Record<Upgrade, number>,
})

export function levelThreshold(level: number) {
  return progressionBalance.firstLevelXp + (level - 1) * progressionBalance.xpIncrease +
    progressionBalance.xpCurve * Math.max(0, level - progressionBalance.xpCurveAfterLevel) ** 2
}

export class Progression {
  constructor(private readonly data: ProgressData) {}
  get level() { return this.data.level }
  get xp() { return this.data.xp }
  get nextLevel() { return levelThreshold(this.level) }
  get gold() { return this.data.gold }
  get cargo() { return this.data.cargo }
  get baseUnlocked() { return this.data.baseUnlocked }
  get damageBonus() { return (this.level - 1) * progressionBalance.damagePerLevel + this.talentBonus('warrior') }
  get talentPoints() {
    return Math.max(0, Math.floor(this.level / progressionBalance.talentInterval) - talentKeys.reduce((total, key) => total + this.data.talents[key], 0))
  }
  talentRank(key: Talent) { return this.data.talents[key] }
  chooseTalent(key: Talent) {
    if (!talentKeys.includes(key) || this.talentPoints < 1) return false
    this.data.talents[key]++
    return true
  }

  private talentBonus(key: Talent, preview?: Talent) {
    return talents[key].gain * (this.talentRank(key) + (preview === key ? 1 : 0))
  }

  addXp(amount: number) {
    const previous = this.level
    this.data.xp += amount
    while (this.xp >= this.nextLevel) {
      this.data.xp -= this.nextLevel
      this.data.level++
    }
    return this.level > previous
  }

  claimMilestones() {
    const reached = Math.floor(this.level / progressionBalance.talentInterval)
    let reward = 0
    while (this.data.milestonePaid < reached) {
      this.data.milestonePaid++
      reward += progressionBalance.milestoneGold
    }
    this.addGold(reward)
    return reward
  }

  addGold(amount: number) { this.data.gold += amount }

  loadCargo(amount: number) {
    const accepted = Math.min(amount, Math.max(0, this.stat('capacity') - this.cargo))
    this.data.cargo += accepted
    if (accepted > 0) this.data.baseUnlocked = true
    return accepted
  }

  deposit() {
    const amount = this.cargo
    this.data.gold += amount
    this.data.cargo = 0
    return amount
  }

  rank(key: Upgrade) { return this.data.upgrades[key] }

  price(key: Upgrade) {
    const rank = this.rank(key)
    const { earlyPurchases, earlyMultiplier, laterMultiplier } = upgradePriceGrowth
    const earlySteps = Math.min(rank, earlyPurchases - 1)
    const laterSteps = Math.max(0, rank - earlySteps)
    if (key === 'damage' || key === 'health') {
      if (rank === 0) return upgrades[key].basePrice
      const earlyPrice = upgradePriceGrowth.basicSecondPrice + upgradePriceGrowth.basicPriceStep * (earlySteps - 1)
      const gentle = Math.min(laterSteps, 10)
      const medium = Math.min(Math.max(0, laterSteps - gentle), 20)
      const late = Math.max(0, laterSteps - gentle - medium)
      return Math.ceil(earlyPrice * upgradePriceGrowth.basicGentleMultiplier ** gentle * upgradePriceGrowth.basicMediumMultiplier ** medium * upgradePriceGrowth.basicLateMultiplier ** late)
    }
    return Math.ceil(upgrades[key].basePrice * earlyMultiplier ** earlySteps * laterMultiplier ** laterSteps)
  }

  buy(key: Upgrade) {
    const price = this.price(key)
    if (this.rank(key) >= upgrades[key].limit || this.gold < price) return false
    this.data.gold -= price
    this.data.upgrades[key]++
    return true
  }

  stat(key: Upgrade, rank = this.rank(key), previewTalent?: Talent): number {
    const gain = upgrades[key].gain * rank
    switch (key) {
      case 'damage': return Math.round((hero.damage + damageUpgradeGain(rank)) * (1 + (this.level - 1) * progressionBalance.damagePerLevel + this.talentBonus('warrior', previewTalent)))
      case 'health': return Math.round((hero.health + gain + (this.level - 1) * progressionBalance.healthPerLevel) * (1 + this.talentBonus('resilience', previewTalent)))
      case 'speed': return hero.attackInterval / (1 + tieredGain(rank) * 0.01)
      case 'pickup': return hero.pickupRadius + gain
      case 'regeneration': return gain
      case 'criticalChance': case 'doubleAttack': case 'tripleAttack': return gain
      case 'criticalDamage': return 1.5 + gain
      case 'movement': return hero.speed + gain
      case 'capacity': return Math.round((20 + capacityUpgradeGain(rank)) * (1 + this.talentBonus('gatherer', previewTalent)))
      case 'runeDamage': return 1 + gain
    }
  }

  snapshot(): ProgressData { return { ...this.data, upgrades: { ...this.data.upgrades }, talents: { ...this.data.talents } } }
}
