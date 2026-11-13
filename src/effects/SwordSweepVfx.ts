import * as T from 'three'
import { hero } from '../config/balance'

const duration = 0.24
const segments = 36

function crescentGeometry() {
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const bands = [
    { inset: 0.92, color: new T.Color('#ffac52'), alpha: 0 },
    { inset: 0.58, color: new T.Color('#ffb84f'), alpha: 0.48 },
    { inset: 0.16, color: new T.Color('#ffe794'), alpha: 0.88 },
    { inset: 0.055, color: new T.Color('#fff9d4'), alpha: 1 },
    { inset: 0, color: new T.Color('#fff9d4'), alpha: 0 },
  ]
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const angle = (t - 0.5) * hero.sweepAngle
    const taper = Math.sin(t * Math.PI)
    const tipFade = T.MathUtils.smoothstep(taper, 0, 0.27)
    for (const band of bands) {
      const radius = hero.range - band.inset * (0.10 + 0.90 * taper)
      positions.push(Math.sin(angle) * radius, 0.66 + taper * 0.17 - band.inset * 0.19, Math.cos(angle) * radius)
      colors.push(band.color.r, band.color.g, band.color.b, band.alpha * tipFade)
    }
    if (i === 0) continue
    for (let j = 0; j < bands.length - 1; j++) {
      const a = (i - 1) * bands.length + j
      const b = a + bands.length
      indices.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 4))
  geometry.setIndex(indices)
  return geometry
}

export class SwordSweepVfx {
  private material = new T.MeshBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false, side: T.DoubleSide, toneMapped: false,
  })
  private mesh = new T.Mesh(crescentGeometry(), this.material)
  private age = 0

  constructor(scene: T.Scene) {
    this.mesh.visible = false
    scene.add(this.mesh)
  }

  trigger(origin: T.Vector3, yaw: number) {
    this.age = 0
    this.mesh.position.copy(origin)
    this.mesh.rotation.y = yaw
    this.material.opacity = 1
    this.mesh.visible = true
  }

  update(dt: number) {
    if (!this.mesh.visible) return
    this.age += dt
    this.mesh.visible = this.age < duration
    this.material.opacity = 1 - T.MathUtils.smoothstep(this.age, 0.045, duration)
    this.mesh.position.y += dt * 0.44
  }

  clear() {
    this.mesh.visible = false
  }
}
