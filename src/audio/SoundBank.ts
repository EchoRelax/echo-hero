export type Sound = 'swing' | 'hit' | 'kill' | 'hurt' | 'gold' | 'xp' | 'level' | 'buy' | 'equip' | 'click' | 'warning' | 'victory' | 'death' | 'root' | 'fire' | 'lightning' | 'step'
interface Cue { label: string; files: string[]; gain: number; spacing: number; limit: number }
export const soundCues: Record<Sound, Cue> = {
  swing: { label: 'Sword swing', files: ['swing-a'], gain: 0.65, spacing: 0.12, limit: 2 },
  hit: { label: 'Sword impact', files: ['hit'], gain: 0.95, spacing: 0.07, limit: 3 },
  kill: { label: 'Enemy defeated', files: ['kill'], gain: 0.85, spacing: 0.1, limit: 2 },
  hurt: { label: 'Hero hurt', files: [], gain: 0.8, spacing: 0.22, limit: 2 },
  gold: { label: 'Gold pickup', files: ['gold'], gain: 0.6, spacing: 0.13, limit: 2 },
  xp: { label: 'XP pickup', files: ['exp'], gain: 0.32, spacing: 0.16, limit: 2 },
  level: { label: 'Level up', files: ['levelup'], gain: 0.7, spacing: 0.6, limit: 1 },
  buy: { label: 'Upgrade purchased', files: ['buy'], gain: 0.65, spacing: 0.13, limit: 2 },
  equip: { label: 'Rune equipped', files: ['equip'], gain: 0.55, spacing: 0.15, limit: 1 },
  click: { label: 'Button click', files: ['click'], gain: 0.25, spacing: 0.07, limit: 2 },
  warning: { label: 'Boss warning', files: [], gain: 0.7, spacing: 0.45, limit: 1 },
  victory: { label: 'Boss victory', files: ['victoryboss'], gain: 0.75, spacing: 1, limit: 1 },
  death: { label: 'Hero defeated', files: [], gain: 0.65, spacing: 0.6, limit: 1 },
  root: { label: 'Root rune', files: ['root-1', 'root-2'], gain: 0.65, spacing: 0.2, limit: 2 },
  fire: { label: 'Fire rune', files: ['fire'], gain: 0.65, spacing: 0.3, limit: 2 },
  lightning: { label: 'Lightning rune', files: ['lightning'], gain: 0.6, spacing: 0.2, limit: 2 },
  step: { label: 'Grass footsteps', files: ['step-1', 'step-2', 'step-3'], gain: 0.15, spacing: 0.32, limit: 2 },
}
