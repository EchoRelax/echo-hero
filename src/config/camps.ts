import { enemies, type EnemyDefinition } from './balance'
import { zones, radialPoint, type ZoneId } from './zones'

type Species = keyof typeof enemies
type Tier = 0 | 1 | 2 | 3

interface Camp {
  id: string
  zone: ZoneId
  name: string
  x: number
  z: number
  tier: Tier
  species: readonly Species[]
}

const campLayouts = [
  { id: 'brook', zone: 'valley', name: 'Brook Meadow', x: 0, z: -9, tier: 0, species: ['slime', 'slime', 'slime'] },
  { id: 'fern', zone: 'valley', name: 'Fern Hollow', x: 14, z: -17, tier: 1, species: ['beetle', 'slime', 'slime', 'beetle', 'slime'] },
  { id: 'briar', zone: 'valley', name: 'Briarwood', x: -14, z: -26, tier: 2, species: ['thorn', 'slime', 'thorn', 'slime', 'thorn', 'thorn'] },
  { id: 'ironbark', zone: 'valley', name: 'Ironbark Rise', x: 15, z: -38, tier: 3, species: ['ironbark', 'ironbark', 'mossback', 'ironbark', 'ironbark', 'mossback'] },
  { id: 'embers', zone: 'canyon', name: 'Ember Wash', x: -12, z: -65, tier: 0, species: ['imp', 'imp', 'imp', 'imp', 'imp'] },
  { id: 'quarry', zone: 'canyon', name: 'Scoria Quarry', x: 14, z: -72, tier: 1, species: ['stone', 'imp', 'stone', 'imp', 'stone'] },
  { id: 'basalt', zone: 'canyon', name: 'Basalt Shelf', x: -16, z: -81, tier: 2, species: ['basalt', 'cinder', 'cinder', 'basalt', 'cinder', 'basalt'] },
  { id: 'kiln', zone: 'canyon', name: 'The Kilns', x: 15, z: -88, tier: 3, species: ['kiln', 'kiln', 'cinder', 'kiln', 'kiln', 'cinder'] },
  { id: 'spire', zone: 'ruins', name: 'Fallen Spire', x: 12, z: -111, tier: 0, species: ['wisp', 'wisp', 'wisp', 'wisp', 'wisp'] },
  { id: 'conduit', zone: 'ruins', name: 'Broken Conduit', x: -14, z: -118, tier: 1, species: ['thunder', 'conductor', 'conductor', 'thunder', 'conductor'] },
  { id: 'ring', zone: 'ruins', name: 'Thunder Ring', x: 16, z: -127, tier: 2, species: ['tempest', 'conductor', 'tempest', 'conductor', 'tempest', 'conductor'] },
  { id: 'crown', zone: 'ruins', name: 'Crown Terrace', x: -15, z: -135, tier: 3, species: ['tempest', 'tempest', 'crown', 'tempest', 'crown', 'tempest'] },
] as const satisfies readonly Camp[]

export const camps = campLayouts.map(camp => {
  const zone = zones.find(zone => zone.id === camp.zone)!
  const point = radialPoint(zone, [0, -10, 11, -9][camp.tier], [13, 27, 41, 54][camp.tier])
  return { ...camp, ...point }
})

export type CampId = typeof camps[number]['id']
export const campOffsets = [[0, -0.5], [-3.6, 0.8], [3.6, 0.8], [-2.7, -4.8], [2.7, -4.8], [0, 4.4]] as const
export const campColors = ['#d1ef9d', '#ffdc94', '#ffa877', '#ff8d91']

// Each biome has its own curve: onboarding, steady progression, then farming.
const economy = {
  valley: { health: [2, 18, 40, 80], damage: [3, 6, 10, 14], gold: [3, 6, 10, 16], xp: [4, 7, 10, 15] },
  canyon: { health: [130, 210, 330, 520], damage: [18, 23, 29, 37], gold: [35, 50, 75, 110], xp: [24, 32, 44, 60] },
  ruins: { health: [750, 1300, 2300, 4000], damage: [48, 65, 90, 120], gold: [190, 320, 550, 900], xp: [85, 120, 170, 240] },
}

export function campStats(camp: Camp) {
  const { tier } = camp
  const base = economy[camp.zone]
  return {
    health: base.health[tier],
    damage: base.damage[tier],
    gold: base.gold[tier],
    xp: base.xp[tier],
    respawnTime: 3 + tier * 0.4,
  }
}

export function campEnemy(camp: Camp, species: Species): EnemyDefinition {
  return { ...enemies[species], ...campStats(camp), detection: camp.tier === 0 ? 3.4 : 4.2 }
}
