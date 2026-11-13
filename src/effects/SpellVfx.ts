import * as T from 'three'
import { effects, runes, type RuneId } from '../config/runes'
import { RootBurst } from './RootBurst'

export class SpellVfx {
  private roots: RootBurst
  private rings: { mesh: T.Mesh<T.RingGeometry, T.MeshBasicMaterial>; time: number; radius: number }[]
  private arcs: { mesh: T.Line<T.BufferGeometry, T.LineBasicMaterial>; time: number }[]
  private ringIndex = 0
  private arcIndex = 0

  constructor(scene: T.Scene) {
    this.roots = new RootBurst(scene, effects.root.radius)
    const geometry = new T.RingGeometry(0.72, 1, 32).rotateX(-Math.PI / 2)
    this.rings = Array.from({ length: 8 }, () => {
      const mesh = new T.Mesh(geometry, new T.MeshBasicMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide }))
      mesh.visible = false
      scene.add(mesh)
      return { mesh, time: 0, radius: 0 }
    })
    this.arcs = Array.from({ length: 8 }, () => {
      const geometry = new T.BufferGeometry()
      geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(15), 3))
      const mesh = new T.Line(geometry, new T.LineBasicMaterial({ color: '#d9ddff', transparent: true, depthWrite: false }))
      mesh.frustumCulled = false
      mesh.visible = false
      scene.add(mesh)
      return { mesh, time: 0 }
    })
  }

  burst(point: T.Vector3, element: RuneId, radius: number) {
    if (element === 'root') {
      this.roots.trigger(point)
      return
    }
    const ring = this.rings[this.ringIndex++ % this.rings.length]
    ring.time = 0.45
    ring.radius = radius
    ring.mesh.position.copy(point).setY(0.115)
    ring.mesh.material.color.set(runes[element].color)
    ring.mesh.material.opacity = 1
    ring.mesh.scale.setScalar(radius * 0.35)
    ring.mesh.visible = true
  }

  arc(from: T.Vector3, to: T.Vector3) {
    const arc = this.arcs[this.arcIndex++ % this.arcs.length]
    const positions = arc.mesh.geometry.getAttribute('position')
    for (let i = 0; i < positions.count; i++) {
      const t = i / (positions.count - 1)
      const offset = i === 0 || i === positions.count - 1 ? 0 : (i % 2 ? 0.28 : -0.28)
      positions.setXYZ(i, T.MathUtils.lerp(from.x, to.x, t) + offset, 1 + Math.sin(t * Math.PI) * 0.57, T.MathUtils.lerp(from.z, to.z, t) - offset)
    }
    positions.needsUpdate = true
    arc.time = 0.32
    arc.mesh.material.opacity = 1
    arc.mesh.visible = true
  }

  update(dt: number) {
    this.roots.update(dt)
    for (const ring of this.rings) {
      if (!ring.mesh.visible) continue
      ring.time = Math.max(0, ring.time - dt)
      ring.mesh.visible = ring.time > 0
      ring.mesh.material.opacity = ring.time / 0.45
      ring.mesh.scale.setScalar(ring.radius * (1 - ring.time / 0.45 * 0.65))
    }
    for (const arc of this.arcs) {
      if (!arc.mesh.visible) continue
      arc.time = Math.max(0, arc.time - dt)
      arc.mesh.visible = arc.time > 0
      arc.mesh.material.opacity = arc.time / 0.32
    }
  }

  clear() {
    this.roots.clear()
    for (const effect of [...this.rings, ...this.arcs]) effect.mesh.visible = false
  }
}
