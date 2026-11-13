import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { camps, campOffsets } from '../config/camps'
import { insideZone, radialPoint, sectorAngles, zonePoint, type Zone } from '../config/zones'
import type { SceneryShadows } from '../effects/SceneLook'

type Point = readonly [number, number, number]
type Layer = 'stone' | 'glow'
interface Feature { kind: string; x: number; z: number; reach: number }

/** Bake dressing into spatial cells: shared materials, no individual prop draw calls. */
class Dressing {
  readonly root = new T.Group()
  readonly features: Feature[] = []
  readonly colliders: { x: number; z: number; radius: number }[] = []
  private cells = new Map<string, { stone: T.BufferGeometry[]; glow: T.BufferGeometry[] }>()
  private origin = new T.Matrix4()
  private pose = new T.Object3D()
  private key = ''
  private point = new T.Vector3()

  constructor(private ground: string, private block: (x: number, z: number, radius: number) => void) {}

  begin(kind: string, x: number, z: number, yaw: number, reach: number) {
    this.features.push({ kind, x, z, reach })
    this.origin.makeRotationY(yaw).setPosition(x, 0, z)
    this.key = `${Math.floor(x / 18)},${Math.floor(z / 18)}`
    if (!this.cells.has(this.key)) this.cells.set(this.key, { stone: [], glow: [] })
  }

  add(geometry: T.BufferGeometry, color: string, position: Point, scale: Point = [1, 1, 1], rotation: Point = [0, 0, 0], layer: Layer = 'stone') {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry.clone()
    geometry.dispose();flat.deleteAttribute('uv')
    this.pose.position.fromArray(position);this.pose.scale.fromArray(scale);this.pose.rotation.set(...rotation);this.pose.updateMatrix()
    flat.applyMatrix4(this.pose.matrix).applyMatrix4(this.origin)
    const colors = new Float32Array(flat.getAttribute('position').count * 3), tint = new T.Color(color)
    for (let i = 0; i < colors.length; i += 3) tint.toArray(colors, i)
    flat.setAttribute('color', new T.BufferAttribute(colors, 3))
    this.cells.get(this.key)![layer].push(flat)
  }

  box(color: string, position: Point, scale: Point, yaw = 0, tilt = 0) {
    this.add(new T.BoxGeometry(1, 1, 1), color, position, scale, [0, yaw, tilt])
  }

  rock(color: string, position: Point, scale: Point) { this.add(new T.IcosahedronGeometry(1, 0), color, position, scale) }

  beam(a: Point, b: Point, radius: number, color: string, tip = .65) {
    const start = new T.Vector3(...a), end = new T.Vector3(...b), direction = end.clone().sub(start)
    const geometry = new T.CylinderGeometry(radius * tip, radius, direction.length(), 5)
    geometry.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize()))
    this.add(geometry, color, start.add(end).multiplyScalar(.5).toArray() as [number, number, number])
  }

  solid(x: number, z: number, radius: number) {
    this.point.set(x, 0, z).applyMatrix4(this.origin)
    this.colliders.push({ x: this.point.x, z: this.point.z, radius })
    this.block(this.point.x, this.point.z, radius)
  }

  patch(color: string, radius: number, aspect = .75) {
    const positions: number[] = [], colors: number[] = [], center = new T.Color(color), edge = new T.Color(this.ground)
    for (let i = 0; i < 14; i++) {
      for (const [j, r, tint] of [[0, 0, center], [i, radius * (1 + .12 * Math.sin(i * 4)), edge], [i + 1, radius * (1 + .12 * Math.sin((i + 1) * 4)), edge]] as const) {
        const a = j / 14 * Math.PI * 2
        positions.push(Math.sin(a) * r, .017, Math.cos(a) * r * aspect);colors.push(tint.r, tint.g, tint.b)
      }
    }
    const geometry = new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(positions, 3)).setAttribute('color', new T.Float32BufferAttribute(colors, 3))
    geometry.computeVertexNormals();geometry.applyMatrix4(this.origin)
    this.cells.get(this.key)!.stone.push(geometry)
  }

  finish(scene: T.Scene, zone: Zone) {
    const stone = new T.MeshStandardMaterial({ vertexColors: true, roughness: .97, flatShading: true, side: T.DoubleSide })
    const glow = new T.MeshBasicMaterial({ vertexColors: true })
    for (const [cell, layers] of this.cells) for (const layer of ['stone', 'glow'] as const) {
      const parts = layers[layer]
      if (!parts.length) continue
      const merged = mergeGeometries(parts)!
      parts.forEach(part => part.dispose());merged.computeBoundingSphere()
      const mesh = new T.Mesh(merged, layer === 'stone' ? stone : glow)
      mesh.name = `${zone.id}-dressing-${cell}-${layer}`;this.root.add(mesh)
    }
    this.root.name = `${zone.id}-dressing`
    this.root.userData.features = this.features
    this.root.userData.colliders = this.colliders
    scene.add(this.root)
  }
}

const bone = '#dfd1ab', oldBone = '#b4a383', charcoal = '#554342'

function skull(b: Dressing, x = 0, z = 2.1, size = 1) {
  b.rock(bone, [x, .47 * size, z], [.66 * size, .49 * size, .73 * size])
  b.rock('#cbbd99', [x, .26 * size, z + .6 * size], [.43 * size, .25 * size, .5 * size])
  for (const side of [-1, 1]) {
    b.rock('#453f39', [x + side * .29 * size, .71 * size, z + .26 * size], [.19 * size, .05 * size, .23 * size])
    b.beam([x + side * .48 * size, .65 * size, z - .2 * size], [x + side * .86 * size, 1.07 * size, z - .4 * size], .13 * size, oldBone)
    b.beam([x + side * .86 * size, 1.07 * size, z - .4 * size], [x + side * 1.02 * size, 1.23 * size, z - .7 * size], .085 * size, bone, .1)
  }
  b.rock('#51463c', [x, .43 * size, z + .88 * size], [.1 * size, .035 * size, .14 * size])
  for (const side of [-1, 0, 1]) b.add(new T.ConeGeometry(.06 * size, .16 * size, 4), bone, [x + side * .19 * size, .18 * size, z + .91 * size], [1, 1, 1], [Math.PI, 0, 0])
  b.solid(x, z, .48 * size)
}

function ribcage(b: Dressing) {
  b.patch('#8e6950', 3.5)
  for (let i = 0; i < 7; i++) {
    const z = -1.65 + i * .48
    b.rock(i % 2 ? oldBone : bone, [0, 1.11, z], [.21, .17, .26])
    if (i < 1 || i > 5) continue
    for (const side of [-1, 1]) {
      const width = 1.13 * Math.sin((i + 1) / 8 * Math.PI)
      const points: Point[] = [[0, 1.16, z], [side * width * .55, 1.35, z], [side * width, .96, z + .05], [side * width * 1.12, .42, z + .16], [side * width * .91, .16, z + .26]]
      for (let j = 1; j < points.length; j++) b.beam(points[j - 1], points[j], .075, j > 2 ? oldBone : bone, .85)
      b.solid(side * width, z + .1, .13)
    }
  }
  skull(b)
  b.beam([-.8, .16, -1.6], [-1.9, .13, -2.2], .12, oldBone)
  b.beam([.8, .16, -1.5], [1.65, .13, -2.3], .11, bone)
}

function boneScatter(b: Dressing, seed: number) {
  b.patch('#9d7759', 1.65)
  for (let i = 0; i < 3; i++) {
    const x = Math.sin(seed + i * 2.4) * .65, z = Math.cos(seed + i * 1.7) * .65
    b.beam([x - .4, .11, z], [x + .4, .13, z + .35], .075, bone, .9)
    b.rock(oldBone, [x - .42, .11, z], [.11, .12, .12]);b.rock(bone, [x + .42, .13, z + .35], [.12, .11, .11])
  }
}

function deadTree(b: Dressing, size: number, cold = false) {
  const bark = cold ? '#5e607b' : charcoal, cut = cold ? '#b1b8c9' : '#a47859'
  b.patch(cold ? '#655988' : '#805747', size * 1.6)
  b.beam([0, .02, 0], [.13, 1.45 * size, .03], .2 * size, bark, .7)
  b.beam([.13, 1.45 * size, .03], [-.1, 2.9 * size, -.1], .14 * size, bark, .3)
  for (const side of [-1, 1]) {
    b.beam([.07, 1.3 * size, 0], [side * .67 * size, 1.86 * size, -.04], .10 * size, bark, .6)
    b.beam([side * .67 * size, 1.86 * size, -.04], [side * 1.05 * size, 2.5 * size, .15], .06 * size, cut, .1)
    b.beam([side * .67 * size, 1.86 * size, -.04], [side * 1.12 * size, 1.9 * size, -.36], .05 * size, bark, .1)
  }
  for (let i = 0; i < 4; i++) b.beam([0, .26, 0], [Math.sin(i * 1.7) * .65, .04, Math.cos(i * 1.7) * .65], .09, bark)
  b.solid(0, 0, .22 * size)
}

function foliage(b: Dressing, seed: number, cold: boolean, dry = false) {
  const color = cold ? ['#91b6bd', '#788da7', '#a7a1c4'][seed % 3] : dry ? '#c4a277' : ['#77835b', '#87915f', '#9e9463'][seed % 3]
  for (let i = 0; i < 6; i++) {
    const angle = i * 2.399 + seed, height = (dry ? .44 : .34) + (i % 3) * .12
    const dir = new T.Vector3(Math.sin(angle), 0, Math.cos(angle)), side = new T.Vector3(Math.cos(angle), 0, -Math.sin(angle))
    const tip = dir.clone().multiplyScalar(dry ? .22 : .52).setY(dry ? height : height * .62)
    const mid = dir.clone().multiplyScalar(.19).setY(height)
    const a = mid.clone().addScaledVector(side, dry ? .025 : .075), c = mid.clone().addScaledVector(side, dry ? -.025 : -.075)
    const geometry = new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute([0, .04, 0, ...a.toArray(), ...tip.toArray(), 0, .04, 0, ...tip.toArray(), ...c.toArray()], 3))
    geometry.computeVertexNormals();b.add(geometry, color, [0, 0, 0])
  }
}

function crystalBed(b: Dressing, seed: number) {
  b.patch('#655789', 1.6)
  b.rock('#74718d', [0, .18, 0], [.8, .2, .65])
  for (let i = 0; i < 5; i++) {
    const a = i * 2.4 + seed, height = .45 + (i % 3) * .23
    b.add(new T.OctahedronGeometry(1), i % 2 ? '#91bacd' : '#8b93c0', [Math.sin(a) * .4, height * .65, Math.cos(a) * .4], [.16, height, .18], [.15, a, .2])
  }
  b.solid(0, 0, .42)
}

function lightningScar(b: Dressing) {
  b.patch('#59506f', 1.3)
  const points: Point[] = [[-.25, .035, -1.0], [.08, .035, -.6], [-.10, .035, -.15], [.25, .035, .3], [.06, .035, .95]]
  for (let i = 1; i < points.length; i++) b.beam(points[i - 1], points[i], .035, '#48415e', .8)
  b.beam([-.10, .035, -.15], [-.75, .035, .18], .025, '#48415e')
  b.beam([.25, .035, .3], [.83, .035, .55], .022, '#48415e')
  for (const side of [-1, 1]) b.rock('#9295ae', [side * .32, .055, side * .24], [.11, .065, .13])
}

function obelisk(b: Dressing, x: number, z: number, height: number) {
  b.box('#888298', [x, .16, z], [1.05, .32, 1.05])
  b.add(new T.CylinderGeometry(.32, .43, height, 5), '#62617d', [x, height / 2 + .3, z], [1, 1, 1], [.04, .3, .08])
  b.rock('#aaa3ba', [x + .08, height + .24, z], [.48, .19, .4])
  b.add(new T.BoxGeometry(.065, height * .42, .028), '#92b7cb', [x, height * .6, z + .40], [1, 1, 1], [0, 0, -.08], 'glow')
  b.solid(x, z, .47)
}

function observatory(b: Dressing) {
  b.patch('#61577c', 3.5)
  b.box('#8d849d', [0, .12, 0], [3.0, .24, 2.5], .08)
  b.box('#6c657f', [0, .35, 0], [1.65, .3, 1.5], -.08)
  for (const side of [-1, 1]) obelisk(b, side * 1.55, 0, side > 0 ? 1.35 : 1.9)
  b.add(new T.TorusGeometry(1.42, .095, 5, 24, Math.PI * 1.68), '#8a98a7', [0, 1.76, 0], [1, 1, 1], [.35, .3, .25])
  b.add(new T.TorusGeometry(1.11, .075, 5, 22, Math.PI * 1.8), '#6d8299', [0, 1.76, 0], [1, 1, 1], [.7, 1.45, -.3])
  b.add(new T.OctahedronGeometry(1), '#a5cdd9', [0, 1.75, 0], [.28, .56, .28])
  b.add(new T.OctahedronGeometry(1), '#bedfe3', [0, 1.75, 0], [.13, .31, .13], [0, 0, 0], 'glow')
  b.box('#a097ac', [1.65, .17, 1.8], [1.1, .28, .72], .7)
  b.solid(0, 0, .83)
}

function brokenArch(b: Dressing) {
  b.patch('#696080', 3)
  for (const side of [-1, 1]) {
    b.box('#93879f', [side * 1.4, .2, 0], [.95, .4, 1.0], side * .1)
    b.box('#71657f', [side * 1.4, 1.04, 0], [.64, 1.4, .7], 0, side * -.08)
    for (let i = 0; i < 3; i++) {
      const a = side * (.35 + i * .32)
      b.box(i % 2 ? '#a196ad' : '#82778f', [Math.sin(a) * 1.65, 1.45 + Math.cos(a) * 1.45, 0], [.62, .53, .8], 0, -a)
    }
    b.solid(side * 1.4, 0, .48)
  }
  b.box('#8d8198', [.45, .18, 1.5], [.85, .36, .75], .6, .1)
  b.box('#aaa0b6', [-1.1, .12, 1.9], [.7, .24, .65], -.5)
}

function shatteredConduit(b: Dressing) {
  b.patch('#62547e', 3.0)
  obelisk(b, -1.25, -.8, 2.2);obelisk(b, 1.1, .9, .85)
  for (let i = 0; i < 6; i++) {
    const z = -2 + i * .75, x = Math.sin(i * 1.5) * .2
    b.box(i % 2 ? '#93899f' : '#7c718e', [x, .055, z], [1.0, .11, .6], .08 * Math.sin(i))
    if (i !== 3) b.add(new T.BoxGeometry(.07, .012, .4), '#89aabf', [x, .12, z], [1, 1, 1], [0, .1, 0], 'glow')
  }
  b.add(new T.CylinderGeometry(.24, .3, 2.2, 6), '#766a87', [1.8, .3, -1.1], [1, 1, 1], [0, .6, Math.PI / 2])
}

function segmentDistance(x: number, z: number, a: { x: number; z: number }, b: { x: number; z: number }) {
  const dx = b.x - a.x, dz = b.z - a.z
  const t = T.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / Math.max(.001, dx * dx + dz * dz), 0, 1)
  return Math.hypot(x - a.x - dx * t, z - a.z - dz * t)
}

export function biomeDressing(scene: T.Scene, zone: Zone, shadows: Pick<SceneryShadows, 'cast'>,
  blocked: (x: number, z: number, radius: number) => boolean, block: (x: number, z: number, radius: number) => void) {
  if (zone.id === 'valley') return
  const cold = zone.id === 'ruins', b = new Dressing(cold ? '#716096' : '#b37555', block)
  const boss = zonePoint(zone, 0, zone.arena), localCamps = camps.filter(c => c.zone === zone.id)
  const route = [radialPoint(zone, 0, 10), ...localCamps, boss]
  const occupied: { x: number; z: number; radius: number }[] = []
  const allowed = (x: number, z: number, reach: number, solid: boolean) => {
    if (!insideZone(x, z, zone, reach + 1.4) || Math.hypot(x, z) < 16 + reach || Math.hypot(x - boss.x, z - boss.z) < 9 + reach) return false
    if (localCamps.some(c => Math.hypot(x - c.x, z - c.z) < 6.7 + reach)) return false
    if (localCamps.some(c => campOffsets.slice(0, c.species.length).some(([dx, dz]) => Math.hypot(x - c.x - dx, z - c.z - dz) < reach + 1.5))) return false
    if (route.slice(1).some((p, i) => segmentDistance(x, z, route[i], p) < reach + (solid ? 1.7 : .65))) return false
    return !blocked(x, z, reach) && !occupied.some(p => Math.hypot(x - p.x, z - p.z) < reach + p.radius + .35)
  }
  const place = (kind: string, p: { x: number; z: number }, reach: number, yaw: number, draw: () => void, solid = true) => {
    b.begin(kind, p.x, p.z, yaw, reach);draw()
    occupied.push({ ...p, radius: reach * .75 })
    if (solid) shadows.cast(p.x, p.z, reach * .8, kind === 'dead-tree' ? 2.6 : 1.6)
  }
  // Authored focal points, prioritizing locations visible from the travel routes.
  const candidates: [number, number][] = [[9, 21], [-9, 19], [17, 28], [-22, 34], [0, 36], [23, 43], [-19, 46], [14, 55], [-25, 54], [25, 25], [-18, 22], [23, 35], [-5, 45], [1, 24], [20, 53]]
  for (let depth = 20; depth <= 55; depth += 7) for (const side of [-25, -17, -8, 7, 17, 25]) candidates.push([side, depth])
  let major = 0
  for (const [side, depth] of candidates) {
    if (major >= 6) break
    const p = radialPoint(zone, side, depth), reach = cold ? 3.0 : 3.2
    if (!allowed(p.x, p.z, reach, true)) continue
    const kind = cold ? ['observatory', 'broken-arch', 'shattered-conduit'][major % 3] : major % 2 === 0 ? 'ribcage' : 'horned-skull'
    place(kind, p, reach, zone.angle + major * .63, () => {
      if (cold) [observatory, brokenArch, shatteredConduit][major % 3](b)
      else if (major % 2 === 0) ribcage(b)
      else { b.patch('#94745b', 3.2);skull(b, -.2, .1, 1.5);b.beam([1, .16, 1.2], [2.3, .12, 1.7], .14, bone) }
    })
    major++
  }
  const [start, end] = sectorAngles(zone)
  let medium = 0
  for (let i = 0; i < 240; i++) {
    if (medium >= 40) break
    const angle = start + .04 + ((i * 137 + 41) % 997) / 997 * (end - start - .08)
    const radius = 18 + ((i * 263 + 17) % 991) / 991 * 46
    const p = { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius }
    const tree = i % 3 === 0, scar = cold && !tree && i % 5 === 0, reach = tree ? 1.35 : 1.15
    const solid = tree || cold && !scar
    if (!allowed(p.x, p.z, reach, solid)) continue
    const kind = tree ? 'dead-tree' : scar ? 'lightning-scar' : cold ? 'crystal-bed' : 'bone-scatter'
    place(kind, p, reach, i * 1.39, () => {
      if (tree) deadTree(b, .75 + i % 4 * .12, cold)
      else if (scar) lightningScar(b)
      else if (cold) crystalBed(b, i)
      else boneScatter(b, i)
    }, solid)
    medium++
  }
  let plants = 0
  for (let i = 0; i < 540; i++) {
    const angle = start + ((i * 193 + 11) % 1009) / 1009 * (end - start)
    const radius = 16 + ((i * 157 + 53) % 1013) / 1013 * 49
    const p = { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius }
    if (!allowed(p.x, p.z, .38, false)) continue
    place(cold ? 'frost-reeds' : i % 3 ? 'dry-grass' : 'ash-agave', p, .38, i * .71,
      () => foliage(b, i, cold, !cold && i % 3 !== 0), false)
    plants++
    if (plants >= 150) break
  }
  b.finish(scene, zone)
}
