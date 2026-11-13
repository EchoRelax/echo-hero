import type { BossId } from './bosses'

export const zones = [
  { id: 'valley', name: 'Green Valley', angle: Math.PI, boundary: 12, checkpoint: 3, arena: -42, boss: 'rootGuardian' },
  { id: 'canyon', name: 'Ash Canyon', angle: -Math.PI / 2, boundary: -56, checkpoint: -59, arena: -110, boss: 'ashGolem' },
  { id: 'ruins', name: 'Storm Ruins', angle: Math.PI / 3, boundary: -102, checkpoint: -105, arena: -156, boss: 'stormLord' },
] as const satisfies readonly { id: string; name: string; angle: number; boundary: number; checkpoint: number; arena: number; boss: BossId }[]

export type ZoneId = typeof zones[number]['id']
export type Zone = typeof zones[number]
export const worldHalfWidth = 28
export const worldNorth = -151

// All three lobes join the shared clearing. Depth increases away from home.
export function radialPoint(zone: Zone, side: number, depth: number) {
  return { x: side * Math.cos(zone.angle) - depth * Math.sin(zone.angle), z: -side * Math.sin(zone.angle) - depth * Math.cos(zone.angle) }
}

export function zonePoint(zone: Zone, x: number, legacyZ: number) {
  return radialPoint(zone, x, 8 + zone.boundary - legacyZ)
}

// Shared sector edges create one continuous landmass around the hub.
export function sectorAngles(zone: Zone): [number, number] {
  return zone.id === 'valley' ? [Math.PI / 4, Math.PI * 5 / 6]
    : zone.id === 'canyon' ? [-Math.PI * 5 / 12, Math.PI / 4]
    : [Math.PI * 5 / 6, Math.PI * 19 / 12]
}

const outlineCache = new Map<string, { x: number; z: number }[]>()

export function zoneOutline(zone: Zone): { x: number; z: number }[] {
  const cached = outlineCache.get(zone.id)
  if (cached) return cached
  const [start, end] = sectorAngles(zone)
  const count = 15
  const outline = [{ x: 0, z: 0 }, ...Array.from({ length: count + 1 }, (_, i) => {
    const angle = start + (end - start) * i / count
    const radius = 70 + Math.sin(angle * 3) * 2.4 + Math.cos(angle * 5) * 1.6
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius }
  })]
  outlineCache.set(zone.id, outline)
  return outline
}

export function insideZone(x: number, z: number, zone: Zone, margin = 0): boolean {
  const outline = zoneOutline(zone)
  let inside = false
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i], b = outline[j]
    if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) inside = !inside
  }
  if (!inside || margin === 0) return inside
  return [[margin, 0], [-margin, 0], [0, margin], [0, -margin]].every(([dx, dz]) => insideZone(x + dx, z + dz, zone))
}

export function zoneAt(x: number, z: number): Zone {
  if (Math.hypot(x, z) < 10) return zones[0]
  return zones.find(zone => insideZone(x, z, zone)) ?? zones.reduce((best, zone) => {
    const projection = -x * Math.sin(zone.angle) - z * Math.cos(zone.angle)
    const previous = -x * Math.sin(best.angle) - z * Math.cos(best.angle)
    return projection > previous ? zone : best
  }, zones[0] as Zone)
}
