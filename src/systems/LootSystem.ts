import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export type LootKind = 'xp' | 'gold'

const glint = { xp: new T.Color('#84f9e6'), gold: new T.Color('#ffdc78') }

interface Drop {
  kind: LootKind
  mesh: T.Mesh
  amount: number
  age: number
  attracted: boolean
  scale: number
}

function lootGeometry(kind: LootKind) {
  const parts: T.BufferGeometry[] = []
  function add(shape: T.BufferGeometry, paint: string) {
    const piece = shape.index ? shape.toNonIndexed() : shape
    const colors = new Float32Array(piece.getAttribute('position').count * 3)
    const tint = new T.Color(paint)
    for (let i = 0; i < colors.length; i += 3) tint.toArray(colors, i)
    piece.setAttribute('color', new T.BufferAttribute(colors, 3))
    parts.push(piece)
    if (piece !== shape) shape.dispose()
  }
  if (kind === 'gold') {
    for (const [x, y, z, size] of [[0, -0.065, 0, 0.22], [-0.05, 0.02, 0.021, 0.205], [0.028, 0.095, -0.018, 0.20]]) {
      add(new T.CylinderGeometry(size, size, 0.062, 12).translate(x, y, z), '#e7a53d')
      add(new T.CylinderGeometry(size * 0.84, size * 0.84, 0.008, 12).translate(x, y + 0.034, z), '#ffdf78')
    }
    add(new T.CylinderGeometry(0.071, 0.071, 0.01, 4).rotateY(Math.PI / 4).translate(0.028, 0.136, -0.018), '#fff1ac')
  } else {
    add(new T.OctahedronGeometry(0.23).scale(0.83, 1.23, 0.79).rotateZ(-0.2), '#8df3e2')
    add(new T.OctahedronGeometry(0.13).scale(0.65, 1.13, 0.8).rotateZ(0.49).translate(0.15, -0.084, 0.045), '#49bcbf')
    add(new T.OctahedronGeometry(0.098).rotateZ(-0.63).translate(-0.12, -0.067, 0.086), '#afeef8')
  }
  const geometry = mergeGeometries(parts)
  for (const part of parts) part.dispose()
  if (!geometry) throw new Error('Could not assemble loot geometry')
  return geometry
}

export class LootSystem {
  private readonly pool: Record<LootKind, Drop[]>
  private readonly offset = new T.Vector3()
  private readonly trail = new T.BufferGeometry()
  private readonly trailPositions = new T.BufferAttribute(new Float32Array(48 * 6), 3).setUsage(T.DynamicDrawUsage)
  private readonly trailColors = new T.BufferAttribute(new Float32Array(48 * 6), 3).setUsage(T.DynamicDrawUsage)
  private trailCount = 0
  private previous = new T.Vector3()

  constructor(scene: T.Scene) {
    this.pool = { xp: this.createPool(scene, 'xp'), gold: this.createPool(scene, 'gold') }
    this.trail.setAttribute('position', this.trailPositions)
    this.trail.setAttribute('color', this.trailColors)
    this.trail.setDrawRange(0, 0)
    const lines = new T.LineSegments(this.trail, new T.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.74, depthWrite: false, toneMapped: false,
    }))
    lines.frustumCulled = false
    scene.add(lines)
  }

  hasDropsNear(point: T.Vector3, radius: number) {
    return this.pool.xp.some(drop => drop.mesh.visible && drop.mesh.position.distanceToSquared(point) < radius ** 2) ||
      this.pool.gold.some(drop => drop.mesh.visible && drop.mesh.position.distanceToSquared(point) < radius ** 2)
  }

  nearestGold(point: T.Vector3, radius: number) {
    let nearest: T.Vector3 | undefined
    let distance = radius * radius
    for (const drop of this.pool.gold) {
      if (!drop.mesh.visible) continue
      const squared = drop.mesh.position.distanceToSquared(point)
      if (squared < distance) { distance = squared; nearest = drop.mesh.position }
    }
    return nearest
  }

  spawn(point: T.Vector3, xp: number, gold: number) {
    if (xp > 0) this.drop('xp', point, xp, -0.3)
    if (gold > 0) this.drop('gold', point, gold, 0.3)
  }

  update(dt: number, player: T.Vector3, radius: number, collect: (kind: LootKind, amount: number) => number, goldSpace: () => number) {
    this.trailCount = 0
    for (const drops of Object.values(this.pool)) {
      for (const drop of drops) {
        if (!drop.mesh.visible) continue
        const full = drop.kind === 'gold' && goldSpace() <= 0
        drop.age = full ? Math.min(30, drop.age + dt) : drop.age + dt
        if (full) drop.attracted = false
        if (drop.kind === 'xp' && drop.age > 60 && !drop.attracted) {
          drop.mesh.visible = false
          continue
        }
        const point = drop.mesh.position
        this.offset.set(player.x - point.x, 0, player.z - point.z)
        const distance = this.offset.lengthSq()
        if (!full && drop.age >= 0.24 && distance <= radius ** 2) drop.attracted = true
        if (drop.attracted && distance < 0.18 ** 2) {
          const accepted = collect(drop.kind, drop.amount)
          drop.amount -= accepted
          drop.mesh.visible = drop.amount > 0
          drop.attracted = false
          continue
        }
        this.previous.copy(point)
        if (drop.attracted) {
          point.add(this.offset.clampLength(0, dt * 13))
          point.y = T.MathUtils.damp(point.y, 0.95, 13, dt)
          this.writeTrail(point, drop.kind)
        } else {
          const bounce = drop.age < 0.24 ? Math.sin(drop.age / 0.24 * Math.PI) * 0.51 : 0
          point.y = 0.30 + Math.sin(drop.age * 5) * 0.058 + bounce
        }
        drop.mesh.rotation.y += dt * (drop.attracted ? 12 : 2.9)
        drop.mesh.rotation.z = drop.kind === 'gold' ? 0.27 + Math.sin(drop.age * 4.2) * 0.12 : 0.16
        drop.mesh.scale.setScalar(drop.scale * (0.87 + 0.13 * T.MathUtils.smoothstep(drop.age, 0, 0.15)))
      }
    }
    this.trail.setDrawRange(0, this.trailCount)
    if (this.trailCount) this.trailPositions.needsUpdate = this.trailColors.needsUpdate = true
  }

  private writeTrail(point: T.Vector3, kind: LootKind) {
    const index = this.trailCount
    const color = glint[kind]
    const length = 2.1
    this.trailPositions.setXYZ(index, point.x + (this.previous.x - point.x) * length, this.previous.y, point.z + (this.previous.z - point.z) * length)
    this.trailPositions.setXYZ(index + 1, point.x, point.y, point.z)
    this.trailColors.setXYZ(index, color.r * 0.3, color.g * 0.3, color.b * 0.3)
    this.trailColors.setXYZ(index + 1, color.r, color.g, color.b)
    this.trailCount += 2
  }

  private createPool(scene: T.Scene, kind: LootKind) {
    const geometry = lootGeometry(kind)
    const material = new T.MeshStandardMaterial({ vertexColors: true, emissive: glint[kind], emissiveIntensity: 0.21, flatShading: true, roughness: 0.49 })
    return Array.from({ length: 24 }, (): Drop => {
      const mesh = new T.Mesh(geometry, material)
      mesh.visible = false
      scene.add(mesh)
      return { kind, mesh, age: 0, amount: 0, attracted: false, scale: 1 }
    })
  }

  private drop(kind: LootKind, point: T.Vector3, amount: number, sideways: number) {
    const pool = this.pool[kind]
    const drop = pool.find(item => !item.mesh.visible)
    if (!drop) {
      const nearest = pool.reduce((a, b) => a.mesh.position.distanceToSquared(point) < b.mesh.position.distanceToSquared(point) ? a : b)
      nearest.amount += amount
      return
    }
    drop.mesh.position.set(point.x + sideways, 0.30, point.z)
    drop.mesh.rotation.set(0, point.x + point.z, 0)
    drop.mesh.visible = true
    drop.age = 0
    drop.amount = amount
    drop.scale = Math.min(1.27, 0.90 + Math.log2(Math.max(1, amount)) * 0.065)
    drop.mesh.scale.setScalar(drop.scale * 0.87)
    drop.attracted = false
  }
}
