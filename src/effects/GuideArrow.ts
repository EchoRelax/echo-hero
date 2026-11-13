import * as T from 'three'

export class GuideArrow {
  readonly root = new T.Group()
  private markers: T.Mesh[] = []
  constructor(scene: T.Scene) {
    const shape = new T.Shape()
    shape.moveTo(0, .45); shape.lineTo(-.34, -.12); shape.lineTo(-.12, -.04)
    shape.lineTo(-.12, -.38); shape.lineTo(.12, -.38); shape.lineTo(.12, -.04)
    shape.lineTo(.34, -.12); shape.closePath()
    const geometry = new T.ShapeGeometry(shape).rotateX(Math.PI / 2)
    for (let i = 0; i < 3; i++) {
      const material = new T.MeshBasicMaterial({ color: '#fff1a3', transparent: true, opacity: 1, depthWrite: false, side: T.DoubleSide, toneMapped: false })
      const mesh = new T.Mesh(geometry, material)
      mesh.position.set(0, .12, 1.45 + i * .65)
      this.markers.push(mesh); this.root.add(mesh)
    }
    this.root.visible = false
    scene.add(this.root)
  }
  update(player: T.Vector3, target: { x: number; z: number } | undefined, time: number) {
    const dx = target ? target.x - player.x : 0, dz = target ? target.z - player.z : 0
    this.root.visible = !!target && dx * dx + dz * dz > 2.3 ** 2
    if (!this.root.visible) return
    this.root.position.copy(player)
    this.root.rotation.y = Math.atan2(dx, dz)
    this.markers.forEach((mesh, i) => {
      const material = mesh.material as T.MeshBasicMaterial
      material.opacity = .4 + .6 * (.5 + .5 * Math.sin(time * 5 - i * 1.2))
      mesh.position.y = .12 + .035 * Math.sin(time * 4 - i)
    })
  }
}
