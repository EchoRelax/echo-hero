import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { Zone } from '../config/zones'
import type { SceneryShadows } from '../effects/SceneLook'

type Point = readonly [number, number, number]
type Block = (x: number, z: number, radius: number) => void

// Bake vertex colors and transforms once. Each arena is at most two draw calls.
class ArenaBuilder {
  private solid: T.BufferGeometry[] = []
  private accents: T.BufferGeometry[] = []
  constructor(private scene: T.Scene, private zone: Zone) {}

  add(geometry: T.BufferGeometry, color: string, position: Point, scale: Point = [1, 1, 1], yaw = 0, accent = false) {
    const mesh = geometry.index ? geometry.toNonIndexed() : geometry.clone()
    geometry.dispose()
    mesh.deleteAttribute('uv')
    mesh.scale(...scale).rotateY(yaw).translate(position[0], position[1], position[2])
    const tint = new T.Color(color)
    const colors = new Float32Array(mesh.getAttribute('position').count * 3)
    for (let i = 0; i < colors.length; i += 3) tint.toArray(colors, i)
    mesh.setAttribute('color', new T.BufferAttribute(colors, 3))
    ;(accent ? this.accents : this.solid).push(mesh)
  }

  box(color: string, position: Point, scale: Point, yaw = 0, accent = false) {
    this.add(new T.BoxGeometry(1, 1, 1), color, position, scale, yaw, accent)
  }

  branch(a: Point, b: Point, start: number, end: number, color: string) {
    const direction = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    const geometry = new T.CylinderGeometry(end, start, direction.length(), 5)
    geometry.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize()))
    this.add(geometry, color, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2])
  }

  finish() {
    for (const [index, parts] of [this.solid, this.accents].entries()) {
      if (!parts.length) continue
      const geometry = mergeGeometries(parts)!
      parts.forEach(part => part.dispose())
      const material = index === 0
        ? new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.94 })
        : new T.MeshBasicMaterial({ vertexColors: true })
      const mesh = new T.Mesh(geometry, material)
      mesh.name = `${this.zone.boss}-${index ? 'insets' : 'architecture'}`
      mesh.position.z = this.zone.arena
      this.scene.add(mesh)
    }
  }
}

function grove(a: ArenaBuilder, landmark: (x: number, z: number, radius: number, height: number) => void) {
  // An open glade, framed asymmetrically by ancient stumps, not a circular floor.
  for (const [i, [x, z, height]] of [[-6.1, -1.8, 2.2], [5.8, -3.2, 1.7], [-3.1, -6.0, 1.3]].entries()) {
    a.add(new T.CylinderGeometry(0.66, 1.05, height, 7), '#73513b', [x, height / 2 - 0.08, z])
    a.add(new T.CylinderGeometry(0.58, 0.58, 0.055, 7), '#bf9661', [x, height - 0.055, z])
    a.add(new T.CylinderGeometry(0.27, 0.31, 0.06, 6), '#8d6847', [x, height - 0.02, z])
    landmark(x, z, 0.94, height)
    for (let root = 0; root < 5; root++) {
      const angle = root * 1.19 + i * 0.8
      const mid: Point = [x + Math.cos(angle) * 1.0, 0.18, z + Math.sin(angle) * 1.0]
      const tip: Point = [x + Math.cos(angle + 0.3) * 2.05, 0.035, z + Math.sin(angle + 0.3) * 2.05]
      // Keep the main dodge space free of raised roots.
      if (Math.hypot(tip[0], tip[2]) < 4.7) continue
      a.branch([x, 0.58, z], mid, 0.36, 0.19, '#79583d')
      a.branch(mid, tip, 0.19, 0.025, '#8e6a47')
      a.branch(mid, [tip[0] + Math.sin(angle) * 0.6, 0.025, tip[2] - Math.cos(angle) * 0.6], 0.10, 0.012, '#79583d')
    }
    a.branch([x, height * 0.5, z], [x + 0.7, height + 0.36, z - 0.2], 0.23, 0.08, '#73513b')
    a.add(new T.IcosahedronGeometry(1, 1), '#6b994e', [x - 0.33, 0.26, z + 0.57], [0.8, 0.23, 0.67])
  }
  for (let i = 0; i < 17; i++) {
    const angle = 0.25 + i * 2.399
    const radius = 5.4 + (i % 3) * 0.52
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius
    if (Math.abs(x) < 2.1) continue // Open north/south approaches.
    a.add(new T.DodecahedronGeometry(1), i % 2 ? '#719368' : '#9ca281', [x, 0.14, z], [0.38, 0.22, 0.28], angle)
    a.branch([x + 0.35, 0, z], [x + 0.35, 0.31, z], 0.045, 0.035, '#dfc894')
    a.add(new T.SphereGeometry(0.19, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), i % 2 ? '#dcab69' : '#bd7962', [x + 0.35, 0.3, z], [1, 0.65, 1])
  }
}

// Warp both sides of each seam in the same world-space field. This gives the
// rock fracture an irregular silhouette while preserving gaps between plates.
function basaltPlate(radius: number, bottom: number, height: number, x: number, z: number) {
  const geometry = new T.CylinderGeometry(radius, bottom, height, 6)
  const positions = geometry.getAttribute('position')
  for (let i = 0; i < positions.count; i++) {
    const px = positions.getX(i), pz = positions.getZ(i)
    positions.setX(i, px + Math.sin((px + x) * 1.9 + (pz + z) * 0.7) * 0.15)
    positions.setZ(i, pz + Math.cos((pz + z) * 1.6 - (px + x) * 0.8) * 0.13)
  }
  geometry.computeVertexNormals()
  return geometry
}

function caldera(a: ArenaBuilder, landmark: (x: number, z: number, radius: number, height: number) => void) {
  // Separated solid hexagonal plates create real crisp seams. Floor tops remain
  // below contact shadows (y=.012) and combat telegraphs; no elevated gameplay floor.
  for (let row = -4; row <= 4; row++) {
    for (let col = -4; col <= 4; col++) {
      const x = (col + (Math.abs(row) % 2) * 0.5) * 1.42
      const z = row * 1.23
      if (Math.hypot(x, z) > 5.65) continue
      const seed = Math.abs(row * 17 + col * 31)
      const radius = 0.78 + (seed % 4) * 0.009
      a.add(basaltPlate(radius + 0.043, radius + 0.043, 0.045, x, z), '#674746', [x, -0.021, z])
      a.add(basaltPlate(radius, radius + 0.025, 0.08, x, z), ['#88716b', '#96786a', '#a18470', '#7f6864'][seed % 4], [x, -0.034, z])
    }
  }
  // Basalt chimneys have different profiles, with cooled crust and exposed embers.
  for (const [i, [x, z]] of [[-6.1, -1.4], [5.9, -2.9], [-3.9, -5.5], [4.9, 3.5]].entries()) {
    const height = 1.5 + (i % 3) * 0.43
    for (let j = 0; j < 3; j++) {
      const dx = (j - 1) * 0.42, h = height * (j === 1 ? 1 : 0.59)
      a.add(new T.CylinderGeometry(0.32, 0.49, h, 5), j === 1 ? '#51454b' : '#68534f', [x + dx, h / 2, z + j * 0.15])
      a.add(new T.CylinderGeometry(0.24, 0.25, 0.06, 5), '#b77755', [x + dx, h + 0.015, z + j * 0.15])
      a.box('#d59560', [x + dx, h * 0.68, z + j * 0.15 + 0.32], [0.07, h * 0.23, 0.035], 0, true)
    }
    landmark(x, z + 0.15, 0.94, height)
  }
  for (let i = 0; i < 15; i++) {
    const angle = i * 2.399, r = 6.1 + (i % 3) * 0.25
    const x = Math.cos(angle) * r, z = Math.sin(angle) * r
    if (Math.abs(x) < 2) continue
    a.add(new T.DodecahedronGeometry(1), i % 2 ? '#69524e' : '#bd8762', [x, 0.12, z], [0.34, 0.18, 0.26], angle)
  }
}

function sanctum(a: ArenaBuilder, landmark: (x: number, z: number, radius: number, height: number) => void) {
  // A broken rectangular temple mosaic, distinct from the organic glade and caldera.
  for (let row = -3; row <= 3; row++) {
    for (let col = -3; col <= 3; col++) {
      if (Math.abs(row) + Math.abs(col) > 5 || (row === 3 && col === -2)) continue
      const seed = Math.abs(row * 13 + col * 7)
      a.box(['#9c94b1', '#aaa0bb', '#89849f'][seed % 3], [col * 1.46, -0.05, row * 1.46], [1.40, 0.112, 1.40])
    }
  }
  // Raised metal glyphs on perimeter stones, each assembled from short solid bars.
  for (const side of [-1, 1]) {
    for (const z of [-2.92, 0, 2.92]) {
      const x = side * 4.38
      a.box('#5e637f', [x, 0.009, z], [0.11, 0.006, 0.78])
      a.box('#c0d5df', [x - 0.19, 0.014, z - 0.19], [0.48, 0.008, 0.10], -0.65, true)
      a.box('#c0d5df', [x + 0.19, 0.014, z + 0.19], [0.48, 0.008, 0.10], -0.65, true)
    }
  }
  for (const [i, [x, z]] of [[-5.8, -3.7], [5.8, -3.7], [-5.9, 2.6], [5.9, 2.6]].entries()) {
    const h = i < 2 ? 2.45 : 0.85
    a.box('#625b7b', [x, 0.14, z], [1.18, 0.28, 1.18], Math.PI / 4)
    a.add(new T.CylinderGeometry(0.39, 0.49, h, 4), '#8b809e', [x, h / 2 + 0.18, z], [1, 1, 1], Math.PI / 4)
    a.box('#b1a3be', [x, h + 0.20, z], [0.89, 0.19, 0.89])
    a.add(new T.OctahedronGeometry(1), '#a1cedb', [x, h + 0.68, z], [0.27, 0.61, 0.27], 0.3, true)
    landmark(x, z, 0.67, h + 0.65)
  }
  // Fallen fragments at the sides, away from both entrances and the fighting space.
  for (const side of [-1, 1]) {
    a.box('#776d8c', [side * 6.65, 0.30, 0.2], [0.65, 0.6, 1.9], side * 0.38)
    landmark(side * 6.65, 0.2, 0.77, 0.7)
    for (let i = 0; i < 4; i++) {
      a.add(new T.OctahedronGeometry(1), i % 2 ? '#809ab8' : '#b39aca', [side * (5.5 + i * 0.22), 0.2 + i * 0.07, -5.1 + i * 0.29], [0.18, 0.35 + i * 0.09, 0.2], i)
    }
  }
}

export function buildArena(scene: T.Scene, zone: Zone, shadows: Pick<SceneryShadows, 'cast'>, block: Block) {
  const builder = new ArenaBuilder(scene, zone)
  const landmark = (x: number, z: number, radius: number, height: number) => {
    block(x, zone.arena + z, radius)
    shadows.cast(x, zone.arena + z, radius, height)
  }
  if (zone.id === 'valley') grove(builder, landmark)
  else if (zone.id === 'canyon') caldera(builder, landmark)
  else sanctum(builder, landmark)
  builder.finish()
}
