import { progressionBalance, talentKeys, upgradeKeys, upgrades } from '../config/balance'
import { levelThreshold, newProgress, type ProgressData } from './Progression'
import type { BossId } from '../config/bosses'
import { camps } from '../config/camps'
import { runeIds, runes, type RuneSlots, type RuneId } from '../config/runes'
import { zones } from '../config/zones'
import { newQuests, quests, type QuestProgress } from './QuestSystem'
import type { HuntRecord } from './HuntReadiness'
import { gameStorage } from '../platform/CrazyGames'
import {newEchoProgress,readEcho,type EchoProgress} from './EchoHunt'

const key = 'echo-hunt-progress'
const version = 8

export interface HuntSave {
  progress: ProgressData
  defeatedBosses: BossId[]
  slots: RuneSlots
  quests: QuestProgress
  hunt: HuntRecord
  echo?: EchoProgress
  grantedRunes?: RuneId[]
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isProgress(value: unknown): value is ProgressData {
  if (value === null || typeof value !== 'object') return false
  const data = value as Partial<ProgressData>
  const ranks = data.upgrades
  return isCount(data.level) && data.level > 0 &&
    isCount(data.xp) && data.xp < levelThreshold(data.level) &&
    isCount(data.gold) && ranks !== null && typeof ranks === 'object' &&
    ['damage', 'health', 'speed', 'pickup'].every(key => isCount((ranks as Record<string, unknown>)[key]))
}

export class SaveSystem {
  load(): HuntSave {
    try {
      const raw = gameStorage.getItem(key)
      if (raw) {
        const save = JSON.parse(raw)
        if ([1, 2, 3, 4, 5, 6, 7, version].includes(save?.version) && isProgress(save.progress)) {
          const defeatedBosses: BossId[] = []
          if (save.version >= 2 && Array.isArray(save.defeatedBosses)) {
            for (const zone of zones) {
              if (save.defeatedBosses.includes(zone.boss)) defeatedBosses.push(zone.boss)
            }
          }
          const slots: RuneSlots = [null, null]
          const grantedRunes=Array.isArray(save.grantedRunes)?runeIds.filter(id=>save.grantedRunes.includes(id)):[]
          const rawSlots = save.version === 2 ? [save.equippedRune] : save.slots
          if (Array.isArray(rawSlots)) {
            for (const slot of [0, 1] as const) {
              const rune = runeIds.find(id => id === rawSlots[slot] && (defeatedBosses.includes(runes[id].unlock)||grantedRunes.includes(id)))
              if (rune && !slots.includes(rune)) slots[slot] = rune
            }
          }
          const questProgress = newQuests()
          if (save.version < 3) {
            const { level, xp } = save.progress
            const levels = level - 1
            const total = xp + levels * (2 * progressionBalance.firstLevelXp + (levels - 1) * progressionBalance.xpIncrease) / 2
            const legacyGuardianXp = defeatedBosses.includes('rootGuardian') ? 75 : 0
            questProgress.kills.valley = Math.max(0, Math.floor((total - legacyGuardianXp) / 15))
          } else {
            const stored = save.quests
            if (isCount(stored?.completed)) questProgress.completed = Math.min(quests.length, stored.completed)
            for (const [index, zone] of zones.entries()) {
              const kills = stored?.kills?.[zone.id]
              if (isCount(kills)) questProgress.kills[zone.id] = kills
              if (index > 0 && Array.isArray(stored?.visited) && stored.visited.includes(zone.id)) {
                questProgress.visited.push(zone.id)
              }
            }
          }
          const hunt: HuntRecord = { campKills: {} }
          const seconds = save.hunt?.firstBossSeconds
          if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0) hunt.firstBossSeconds = seconds
          else if (!defeatedBosses.includes('rootGuardian')) hunt.firstBossSeconds = 0
          for (const camp of camps) {
            const kills = save.hunt?.campKills?.[camp.id]
            if (isCount(kills)) hunt.campKills[camp.id] = kills
          }
          const progress = { ...newProgress(), ...save.progress, upgrades: newProgress().upgrades }
          for (const key of upgradeKeys) {
            const rank = save.progress.upgrades[key]
            if (isCount(rank)) progress.upgrades[key] = Math.min(rank, upgrades[key].limit)
          }
          progress.cargo = isCount(save.progress.cargo) ? save.progress.cargo : 0
          progress.baseUnlocked = save.progress.baseUnlocked === true || progress.gold > 0 || progress.cargo > 0
          const reached = Math.floor(progress.level / 5)
          progress.milestonePaid = isCount(save.progress.milestonePaid) ? Math.min(reached, save.progress.milestonePaid) : reached
          progress.talents = { ...newProgress().talents }
          let remaining = reached
          for (const key of talentKeys) {
            const rank = save.progress.talents?.[key]
            if (isCount(rank)) {
              progress.talents[key] = Math.min(remaining, rank)
              remaining -= progress.talents[key]
            }
          }
          return { progress, defeatedBosses, slots, quests: questProgress, hunt,echo:readEcho(save.echo,defeatedBosses.length===3),grantedRunes }
        }
      }
    } catch {
      // Invalid JSON or browser storage disabled.
    }
    return { progress: newProgress(), defeatedBosses: [], slots: [null, null], quests: newQuests(), hunt: { campKills: {}, firstBossSeconds: 0 },echo:newEchoProgress() }
  }

  reset() {
    try {
      gameStorage.removeItem(key)
      return gameStorage.getItem(key) === null
    } catch { return false }
  }

  write(save: HuntSave) {
    try {
      gameStorage.setItem(key, JSON.stringify({ version, ...save }))
      return true
    } catch {
      return false
    }
  }
}
