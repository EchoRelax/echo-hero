import * as T from 'three'

export class RootBurst {
  private root = new T.Group()
  private spikes = new T.Group()
  private ring = new T.Mesh(
    new T.RingGeometry(0.78, 1, 30),
    new T.MeshBasicMaterial({ color: '#c6fb82', transparent: true, depthWrite: false }),
  )
  private life = 0

  constructor(scene: T.Scene, private radius: number) {
    const spike = new T.ConeGeometry(0.23, 1.22, 5)
    const bark = new T.MeshStandardMaterial({ color: '#9bba52', emissive: '#48672a', emissiveIntensity: 0.85, flatShading: true })
    for (let i = 0; i < 9; i++) {
      const angle = i * Math.PI * 2 / 9
      const distance = radius * (0.18 + (i % 3) * 0.25)
      const thorn = new T.Mesh(spike, bark)
      thorn.position.set(Math.sin(angle) * distance, 0.48, Math.cos(angle) * distance)
      thorn.rotation.set(0.35 * Math.cos(angle), 0, -0.35 * Math.sin(angle))
      this.spikes.add(thorn)
    }
    this.ring.rotation.x = -Math.PI / 2
    this.ring.position.y = 0.11
    this.root.add(this.ring, this.spikes)
    this.root.visible = false
    scene.add(this.root)
  }

  trigger(point: T.Vector3) {
    this.root.position.copy(point)
    this.life = 0.52
    this.root.visible = true
    this.update(0)
  }

  update(dt: number) {
    if (!this.root.visible) return
    this.life = Math.max(0, this.life - dt)
    this.root.visible = this.life > 0
    const age = 1 - this.life / 0.52
    this.ring.scale.setScalar(this.radius * (0.3 + age * 0.7))
    this.ring.material.opacity = (1 - age) * 0.75
    this.spikes.scale.y = Math.min(1, age * 9, (1 - age) * 4)
  }

  clear() {
    this.root.visible = false
  }
}
