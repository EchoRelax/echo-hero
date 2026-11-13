import * as T from 'three'

function sparkTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const context = canvas.getContext('2d')!
  const glow = context.createRadialGradient(32, 32, 0, 32, 32, 31)
  glow.addColorStop(0, '#fff2a6ef')
  glow.addColorStop(0.48, '#ffb54bc4')
  glow.addColorStop(1, '#ff9a3400')
  context.fillStyle = glow
  context.fillRect(0, 0, 64, 64)
  for (const [radius, color] of [[28, '#fb8a37'], [22, '#ffcd68'], [16, '#fff7bd']] as const) {
    context.fillStyle = color
    context.beginPath()
    for (let i = 0; i < 12; i++) {
      const angle = i / 12 * Math.PI * 2
      const length = radius * (i % 2 ? 0.39 : 1)
      const x = 32 + Math.cos(angle) * length
      const y = 32 + Math.sin(angle) * length
      if (i === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    }
    context.closePath()
    context.fill()
  }
  const texture = new T.CanvasTexture(canvas)
  texture.colorSpace = T.SRGBColorSpace
  return texture
}

export class ImpactVfx {
  private sparks: { sprite: T.Sprite; life: number; peak: number }[]
  private cursor = 0
  private readonly duration = 0.23

  constructor(scene: T.Scene) {
    const map = sparkTexture()
    this.sparks = Array.from({ length: 8 }, () => {
      const sprite = new T.Sprite(new T.SpriteMaterial({ map, transparent: true, depthWrite: false, toneMapped: false }))
      sprite.visible = false
      scene.add(sprite)
      return { sprite, life: 0, peak: 1 }
    })
  }

  trigger(point: T.Vector3, from: T.Vector3, defeat: boolean) {
    const spark = this.sparks[this.cursor++ % this.sparks.length]
    spark.life = this.duration
    spark.peak = defeat ? 1.65 : 1.06
    spark.sprite.position.copy(point).lerp(from, 0.13).setY(defeat ? 0.92 : 0.79)
    spark.sprite.material.rotation = this.cursor * 1.93
    spark.sprite.material.opacity = 1
    spark.sprite.scale.setScalar(spark.peak * 0.55)
    spark.sprite.visible = true
  }

  update(dt: number) {
    for (const spark of this.sparks) {
      if (!spark.sprite.visible) continue
      spark.life = Math.max(0, spark.life - dt)
      const age = 1 - spark.life / this.duration
      spark.sprite.visible = spark.life > 0
      spark.sprite.scale.setScalar(spark.peak * (0.55 + 0.74 * Math.sin(age * 2.35)))
      spark.sprite.material.opacity = 1 - T.MathUtils.smoothstep(age, 0.35, 1)
      spark.sprite.position.y += dt * 0.38
    }
  }

  clear() {
    for (const spark of this.sparks) spark.sprite.visible = false
  }
}
