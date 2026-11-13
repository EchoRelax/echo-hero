import * as T from 'three'
import { worldHalfWidth, worldNorth, zones, type Zone } from '../config/zones'

type Point = readonly [x: number, z: number]
export type SolidEdge = (a: Point, b: Point, radius: number) => void

const clearings: readonly Point[][] = [
  [[0, 12], [0, 2], [0, -9], [4.7, -16], [1.7, -22], [-6, -29], [-4, -34], [3.5, -40], [0, -45], [2.7, -51], [0, -56]],
  [[0, -56], [0, -59], [-4.3, -64], [3.3, -71], [5.3, -75], [1, -80], [-5.8, -85], [0, -91], [-2.8, -97], [0, -102]],
  [[0, -102], [0, -105], [5.3, -111], [1.7, -117], [-5.9, -123], [-4.6, -127], [4, -132], [0, -137], [2.6, -143], [0, worldNorth]],
]

const palette = [
  { ground: '#81ac55', stone: ['#557a63', '#759478', '#a1a887'], detail: ['#55934e', '#aecb75', '#edd083'], bloom: ['#ffe17e', '#f3a4ad', '#e6f4b9'] },
  { ground: '#b26f53', stone: ['#844e4e', '#ab6857', '#cf8a68'], detail: ['#8e4b51', '#d0825b', '#e9aa6e'], bloom: ['#ffad60', '#df7956', '#a66361'] },
  { ground: '#6c5893', stone: ['#574772', '#7f6593', '#a38eac'], detail: ['#67508d', '#b398c3', '#d6acd0'], bloom: ['#8caeff', '#d594f5', '#a2dee5'] },
]

export const groundBounds = { west: -worldHalfWidth - 3, east: worldHalfWidth + 3, north: worldNorth - 5, south: 17 }

export function clearingX(z: number, zone: Zone) {
  const points = clearings[zones.indexOf(zone)]
  for (let i = 1; i < points.length; i++) {
    const [x0, z0] = points[i - 1]
    const [x1, z1] = points[i]
    if (z < z1) continue
    const t = T.MathUtils.smoothstep((z - z0) / (z1 - z0), 0, 1)
    return T.MathUtils.lerp(x0, x1, t)
  }
  return points[points.length - 1][0]
}

export function paintGround() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 2048
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not create the ground texture')
  const { west, east, north, south } = groundBounds
  const scaleX = canvas.width / (east - west)
  const scaleZ = canvas.height / (south - north)
  context.setTransform(scaleX, 0, 0, scaleZ, -west * scaleX, -north * scaleZ)
  context.lineJoin = 'round'
  context.lineCap = 'round'

  for (const [i, zone] of zones.entries()) {
    const start = zones[i + 1]?.boundary ?? north
    const end = i === 0 ? south : zone.boundary
    context.fillStyle = palette[i].ground
    context.fillRect(west, start, east - west, end - start)
  }
  const texture = new T.CanvasTexture(canvas)
  texture.colorSpace = T.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

export function buildCliffs(scene: T.Scene, solid: SolidEdge) {
  const stone = new T.DodecahedronGeometry(1)
  const top = new T.IcosahedronGeometry(1)
  const material = new T.MeshStandardMaterial({ roughness: 1, flatShading: true })
  const matrix = new T.Object3D()
  const color = new T.Color()
  const ledges: readonly Point[][][] = [
    [
      [[-28, 12], [-15, 11.5], [0, 12], [16, 11.7], [28, 12]],
      [[-27, -18], [-23, -19], [-20, -18], [-8, -17], [0.8, -17]],
      [[27, -28], [23, -30], [18, -29], [7, -30], [-1.2, -29]],
      [[-28, -37], [-21, -38], [-12, -36]],
    ],
    [
      [[-27, -74], [-24, -73], [-17, -73.9], [-9, -74], [0.5, -75]],
      [[27, -81], [23, -80], [18, -80], [11, -79]],
      [[12, -82.8], [6, -83.5], [0.7, -82.8]],
    ],
    [
      [[27, -118], [22, -120], [16, -120], [9, -121], [-0.8, -123]],
      [[-27, -126], [-22, -127], [-15, -126]],
    ],
  ]
  for (const [index, zone] of zones.entries()) {
    const north = zones[index + 1]?.boundary ?? worldNorth
    const sides: Point[][] = [-1, 1].map(sign => Array.from({ length: 8 }, (_, i) => [
      sign * (26.9 + Math.sin(i * 1.8 + index) * 0.63),
      T.MathUtils.lerp(zone.boundary, north, i / 7),
    ]))
    const rim: Point[][] = index === 2 ? [[[-28, north], [-12, north + 0.4], [5, north], [28, north]]] : [
      [[-28, north], [-20, north - 0.6], [-13, north + 1.0], [-7, north + 0.3], [-3.9, north]],
      [[3.9, north], [8, north - 0.5], [15, north + 1.0], [23, north - 0.2], [28, north]],
    ]
    const sections = [...sides, ...rim, ...ledges[index]]
    const samples: { x: number; z: number; angle: number; span: number; tall: number }[] = []
    for (const section of sections) {
      for (let i = 1; i < section.length; i++) {
        const a = section[i - 1], b = section[i]
        const dx = b[0] - a[0], dz = b[1] - a[1]
        const length = Math.hypot(dx, dz)
        const count = Math.ceil(length / 1.75)
        solid(a, b, 0.83)
        for (let j = 0; j < count; j++) {
          const t = (j + 0.5) / count
          const n = samples.length
          samples.push({
            x: T.MathUtils.lerp(a[0], b[0], t), z: T.MathUtils.lerp(a[1], b[1], t),
            angle: -Math.atan2(dz, dx), span: length / count, tall: 1.34 + Math.abs(Math.sin(n * 3.03)) * 0.69,
          })
        }
      }
    }
    const bases = new T.InstancedMesh(stone, material, samples.length)
    const crowns = new T.InstancedMesh(top, material, samples.length)
    samples.forEach(({ x, z, angle, span, tall }, i) => {
      matrix.position.set(x, tall * 0.52, z)
      matrix.rotation.set(0.12, angle, Math.sin(i * 2.19) * 0.17)
      matrix.scale.set(span * 0.82, tall, 1.29)
      matrix.updateMatrix()
      bases.setMatrixAt(i, matrix.matrix)
      bases.setColorAt(i, color.set(palette[index].stone[i % 2]))
      matrix.position.y = tall * 1.23
      matrix.rotation.y += i * 0.4
      matrix.scale.multiplyScalar(0.67)
      matrix.updateMatrix()
      crowns.setMatrixAt(i, matrix.matrix)
      crowns.setColorAt(i, color.set(palette[index].stone[1 + i % 2]))
    })
    scene.add(bases, crowns)
  }
}

export function scatterDetails(scene: T.Scene, blocked: (x: number, z: number) => boolean) {
  const chip = new T.DodecahedronGeometry(1)
  const stalk = new T.CylinderGeometry(0.035, 0.083, 0.5, 4)
  const petal = new T.IcosahedronGeometry(1)
  const matte = new T.MeshStandardMaterial({ flatShading: true, roughness: 0.96 })
  const matrix = new T.Object3D()
  const tint = new T.Color()
  for (const [index, zone] of zones.entries()) {
    const north = zones[index + 1]?.boundary ?? worldNorth
    const debris = new T.InstancedMesh(chip, matte, 210)
    const stems = new T.InstancedMesh(stalk, matte, 74)
    const flowers = new T.InstancedMesh(petal, matte, 74)
    let count = 0, blooms = 0
    for (let i = 0; i < 210; i++) {
      const z = north + 2 + (i * 127 % 1009) / 1009 * (zone.boundary - north - 4)
      const x = -24 + (i * 263 % 1031) / 1031 * 48
      if (Math.hypot(x, z - zone.arena) < 7.1 || Math.hypot(x, z - zone.checkpoint) < 1.8 || blocked(x, z)) continue
      const size = 0.09 + (i % 9) * 0.034
      matrix.position.set(x, size * 0.21, z)
      matrix.rotation.set(0.12, i * 1.81, 0.09)
      matrix.scale.set(size * 1.45, size * 0.4, size * 1.05)
      matrix.updateMatrix()
      debris.setMatrixAt(count, matrix.matrix)
      debris.setColorAt(count++, tint.set(palette[index].detail[i % 3]))
      if (i % 3 === 0 || blooms >= 74 || Math.abs(x - clearingX(z, zone)) < 2.35) continue
      const height = 0.18 + size * 0.64
      matrix.position.y = height * 0.4
      matrix.rotation.set(0.18, i * 0.67, Math.sin(i) * 0.29)
      matrix.scale.set(0.68, height * 2, 0.68)
      matrix.updateMatrix()
      stems.setMatrixAt(blooms, matrix.matrix)
      stems.setColorAt(blooms, tint.set(palette[index].detail[0]))
      matrix.position.y = height
      matrix.scale.set(height * 0.48, height * (index === 2 ? 1.06 : 0.37), height * 0.49)
      matrix.updateMatrix()
      flowers.setMatrixAt(blooms, matrix.matrix)
      flowers.setColorAt(blooms++, tint.set(palette[index].bloom[i % 3]))
    }
    debris.count = count
    stems.count = flowers.count = blooms
    scene.add(debris, stems, flowers)
  }
}
