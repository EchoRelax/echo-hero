import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const bark = ['#795039', '#966342', '#ae7750', '#6b4534']
const foliage = ['#ed6324', '#ff8330', '#d94a19', '#fba13f', '#bb3b19']

/** Faceted bark, folded leaves and hanging moss; no bitmap textures. */
export function treeGeometry(variant: number) {
  const pieces: T.BufferGeometry[] = []
  let seed = 137 + variant * 971
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
  function colored(geometry: T.BufferGeometry, palette: string[]) {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry
    if (flat !== geometry) geometry.dispose()
    flat.deleteAttribute('uv')
    const colors = new Float32Array(flat.getAttribute('position').count * 3)
    const color = new T.Color()
    for (let i = 0; i < colors.length; i += 9) {
      color.set(palette[Math.floor(random() * palette.length)])
      for (let j = 0; j < 3; j++) color.toArray(colors, i + j * 3)
    }
    flat.setAttribute('color', new T.BufferAttribute(colors, 3))
    flat.computeVertexNormals()
    pieces.push(flat)
  }
  function limb(points: number[][], radii: number[], palette = bark, sides = 6) {
    const vertices: number[] = []
    const rings = points.map((p, i) => {
      const axis = new T.Vector3().fromArray(points[Math.min(i + 1, points.length - 1)]).sub(new T.Vector3().fromArray(points[Math.max(0, i - 1)])).normalize()
      const rotation = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), axis)
      return Array.from({ length: sides }, (_, j) => {
        const angle = j / sides * Math.PI * 2 + i * .19
        return new T.Vector3(Math.cos(angle) * radii[i], 0, Math.sin(angle) * radii[i]).applyQuaternion(rotation).add(new T.Vector3().fromArray(p))
      })
    })
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < sides; j++) {
      const k = (j + 1) % sides
      for (const v of [rings[i][j], rings[i + 1][j], rings[i][k], rings[i][k], rings[i + 1][j], rings[i + 1][k]]) vertices.push(v.x, v.y, v.z)
    }
    const geometry = new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(vertices, 3))
    colored(geometry, palette)
  }
  const twist = variant * .12
  limb([[0, .06, 0], [-.15, .55, .02], [.12, 1.15, -.08], [-.1, 1.75, 0], [.1 + twist, 2.28, .02], [.05, 2.85, .04]], [.43, .34, .27, .22, .16, .055])
  // Broad buttress roots spread across the soil with angular raised knuckles.
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2 + variant * .4
    const x = Math.cos(a), z = Math.sin(a)
    limb([[x * .15, .63, z * .15], [x * .43, .25, z * .42], [x * .78, .12, z * .72], [x * (1.03 + random() * .2), .025, z * 1.04]], [.17, .18, .11, .008])
    if (i % 2 === 0) limb([[x * .38, .32, z * .38], [x * .58, .21, z * .55], [x * .72, .08, z * .69]], [.10, .12, .01], ['#8b8d21', '#b2ad2c', '#747b22'], 3)
  }
  const clusters = [[-.99, 2.38, .05], [.9, 2.72, .1], [-.28, 3.1, -.12], [.55, 2.13, .67]]
  for (const [i, center] of clusters.entries()) {
    const [x, y, z] = center
    limb([[0, 1.25 + i * .18, 0], [x * .45, y - .58, z * .6], [x * .82, y - .23, z * .8], [x, y, z]], [.18, .14, .095, .025])
    // Each crown is a layered rosette of pointed, folded leaf silhouettes.
    for (let layer = 0; layer < 3; layer++) for (let j = 0; j < 7; j++) {
      const angle = j / 7 * Math.PI * 2 + layer * .48 + random() * .15
      const length = .43 + random() * .16
      const width = .23 + random() * .07
      const ring = layer === 2 ? .05 : .22 + layer * .10
      const vertices: number[] = []
      const border = [[0, -.14], [-.6, .05], [-.85, .32], [-.52, .43], [-.58, .70], [0, 1.12], [.58, .70], [.52, .43], [.85, .32], [.6, .05]]
      const transform = (u: number, v: number, height: number) => new T.Vector3(
        x + Math.cos(angle) * u * width + Math.sin(angle) * (v * length + ring),
        y + layer * .10 + height - v * .17,
        z - Math.sin(angle) * u * width + Math.cos(angle) * (v * length + ring),
      )
      const ridge = transform(0, .40, .08)
      for (let k = 0; k < border.length; k++) {
        const a = border[k], b = border[(k + 1) % border.length]
        for (const v of [ridge, transform(a[0], a[1], 0), transform(b[0], b[1], 0)]) vertices.push(v.x, v.y, v.z)
      }
      colored(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(vertices, 3)), [foliage[(i + layer) % foliage.length], foliage[(i + layer + 1) % foliage.length]])
    }
    for (let j = 0; j < 4; j++) {
      const offset = (j - 1.5) * .15
      limb([[x + offset, y - .08, z], [x + offset + .03, y - .35, z + .04], [x + offset - .02, y - .65 - random() * .23, z + .06]], [.085, .06, .001], ['#8d9020', '#b3ac2c', '#717821'], 3)
    }
  }
  // Shelf mushrooms with pale undersides, rooted stones, and a turquoise scar.
  for (let i = 0; i < 4; i++) {
    const mushroom = new T.CylinderGeometry(.14, .19, .055, 7).scale(1, 1, .65)
    mushroom.translate(i % 2 ? .30 : -.30, .42 + i * .22, .15)
    colored(mushroom, ['#efb36b', '#d87631', '#f6d09a'])
  }
  for (let i = 0; i < 4; i++) {
    const a = i * 2.15
    const stone = new T.DodecahedronGeometry(.16 + random() * .1, 0)
    stone.scale(1, .8, 1.1).translate(Math.sin(a) * .65, .1, Math.cos(a) * .65)
    colored(stone, ['#6e6970', '#93858a', '#a59791'])
  }
  limb([[.01, .8, .29], [.13, 1.08, .24], [-.02, 1.23, .23], [.07, 1.48, .22]], [.02, .025, .025, .01], ['#58cfbb', '#9ce6cb'], 3)
  const merged = mergeGeometries(pieces)
  for (const piece of pieces) piece.dispose()
  return merged
}

export function stylizedTrees(placements: { x: number; z: number; scale: number; angle: number }[]) {
  const group = new T.Group()
  const material = new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: T.DoubleSide })
  const transform = new T.Object3D()
  for (let variant = 0; variant < 3; variant++) {
    const instances = placements.filter((_, i) => i % 3 === variant)
    const batch = new T.InstancedMesh(treeGeometry(variant), material, instances.length)
    for (const [i, p] of instances.entries()) {
      transform.position.set(p.x, 0, p.z)
      transform.rotation.set(0, p.angle, 0)
      transform.scale.setScalar(p.scale)
      transform.updateMatrix()
      batch.setMatrixAt(i, transform.matrix)
    }
    batch.computeBoundingSphere()
    group.add(batch)
  }
  return group
}
