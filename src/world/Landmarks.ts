import * as T from 'three'
import { camps } from '../config/camps'
import type { ZoneId } from '../config/zones'
import type { SceneryShadows } from '../effects/SceneLook'

type Camp = typeof camps[number]
type PropKind = 'box' | 'stone' | 'pillar' | 'crystal'
type Place = (kind: PropKind, color: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, yaw?: number, tilt?: number) => void

const geometry = {
  box: new T.BoxGeometry(1, 1, 1),
  stone: new T.DodecahedronGeometry(1),
  pillar: new T.CylinderGeometry(0.38, 0.53, 1, 6),
  crystal: new T.OctahedronGeometry(1),
}
const material = new T.MeshStandardMaterial({ roughness: 0.93, flatShading: true })
const wood = '#8e583c', plank = '#cf8e55', gold = '#f5bd60'
const jade = '#648d74', stone = '#8c879a', violet = '#655981', ice = '#8ddbf8'

function dressCamp(camp: Camp, place: Place) {
  switch (camp.id) {
    case 'brook':
      for (const x of [-1.0, 0, 1.0]) place('pillar', wood, x, 0.49, 0, 0.24, 0.98, 0.24)
      place('box', plank, 0, 0.62, 0, 2.32, 0.16, 0.15)
      place('box', wood, 0, 0.31, 0, 2.32, 0.14, 0.13)
      place('pillar', plank, 1.26, 0.33, -0.43, 0.62, 0.66, 0.62)
      place('pillar', wood, 1.26, 0.44, -0.43, 0.63, 0.09, 0.63)
      break
    case 'fern':
      for (const x of [-0.9, 0.9]) place('box', wood, x, 0.79, 0, 0.21, 1.58, 0.21)
      place('box', '#d67b56', 0, 1.57, 0, 2.13, 0.20, 0.83, 0, 0.08)
      place('box', '#f5b06a', -0.28, 1.66, 0, 0.45, 0.04, 0.81)
      place('box', plank, 0.63, 0.27, -0.13, 0.63, 0.54, 0.57, 0.25)
      break
    case 'briar':
      place('stone', jade, 0, 0.34, 0, 1.01, 0.43, 0.82)
      place('pillar', '#8baf88', 0, 0.91, 0, 0.96, 1.22, 0.89, 0.31)
      place('crystal', '#c8f58a', 0.04, 1.47, 0.07, 0.27, 0.47, 0.21, 0.45)
      place('stone', '#527b63', -0.91, 0.28, 0.29, 0.47, 0.34, 0.48)
      break
    case 'ironbark':
      place('box', wood, 0, 0.59, 0, 1.72, 0.47, 1.01)
      for (const x of [-0.56, 0.56]) place('pillar', '#584444', x, 0.31, 0.56, 0.69, 0.18, 0.69, 0, Math.PI / 2)
      place('box', plank, 0.32, 0.92, 0, 0.60, 0.36, 0.65, 0.24)
      place('box', gold, 0.32, 0.93, 0.30, 0.16, 0.15, 0.04, 0.24)
      break
    case 'embers':
      for (const [x, y, z] of [[-0.75, 0.58, 0], [0.02, 1.13, -0.16], [0.58, 0.71, 0.36]]) {
        place('stone', '#a65e4d', x, y * 0.54, z, 0.57, y * 0.74, 0.52, x)
        place('crystal', '#ff9a52', x + 0.08, y, z, 0.18, y * 0.37, 0.16, 0.5)
      }
      break
    case 'quarry':
      for (const x of [-0.85, 0.85]) place('box', wood, x, 0.77, 0, 0.23, 1.54, 0.26, 0, x * 0.13)
      place('box', plank, 0, 1.47, 0, 2.02, 0.25, 0.26)
      place('box', '#d79d71', -0.32, 0.19, 0.34, 0.85, 0.36, 0.63, 0.26)
      place('stone', '#9e5d52', 0.69, 0.28, -0.31, 0.42, 0.33, 0.44)
      break
    case 'basalt':
      for (const [x, y, z] of [[-0.59, 0.73, 0.25], [0.03, 1.45, -0.03], [0.64, 1.01, 0.22]]) {
        place('pillar', '#624353', x, y * 0.5, z, 0.77, y, 0.77, x)
        place('box', '#e18b61', x + 0.10, y * 0.64, z + 0.38, 0.09, y * 0.36, 0.025, 0, x * 0.35)
      }
      break
    case 'kiln':
      place('stone', '#7e4848', 0, 0.77, 0, 1.04, 0.87, 0.79)
      place('stone', '#4e3540', 0, 0.51, 0.62, 0.46, 0.44, 0.22)
      place('crystal', '#ff9c52', 0, 0.53, 0.78, 0.28, 0.27, 0.12)
      place('pillar', '#ae6858', 0.42, 1.43, -0.26, 0.44, 0.71, 0.44, 0, 0.18)
      break
    case 'spire':
      place('pillar', stone, 0.08, 0.90, 0, 0.82, 1.93, 0.82, 0.4, -0.41)
      place('crystal', ice, 0.38, 1.48, 0.02, 0.29, 0.57, 0.27, 0.54, -0.44)
      place('stone', violet, -0.87, 0.25, 0.37, 0.46, 0.33, 0.42)
      break
    case 'conduit':
      for (const x of [-0.7, 0.7]) {
        place('pillar', violet, x, 0.55, 0, 0.59, 1.10, 0.62, 0.33)
        place('crystal', '#a7a1ff', x, 1.11, 0, 0.25, 0.42, 0.25)
      }
      place('box', ice, 0, 0.62, 0, 1.21, 0.08, 0.12)
      break
    case 'ring':
      for (const x of [-0.69, 0.69]) {
        place('stone', stone, x, 0.23, 0, 0.58, 0.29, 0.57)
        place('crystal', ice, x, 0.78, 0, 0.25, 0.66, 0.22, x, x * 0.42)
      }
      place('crystal', '#dd92fc', 0, 1.21, 0.12, 0.33, 0.78, 0.28, 0.7)
      break
    case 'crown':
      place('box', violet, 0, 0.29, 0, 1.74, 0.58, 0.94, 0.15)
      place('pillar', stone, 0, 0.69, 0, 1.43, 0.29, 1.19)
      for (const x of [-0.54, 0, 0.54]) place('crystal', x ? '#dd91ed' : '#9feaff', x, x ? 1.02 : 1.39, 0, 0.25, x ? 0.42 : 0.64, 0.25, 0.31, -x * 0.42)
      break
  }
}

export class Landmarks {
  constructor(scene: T.Scene, shadows: SceneryShadows, blocked: (x: number, z: number, radius: number) => boolean, block: (x: number, z: number, radius: number) => void) {
    const stamps = new Map<string, { kind: PropKind; poses: T.Matrix4[]; colors: T.Color[] }>()
    const pose = new T.Object3D()
    const add = (zone: ZoneId, kind: PropKind, color: string) => {
      const key = `${zone}-${kind}`
      let batch = stamps.get(key)
      if (!batch) {
        batch = { kind, poses: [], colors: [] }
        stamps.set(key, batch)
      }
      pose.updateMatrix()
      batch.poses.push(pose.matrix.clone())
      batch.colors.push(new T.Color(color))
    }
    for (const camp of camps) {
      const side = Math.sign(camp.x || 1)
      const candidates = [[camp.x + side * 6.2, camp.z + 0.9], [camp.x + side * 5.9, camp.z - 3.4], [camp.x + side * 4.9, camp.z + 5.5]]
      const point = candidates.find(([x, z]) => !blocked(x, z, 1.1))
      if (!point) continue
      const [x, z] = point
      dressCamp(camp, (kind, color, dx, y, dz, sx, sy, sz, yaw = 0, tilt = 0) => {
        pose.position.set(x + dx * side, y, z + dz)
        pose.rotation.set(0, yaw * side, tilt * side)
        pose.scale.set(sx, sy, sz)
        add(camp.zone, kind, color)
      })
      block(x, z, 0.78)
      shadows.cast(x, z, 1.05, 1.65)
    }
    for (const batch of stamps.values()) {
      const props = new T.InstancedMesh(geometry[batch.kind], material, batch.poses.length)
      batch.poses.forEach((matrix, index) => {
        props.setMatrixAt(index, matrix)
        props.setColorAt(index, batch.colors[index])
      })
      scene.add(props)
    }
  }
}
