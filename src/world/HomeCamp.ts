import * as T from 'three'

export class HomeCamp {
  readonly root = new T.Group()
  readonly radius = 3.5
  private flame: T.Mesh
  private time = 0

  constructor(scene: T.Scene) {
    this.root.position.set(0, 0, 0)
    this.root.visible = true
    const stone = new T.MeshStandardMaterial({ color: '#929b8a', flatShading: true })
    const wood = new T.MeshStandardMaterial({ color: '#80513a', flatShading: true })
    const gold = new T.MeshStandardMaterial({ color: '#e8b75c', flatShading: true })
    const ring = new T.Mesh(new T.RingGeometry(this.radius - 0.09, this.radius, 64), gold)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.065
    this.root.add(ring)
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4
      const rock = new T.Mesh(new T.DodecahedronGeometry(0.2), stone)
      rock.position.set(-0.82 + Math.cos(angle) * 0.44, 0.12, -0.45 + Math.sin(angle) * 0.44)
      this.root.add(rock)
    }
    for (const yaw of [-0.6, 0.6]) {
      const log = new T.Mesh(new T.CylinderGeometry(0.09, 0.12, 0.75, 6), wood)
      log.rotation.set(Math.PI / 2, 0, yaw)
      log.position.set(-0.82, 0.15, -0.45)
      this.root.add(log)
    }
    this.flame = new T.Mesh(new T.OctahedronGeometry(0.32), new T.MeshBasicMaterial({ color: '#ffb859' }))
    this.flame.position.set(-0.82, 0.55, -0.45)
    this.flame.scale.set(0.75, 1.5, 0.75)
    this.root.add(this.flame)
    const chest = new T.Mesh(new T.BoxGeometry(0.83, 0.55, 0.58), wood)
    chest.position.set(0.9, 0.3, -0.5)
    this.root.add(chest)
    for (const x of [0.65, 1.15]) {
      const strap = new T.Mesh(new T.BoxGeometry(0.09, 0.58, 0.61), gold)
      strap.position.set(x, 0.3, -0.5)
      this.root.add(strap)
    }
    scene.add(this.root)
  }

  update(dt: number, unlocked: boolean) {
    this.root.visible = true
    this.flame.visible = unlocked
    if (!unlocked) return
    this.time += dt
    this.flame.scale.y = 1.5 + Math.sin(this.time * 9) * 0.18
    this.flame.rotation.y += dt * 0.7
  }

  contains(position: T.Vector3) {
    return (position.x - this.root.position.x) ** 2 + (position.z - this.root.position.z) ** 2 <= this.radius ** 2
  }
}
