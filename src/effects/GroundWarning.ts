import * as T from 'three'
import type { BossAttack } from '../config/bosses'
import { ForestAssets } from '../world/ForestAssets'

export class GroundWarning {
  readonly root = new T.Group()
  readonly rootEffects = new T.Group()
  private fill: T.MeshBasicMaterial
  private outline: T.MeshBasicMaterial
  private roots?: T.Group
  private rootsLife = 0
  private erupted = false

  constructor(readonly attack: BossAttack) {
    this.fill = new T.MeshBasicMaterial({ color: '#fd632c', transparent: true, depthWrite: false })
    this.outline = new T.MeshBasicMaterial({ color: '#ffb960', transparent: true, depthWrite: false })
    const shape = attack.kind !== 'line'
      ? new T.CircleGeometry(attack.radius, 48)
      : new T.PlaneGeometry(attack.width, attack.length).translate(0, -attack.length / 2, 0)
    shape.rotateX(-Math.PI / 2)
    const fillMesh = new T.Mesh(shape, this.fill)
    fillMesh.position.y = 0.065
    this.root.add(fillMesh)
    if (attack.kind !== 'line') {
      const border = new T.Mesh(new T.RingGeometry(attack.radius - 0.095, attack.radius, 48), this.outline)
      border.rotation.x = -Math.PI / 2
      border.position.y = 0.07
      this.root.add(border)
    } else {
      const edge = (width: number, length: number, x: number, z: number) => {
        const mesh = new T.Mesh(new T.PlaneGeometry(width, length), this.outline)
        mesh.rotation.x = -Math.PI / 2
        mesh.position.set(x, 0.07, z)
        this.root.add(mesh)
      }
      edge(0.08, attack.length, -attack.width / 2, attack.length / 2)
      edge(0.08, attack.length, attack.width / 2, attack.length / 2)
      edge(attack.width, 0.08, 0, 0)
      edge(attack.width, 0.08, 0, attack.length)
    }
    this.root.visible = false
    if (attack.roots && attack.kind === 'line') {
      this.roots = new T.Group()
      for (let i = 0; i < 5; i++) {
        const root = ForestAssets.roots.clone(true)
        root.position.set(0, 0, (i + .6) * attack.length / 5)
        root.rotation.y = i * 2.4
        root.scale.setScalar(attack.width / 1.5)
        this.roots.add(root)
      }
      this.roots.visible = false
      this.rootEffects.add(this.roots)
    }
  }

  aim(origin: T.Vector3, angle: number) {
    this.root.position.copy(origin)
    this.root.rotation.y = angle
    this.rootEffects.position.copy(origin)
    this.rootEffects.rotation.y = angle
    this.erupted = false
    this.show(0, 0)
  }

  show(progress: number, impact: number) {
    this.root.visible = true
    this.fill.opacity = impact > 0 ? impact * 0.8 : 0.2 + progress * 0.35
    this.outline.opacity = impact > 0 ? impact : 0.72 + progress * 0.28
    if (this.roots) {
      if (impact > 0 && !this.erupted) {
        this.erupted = true
        this.rootsLife = 2.4
        this.update(0)
      }
    }
  }

  update(dt: number) {
    if (!this.roots) return
    this.rootsLife = Math.max(0, this.rootsLife - dt)
    this.roots.visible = this.rootsLife > 0
    const age = 2.4 - this.rootsLife
    const rise = T.MathUtils.smoothstep(age, 0, .18)
    const sink = T.MathUtils.smoothstep(age, 1.7, 2.4)
    this.roots.scale.y = Math.max(.025, rise * (1 - sink))
    this.roots.position.y = -.08 - sink * .3
  }

  clearEffects() {
    this.rootsLife = 0
    if (this.roots) this.roots.visible = false
  }

  contains(point: T.Vector3) {
    const { attack } = this
    const x = point.x - this.root.position.x
    const z = point.z - this.root.position.z
    if (attack.kind !== 'line') return x * x + z * z <= attack.radius ** 2
    const angle = this.root.rotation.y
    const forward = x * Math.sin(angle) + z * Math.cos(angle)
    const across = x * Math.cos(angle) - z * Math.sin(angle)
    return forward >= 0 && forward <= attack.length && Math.abs(across) <= attack.width / 2
  }
}
