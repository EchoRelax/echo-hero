import * as T from 'three'
import type { BossId } from '../config/bosses'
import { camps } from '../config/camps'
import { zones, zonePoint, insideZone, zoneOutline, sectorAngles, type Zone } from '../config/zones'
import { SceneryShadows } from '../effects/SceneLook'
import { buildArena } from './ArenaArt'
import { stylizedTrees } from './StylizedTrees'
import { biomeLandmarks } from './BiomeLandmarks'
import { boundaryRocks, type RockBoundary } from './BoundaryRocks'
import { buildCampArt } from './CampArt'
import { biomeDressing } from './BiomeDressing'

export const heroStart = new T.Vector3(0, 0, 8)
const palettes = [
  { ground: '#81ac55', rim: '#668067', rock: '#8b9277', accent: '#afd080' },
  { ground: '#b37555', rim: '#83504a', rock: '#a26b59', accent: '#edb077' },
  { ground: '#716096', rim: '#59496f', rock: '#93809f', accent: '#b3a7db' },
]
const atmospheres = [
  ['#83bdd1', '#b5d5b3', '#fff0c9', '#7193a8'],
  ['#b78e82', '#e3bf9c', '#ffdda1', '#8b6584'],
  ['#716baa', '#aaa0ce', '#e0e5ff', '#69578c'],
].map(row => row.map(color => new T.Color(color)))
interface Obstacle { x: number; z: number; radius: number }

export class World {
  readonly scene = new T.Scene()
  private backdrop = atmospheres[0][0].clone()
  private fog = new T.FogExp2(atmospheres[0][1], .010)
  private sky = new T.HemisphereLight('#f7fff0', atmospheres[0][3], 1.74)
  private sun = new T.DirectionalLight(atmospheres[0][2], 2.23)
  private shadows = new SceneryShadows()
  private obstacles: Obstacle[] = []
  private boundaries: RockBoundary[] = []

  constructor() {
    this.scene.background = this.backdrop
    this.scene.fog = this.fog
    this.sun.position.set(-12, 16, -8)
    this.scene.add(this.sky, this.sun)
    const water = new T.Mesh(new T.PlaneGeometry(210, 210), new T.MeshStandardMaterial({ color: '#548f9a', roughness: .95 }))
    water.rotation.x = -Math.PI / 2
    water.position.y = -.45
    this.scene.add(water)
    this.boundaries = boundaryRocks(this.scene)
    for (const zone of zones) this.biome(zone)
    const hub = new T.Mesh(new T.CylinderGeometry(10.5, 10.8, .3, 48), new T.MeshStandardMaterial({ color: '#b5bc75', roughness: 1, flatShading: true }))
    hub.position.y = -.13
    this.scene.add(hub)
    buildCampArt(this.scene, this.shadows, (x, z, radius) => this.addObstacle(x, z, radius))
    this.shadows.addTo(this.scene)
  }

  animate(_dt: number) {}
  setDefeated(_defeated: ReadonlySet<BossId>) {}

  updateAtmosphere(zone: Zone, dt: number) {
    const [backdrop, fog, sun, shade] = atmospheres[zones.indexOf(zone)]
    const blend = 1 - Math.exp(-3.5 * dt)
    this.backdrop.lerp(backdrop, blend)
    this.fog.color.lerp(fog, blend)
    this.sun.color.lerp(sun, blend)
    this.sky.groundColor.lerp(shade, blend)
  }

  addObstacle(x: number, z: number, radius: number) {
    const obstacle = { x, z, radius }
    this.obstacles.push(obstacle)
    return () => { this.obstacles = this.obstacles.filter(item => item !== obstacle) }
  }

  private playable(x: number, z: number, radius: number, zone?: Zone) {
    if (zone) return insideZone(x, z, zone, radius)
    // Check the union, including the broad, always open entrances to the hub.
    return [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius]].every(([dx, dz]) =>
      Math.hypot(x + dx, z + dz) < 10.5 || zones.some(item => insideZone(x + dx, z + dz, item)))
  }

  private blocked(x: number, z: number, radius: number) {
    return this.obstacles.some(o => (x - o.x) ** 2 + (z - o.z) ** 2 < (radius + o.radius) ** 2) || this.boundaries.some(edge => {
      const dx = edge.b.x - edge.a.x, dz = edge.b.z - edge.a.z
      const t = T.MathUtils.clamp(((x - edge.a.x) * dx + (z - edge.a.z) * dz) / (dx * dx + dz * dz), 0, 1)
      return (x - edge.a.x - dx * t) ** 2 + (z - edge.a.z - dz * t) ** 2 < (radius + edge.radius) ** 2
    })
  }

  move(position: T.Vector3, dx: number, dz: number, radius: number, zone?: Zone) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .25))
    for (let i = 0; i < steps; i++) {
      const x = position.x + dx / steps
      if (this.playable(x, position.z, radius, zone) && !this.blocked(x, position.z, radius)) position.x = x
      const z = position.z + dz / steps
      if (this.playable(position.x, z, radius, zone) && !this.blocked(position.x, z, radius)) position.z = z
    }
  }

  private biome(zone: Zone) {
    const index = zones.indexOf(zone), palette = palettes[index]
    const points = zoneOutline(zone)
    const shape = new T.Shape(points.map(p => new T.Vector2(p.x, -p.z)))
    const coarse = new T.ShapeGeometry(shape).rotateX(-Math.PI / 2).toNonIndexed()
    const source = coarse.getAttribute('position'), triangles: number[] = []
    const subdivide = (a: T.Vector3, b: T.Vector3, c: T.Vector3, level: number) => {
      if (level < 5 && Math.max(a.distanceToSquared(b), b.distanceToSquared(c), c.distanceToSquared(a)) > 36) {
        const ab = a.clone().add(b).multiplyScalar(.5), bc = b.clone().add(c).multiplyScalar(.5), ca = c.clone().add(a).multiplyScalar(.5)
        subdivide(a, ab, ca, level + 1);subdivide(ab, b, bc, level + 1)
        subdivide(ca, bc, c, level + 1);subdivide(ab, bc, ca, level + 1)
      } else for (const v of [a, b, c]) triangles.push(v.x, v.y, v.z)
    }
    for (let i = 0; i < source.count; i += 3) subdivide(new T.Vector3().fromBufferAttribute(source, i), new T.Vector3().fromBufferAttribute(source, i + 1), new T.Vector3().fromBufferAttribute(source, i + 2), 0)
    coarse.dispose()
    const ground = new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(triangles, 3))
    ground.computeVertexNormals()
    const positions = ground.getAttribute('position')
    const colors = new Float32Array(positions.count * 3)
    for (let i = 0; i < positions.count; i += 3) {
      const color = new T.Color(palette.ground).multiplyScalar(.97 + Math.sin(i * 17.3) * .045)
      for (let j = 0; j < 3; j++) color.toArray(colors, (i + j) * 3)
    }
    ground.setAttribute('color', new T.BufferAttribute(colors, 3))
    this.scene.add(new T.Mesh(ground, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: T.DoubleSide })))

    const transform = new T.Object3D()

    // Arena art retains its own local coordinates, then moves with the biome.
    const local = new T.Scene()
    buildArena(local, zone, { cast: (x, z, width, height) => {
      const p = zonePoint(zone, x, z);this.shadows.cast(p.x, p.z, width, height)
    } }, (x, z, radius) => { const p = zonePoint(zone, x, z);this.addObstacle(p.x, p.z, radius) })
    const arena = new T.Group()
    arena.add(...local.children.slice())
    const origin = zonePoint(zone, 0, 0)
    arena.position.set(origin.x, 0, origin.z)
    arena.rotation.y = zone.angle
    this.scene.add(arena)
    biomeLandmarks(this.scene, zone, (x, z, radius) => this.addObstacle(x, z, radius))
    biomeDressing(this.scene, zone, this.shadows, (x, z, radius) => this.blocked(x, z, radius), (x, z, radius) => { this.addObstacle(x, z, radius) })

    const localCamps = camps.filter(camp => camp.zone === zone.id)
    const boss = zonePoint(zone, 0, zone.arena)
    const decorative = (x: number, z: number, reach: number) => insideZone(x, z, zone, reach + 1.3) && Math.hypot(x, z) > 16 &&
      Math.hypot(x - boss.x, z - boss.z) > 8 && !localCamps.some(c => Math.hypot(x - c.x, z - c.z) < 6.7) && !this.blocked(x, z, reach)
    const trees: { x: number; z: number; scale: number; angle: number }[] = []
    const stones: { x: number; z: number; scale: number }[] = []
    for (let i = 0; i < 220; i++) {
      const [start, end] = sectorAngles(zone)
      const angle = start + .03 + (i * 137 % 997) / 997 * (end - start - .06)
      const radius = 17 + (i * 263 % 991) / 991 * 49
      const p = { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius }
      const side = p.x * Math.cos(zone.angle) - p.z * Math.sin(zone.angle)
      const depth = -p.x * Math.sin(zone.angle) - p.z * Math.cos(zone.angle)
      // Leave a winding route through the camps and along the central axis.
      if (Math.abs(side - Math.sin(depth * .18) * 3) < 3.7 || !decorative(p.x, p.z, .8)) continue
      if (index === 0 && i % 3 !== 0) {
        const scale = .67 + i % 5 * .09
        trees.push({ ...p, scale, angle: i * 1.23 })
        this.addObstacle(p.x, p.z, .48 * scale)
        this.shadows.cast(p.x, p.z, scale, scale * 3)
      } else if (i % 4 === 0) {
        const scale = .45 + i % 5 * .16
        stones.push({ ...p, scale });this.addObstacle(p.x, p.z, scale * .5)
        this.shadows.cast(p.x, p.z, scale * .6, scale)
      }
    }
    if (trees.length) this.scene.add(stylizedTrees(trees))
    const rocks = new T.InstancedMesh(index === 2 ? new T.OctahedronGeometry(1) : new T.DodecahedronGeometry(1), new T.MeshStandardMaterial({ color: palette.rock, roughness: 1, flatShading: true }), stones.length)
    stones.forEach((p, i) => {
      transform.position.set(p.x, p.scale * .65, p.z);transform.rotation.set(.12, i * 1.1, .15)
      transform.scale.set(p.scale, p.scale * (index === 2 ? 1.8 : 1.2), p.scale * .75)
      transform.updateMatrix();rocks.setMatrixAt(i, transform.matrix)
    })
    this.scene.add(rocks)
    const details = new T.InstancedMesh(index === 2 ? new T.OctahedronGeometry(1) : new T.ConeGeometry(.13, .42, 3), new T.MeshStandardMaterial({ color: palette.accent, flatShading: true }), 200)
    let count = 0
    for (let i = 0; i < 200; i++) {
      const [start, end] = sectorAngles(zone)
      const angle = start + (i * 193 % 1009) / 1009 * (end - start)
      const radius = 12 + (i * 157 % 1013) / 1013 * 54
      const p = { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius }
      if (!insideZone(p.x, p.z, zone, 1) || this.blocked(p.x, p.z, .2) || Math.hypot(p.x - boss.x, p.z - boss.z) < 7) continue
      const size = .65 + i % 5 * .13
      transform.position.set(p.x, .14, p.z);transform.rotation.set(0, i, .08)
      transform.scale.setScalar(index === 2 ? size * .16 : size)
      transform.updateMatrix();details.setMatrixAt(count++, transform.matrix)
    }
    details.count = count
    this.scene.add(details)
  }
}
