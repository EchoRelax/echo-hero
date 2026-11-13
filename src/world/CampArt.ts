import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { SceneryShadows } from '../effects/SceneLook'

/** Texture-free camp dressing, baked into a single static colored mesh. */
export function buildCampArt(scene: T.Scene, shadows: SceneryShadows, block: (x: number, z: number, radius: number) => void) {
  const pieces: T.BufferGeometry[] = []
  const transform = new T.Object3D()
  const add = (geometry: T.BufferGeometry, color: string, position: number[], scale = [1, 1, 1], rotation = [0, 0, 0]) => {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry.clone()
    geometry.dispose();flat.deleteAttribute('uv')
    transform.position.fromArray(position);transform.scale.fromArray(scale);transform.rotation.set(rotation[0], rotation[1], rotation[2]);transform.updateMatrix()
    flat.applyMatrix4(transform.matrix)
    const colors = new Float32Array(flat.getAttribute('position').count * 3), tint = new T.Color(color)
    for (let i = 0; i < colors.length; i += 3) tint.toArray(colors, i)
    flat.setAttribute('color', new T.BufferAttribute(colors, 3));pieces.push(flat)
  }
  const box = (color: string, p: number[], size: number[], yaw = 0) => add(new T.BoxGeometry(1, 1, 1), color, p, size, [0, yaw, 0])
  const beam = (a: number[], b: number[], radius: number, color = '#78563e') => {
    const start = new T.Vector3().fromArray(a), end = new T.Vector3().fromArray(b)
    const geometry = new T.CylinderGeometry(radius * .8, radius, start.distanceTo(end), 6)
    geometry.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), end.clone().sub(start).normalize()))
    add(geometry, color, start.add(end).multiplyScalar(.5).toArray())
  }
  // An irregular trampled clearing breaks up the perfect yellow disc.
  const floor: number[] = [], floorColors: number[] = []
  const count = 48
  const ring = (i: number, radius: number) => {
    const a = i / count * Math.PI * 2
    const wobble = radius < 10 ? Math.sin(a * 5) * .25 + Math.cos(a * 3) * .15 : 0
    return new T.Vector3(Math.cos(a) * (radius + wobble), .038, Math.sin(a) * (radius + wobble))
  }
  const radii = [0, 3.9, 5.8, 8, 10.45]
  const palette = ['#c9b17a', '#b7b178', '#a4b276', '#a4b477']
  for (let layer = 0; layer < radii.length - 1; layer++) for (let i = 0; i < count; i++) {
    const a = radii[layer] === 0 ? new T.Vector3(0, .038, 0) : ring(i, radii[layer])
    const b = ring(i + 1, radii[layer + 1]), c = ring(i, radii[layer + 1])
    const triangles = radii[layer] === 0 ? [a, b, c] : [a, ring(i + 1, radii[layer]), b, a, b, c]
    const color = new T.Color(palette[layer]).multiplyScalar(.98 + .025 * Math.sin(i * 3.7 + layer))
    for (const p of triangles) { floor.push(p.x, p.y, p.z);floorColors.push(color.r, color.g, color.b) }
  }
  const ground = new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(floor, 3)).setAttribute('color', new T.Float32BufferAttribute(floorColors, 3))
  ground.computeVertexNormals()
  scene.add(new T.Mesh(ground, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: T.DoubleSide })))

  // Open-front shelter on the back edge, away from the three travel corridors.
  const tx = -3.5, tz = -5.3
  for (const side of [-1, 1]) {
    for (const z of [tz - 1.15, tz + 1.15]) {
      beam([tx + side * 1.25, .05, z], [tx + side * 1.25, 1.52, z], .07)
      block(tx + side * 1.25, z, .12)
    }
    const roof = new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute([
      tx, 2.25, tz - 1.45, tx + side * 1.55, 1.45, tz - 1.45, tx + side * 1.55, 1.45, tz + 1.45,
      tx, 2.25, tz - 1.45, tx + side * 1.55, 1.45, tz + 1.45, tx, 2.25, tz + 1.45,
    ], 3))
    roof.computeVertexNormals();add(roof, side < 0 ? '#7b9d89' : '#adc19b', [0, 0, 0])
    beam([tx, 2.23, tz - 1.55], [tx, 2.23, tz + 1.55], .065)
  }
  // Bedroll, folded blanket, and a low supply shelf under the awning.
  box('#74674d', [tx - .5, .12, tz], [.8, .14, 1.65])
  box('#a05f45', [tx - .5, .22, tz + .2], [.73, .07, 1.02])
  add(new T.CylinderGeometry(.15, .15, .75, 8), '#d4bc8b', [tx - .5, .27, tz - .6], [1, 1, 1], [0, 0, Math.PI / 2])
  box('#856347', [tx + .65, .48, tz - .4], [.6, .10, 1.15])
  block(tx - .5, tz, .65);block(tx + .65, tz - .4, .38)
  shadows.cast(tx, tz, 1.7, 2.25, .05)

  // Two seats frame the fire without occupying its approach from the south.
  for (const [x, z, angle] of [[-2.2, -1.9, -.45], [.35, -2.3, .1]]) {
    add(new T.CylinderGeometry(.21, .25, 1.6, 7), '#7b5238', [x, .28, z], [1, 1, 1], [0, angle, Math.PI / 2])
    block(x, z, .43)
    for (const side of [-1, 1]) block(x + side * .5 * Math.cos(angle), z - side * .5 * Math.sin(angle), .28)
    shadows.cast(x, z, .75, .45, .05)
  }
  // Store corner: stacked crates, cask, firewood. No new interaction implied.
  for (const [i, [x, z]] of [[3.8, -4.4], [4.6, -4.0], [3.8, -5.15]].entries()) {
    box('#916440', [x, .40, z], [.72, .72, .72], i * .15)
    for (const h of [.13, .68]) box('#c39859', [x, h, z + .37], [.75, .07, .04], i * .15)
    box('#bc8f52', [x, .4, z + .38], [.07, .72, .04])
    block(x, z, .49)
  }
  add(new T.CylinderGeometry(.37, .32, .86, 9), '#986f48', [2.9, .46, -5.1])
  for (const y of [.2, .72]) add(new T.CylinderGeometry(.38, .38, .08, 9), '#555d55', [2.9, y, -5.1])
  block(2.9, -5.1, .42)
  for (let i = 0; i < 6; i++) add(new T.CylinderGeometry(.09, .11, .85, 6), '#9a7149', [2.8 + i % 3 * .22, .15 + Math.floor(i / 3) * .17, -3.8], [1, 1, 1], [Math.PI / 2, 0, 0])

  // Small practice dummy at the quiet northeast edge.
  const dx = 6.1, dz = -2.4
  beam([dx, .05, dz], [dx, 1.9, dz], .09)
  beam([dx - .6, 1.23, dz], [dx + .6, 1.23, dz], .065)
  add(new T.CylinderGeometry(.26, .32, .7, 7), '#c3a265', [dx, 1.13, dz])
  add(new T.IcosahedronGeometry(.22, 0), '#e0bf7d', [dx, 1.75, dz])
  for (const y of [.9, 1.35]) add(new T.CylinderGeometry(.28, .28, .045, 7), '#8a7050', [dx, y, dz])
  block(dx, dz, .35);shadows.cast(dx, dz, .5, 1.9, .05)

  // Sparse stone edging and vegetation: intentional gaps face all exits.
  for (let i = 0; i < 44; i++) {
    const a = i / 44 * Math.PI * 2
    const atExit = [.0, Math.PI / 2, Math.PI * 7 / 6].some(exit => Math.abs(Math.atan2(Math.sin(a - exit), Math.cos(a - exit))) < .25)
    if (atExit) continue
    const radius = 8.7 + Math.sin(i * 3) * .4
    const x = Math.cos(a) * radius, z = Math.sin(a) * radius
    if (i % 3 === 0) add(new T.DodecahedronGeometry(.22), '#9b9d7b', [x, .13, z], [1.5, .65, 1])
    else for (let j = 0; j < 3; j++) add(new T.ConeGeometry(.08, .32 + j * .08, 3), i % 2 ? '#768c4a' : '#899951', [x + j * .10, .18, z], [1, 1, 1], [0, i, j * .1])
  }
  for (const [x, z] of [[-5.8, 2.8], [4.8, 4.5], [-2, 6.4], [6.7, 1.5]]) {
    add(new T.CylinderGeometry(.27, .35, .24, 7), '#b69b69', [x, .16, z])
    add(new T.CylinderGeometry(.23, .23, .035, 7), '#d4b984', [x, .30, z])
  }
  const geometry = mergeGeometries(pieces)!
  pieces.forEach(piece => piece.dispose())
  scene.add(new T.Mesh(geometry, new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, side: T.DoubleSide })))
}
