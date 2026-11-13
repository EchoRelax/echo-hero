import * as T from 'three'
import type { BossId } from '../config/bosses'

export interface BossModel {
  root: T.Group
  animate(time: number, charge: number, impact: number, enraged: boolean, hit: boolean, moving?: boolean, casting?: boolean, dt?: number): void
}

export class RootGuardianModel implements BossModel {
  readonly root = new T.Group()
  private body = new T.Group()
  private arms = [new T.Group(), new T.Group()]
  private core = new T.MeshStandardMaterial({ color: '#e7af49', emissive: '#dc922a', emissiveIntensity: 0.7, flatShading: true })

  constructor(private id: BossId = 'rootGuardian') {
    const ash = id === 'ashGolem'
    const storm = id === 'stormLord'
    const bark = new T.MeshStandardMaterial({ color: ash ? '#573d3e' : storm ? '#514474' : '#65513a', flatShading: true })
    const moss = new T.MeshStandardMaterial({ color: ash ? '#946051' : storm ? '#9280bd' : '#788648', flatShading: true })
    const wood = ash ? new T.BoxGeometry(1.6, 1.65, 1.6) : new T.DodecahedronGeometry(1)
    const branch = new T.CylinderGeometry(0.07, 0.32, 1.25, 5)
    const crystal = new T.OctahedronGeometry(1)
    if (storm) this.core.color.set('#acbfff')
    if (ash) this.core.color.set('#ff7a43')
    const add = (parent: T.Group, shape: T.BufferGeometry, material: T.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
      const mesh = new T.Mesh(shape, material)
      mesh.position.set(x, y, z)
      mesh.scale.set(sx, sy, sz)
      parent.add(mesh)
      return mesh
    }

    this.root.add(this.body)
    const shadow = new T.Mesh(new T.CircleGeometry(1.65, 24), new T.MeshBasicMaterial({ color: '#243b29', transparent: true, opacity: 0.27, depthWrite: false }))
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.046
    this.root.add(shadow)
    add(this.body, wood, bark, 0, 1.05, 0, 0.89, 1.11, 0.63)
    add(this.body, wood, moss, 0, 2.06, 0.09, 0.78, 0.63, 0.62)
    add(this.body, crystal, this.core, 0, 1.38, 0.61, 0.27, 0.38, 0.2)
    for (const side of [-1, 1]) {
      add(this.body, crystal, this.core, side * 0.27, 2.12, 0.64, 0.16, 0.1, 0.095).rotation.z = side * 0.27
      if (!ash) {
        add(this.body, storm ? crystal : branch, bark, side * 0.45, 2.68, -0.02, 1, 1.12, 1).rotation.z = side * -0.55
        add(this.body, storm ? crystal : branch, storm ? this.core : moss, side * 0.66, 2.84, 0.05, 0.29, 0.63, 0.29).rotation.z = side * -0.45
      }
      if (!storm) add(this.body, wood, bark, side * 0.52, 0.32, 0.43, 0.58, 0.43, 0.83).rotation.y = side * 0.34
      const arm = this.arms[side === -1 ? 0 : 1]
      arm.position.set(side * 0.93, 1.62, -0.01)
      this.body.add(arm)
      add(arm, wood, moss, 0, -0.06, 0, 0.55, 0.51, 0.55)
      add(arm, wood, bark, side * 0.29, -0.55, 0.2, 0.49, 0.68, 0.55)
    }
  }

  animate(time: number, charge: number, impact: number, enraged: boolean, hit: boolean) {
    this.body.position.y = (this.id === 'stormLord' ? 0.48 + Math.sin(time * 3) * 0.15 : Math.sin(time * 3) * 0.03) + charge * 0.14
    this.body.rotation.x = impact * 0.23
    this.arms.forEach((arm, index) => {
      arm.rotation.x = charge * -2 + impact * 0.68
      arm.rotation.z = (index === 0 ? -1 : 1) * (0.24 + charge * 0.12)
    })
    this.core.emissive.set(this.id === 'stormLord' ? (enraged ? '#df92fd' : '#799af4') : (enraged ? '#f36d36' : '#dc922a'))
    this.core.emissiveIntensity = hit ? 3.6 : 0.8 + charge * 2.2
  }
}
