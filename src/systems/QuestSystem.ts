import { t } from '../i18n'
import type { BossId } from '../config/bosses'
import { synergyFor, type RuneId, type RuneSlots } from '../config/runes'
import type { ZoneId } from '../config/zones'

type Quest =
  | { text: string; type: 'KillEnemies'; zone: ZoneId; goal: number }
  | { text: string; type: 'BuyUpgrade' | 'ReachLevel'; goal: number }
  | { text: string; type: 'DefeatBoss'; boss: BossId }
  | { text: string; type: 'EquipRune'; rune: RuneId }
  | { text: string; type: 'EnterZone'; zone: ZoneId }
  | { text: string; type: 'EquipCombination' }

export const quests: readonly Quest[] = [
  { text: 'Defeat monsters in Green Valley', type: 'KillEnemies', zone: 'valley', goal: 2 },
  { text: 'Buy an upgrade', type: 'BuyUpgrade', goal: 1 },
  { text: 'Reach level 2', type: 'ReachLevel', goal: 2 },
  { text: 'Defeat the Ancient Root Guardian', type: 'DefeatBoss', boss: 'rootGuardian' },
  { text: 'Equip the Root Rune', type: 'EquipRune', rune: 'root' },
  { text: 'Enter Ash Canyon', type: 'EnterZone', zone: 'canyon' },
  { text: 'Defeat monsters in Ash Canyon', type: 'KillEnemies', zone: 'canyon', goal: 3 },
  { text: 'Defeat the Ash Golem', type: 'DefeatBoss', boss: 'ashGolem' },
  { text: 'Activate a rune combination', type: 'EquipCombination' },
  { text: 'Enter Storm Ruins', type: 'EnterZone', zone: 'ruins' },
  { text: 'Reach level 5', type: 'ReachLevel', goal: 5 },
  { text: 'Defeat the Storm Lord', type: 'DefeatBoss', boss: 'stormLord' },
]

export interface QuestProgress {
  completed: number
  kills: Record<ZoneId, number>
  visited: ZoneId[]
}

interface HuntFacts {
  level: number
  upgrades: number
  defeated: ReadonlySet<BossId>
  slots: RuneSlots
}

export function newQuests(): QuestProgress {
  return { completed: 0, kills: { valley: 0, canyon: 0, ruins: 0 }, visited: ['valley'] }
}

export class QuestSystem {
  constructor(readonly data: QuestProgress) {}

  visit(zone: ZoneId) {
    if (this.data.visited.includes(zone)) return false
    this.data.visited.push(zone)
    return true
  }

  kill(zone: ZoneId) {
    this.data.kills[zone]++
  }

  update(facts: HuntFacts) {
    while (this.data.completed < quests.length) {
      const quest = quests[this.data.completed]
      const value = this.value(quest, facts)
      const goal = 'goal' in quest ? quest.goal : 1
      if (value < goal) {
        return t`Quest ${this.data.completed + 1}/${quests.length} · ${quest.text} · ${value}/${goal}`
      }
      this.data.completed++
    }
    return t("Quest 12/12 · Wild Relics complete")
  }

  private value(quest: Quest, facts: HuntFacts) {
    switch (quest.type) {
      case 'KillEnemies': return this.data.kills[quest.zone]
      case 'BuyUpgrade': return facts.upgrades
      case 'ReachLevel': return facts.level
      case 'DefeatBoss': return Number(facts.defeated.has(quest.boss))
      case 'EquipRune': return Number(facts.slots.includes(quest.rune))
      case 'EnterZone': return Number(this.data.visited.includes(quest.zone))
      case 'EquipCombination': return Number(Boolean(synergyFor(facts.slots)))
    }
  }
}
