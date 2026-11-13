import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { camps } from '../config/camps'
import { insideZone, radialPoint, zonePoint, type Zone } from '../config/zones'

/** Small authored compositions between hunting areas; merged into two meshes. */
export function biomeLandmarks(scene: T.Scene, zone: Zone, block: (x: number, z: number, radius: number) => void) {
  const pieces: T.BufferGeometry[] = [], glows: T.BufferGeometry[] = []
  const transform = new T.Object3D()
  function add(geometry: T.BufferGeometry, color: string, x: number, y: number, z: number, scale: number[], rotation: number[] = [0, 0, 0], glow = false) {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry.clone()
    geometry.dispose();flat.deleteAttribute('uv')
    transform.position.set(x, y, z);transform.scale.set(scale[0], scale[1], scale[2]);transform.rotation.set(rotation[0], rotation[1], rotation[2]);transform.updateMatrix()
    flat.applyMatrix4(transform.matrix)
    const colors = new Float32Array(flat.getAttribute('position').count * 3), tint = new T.Color(color)
    for (let i = 0; i < colors.length; i += 3) tint.toArray(colors, i)
    flat.setAttribute('color', new T.BufferAttribute(colors, 3));(glow ? glows : pieces).push(flat)
  }
  const boss = zonePoint(zone, 0, zone.arena)
  const candidates = [[-18, 23], [19, 29], [-20, 40], [18, 49], [8, 20], [-13, 58], [22, 37], [-20, 52]]
  for (const [i, [side, depth]] of candidates.entries()) {
    const p = radialPoint(zone, side, depth)
    if (!insideZone(p.x, p.z, zone, 3) || Math.hypot(p.x - boss.x, p.z - boss.z) < 10 || camps.some(c => Math.hypot(c.x - p.x, c.z - p.z) < 8)) continue
    const { x, z } = p
    if (zone.id === 'valley') {
      // Fallen trunk, exposed cut face, mushrooms and a loose stone circle.
      add(new T.CylinderGeometry(.34, .43, 3.4, 7), '#76513b', x, .38, z, [1, 1, 1], [Math.PI / 2, 0, i * .7])
      add(new T.CylinderGeometry(.30, .30, .04, 7), '#ca9d63', x, .39, z + 1.72, [1, 1, 1], [Math.PI / 2, 0, 0])
      block(x, z, .6)
      for (let j = 0; j < 5; j++) {
        const a = j * 1.9, mx = x + Math.sin(a) * 1.9, mz = z + Math.cos(a) * 1.5
        add(new T.CylinderGeometry(.04, .07, .35, 5), '#d9c695', mx, .18, mz, [1, 1, 1])
        add(new T.ConeGeometry(.23, .15, 7), j % 2 ? '#e7b66f' : '#bf6436', mx, .40, mz, [1, 1, 1])
        add(new T.DodecahedronGeometry(.22), '#a3aa77', mx + .25, .10, mz + .4, [1.4, .6, 1])
      }
    } else if (zone.id === 'canyon') {
      // Layered basalt outcrops stand apart from open cracked clay flats.
      for (let j = 0; j < 4; j++) {
        const px = x + (j - 1.5) * .8, pz = z + Math.sin(j * 2) * .6, height = .8 + (j + i) % 3 * .65
        add(new T.CylinderGeometry(.42, .61, height, 5), j % 2 ? '#8e5444' : '#604448', px, height / 2, pz, [1, 1, 1], [.03, j * .6, .08])
        add(new T.CylinderGeometry(.43, .43, .09, 5), '#bb825c', px, height * .7, pz, [1, 1, 1], [0, j * .6, 0])
        block(px, pz, .5)
      }
      for (let j = 0; j < 5; j++) {
        add(new T.BoxGeometry(1, 1, 1), '#684538', x - 2 + j * .7, .018, z + 2 + Math.sin(j) * .35, [.8, .018, .06], [0, Math.sin(j) * .5, 0])
        add(new T.DodecahedronGeometry(.25), '#d79c69', x + j * .7 - 1.5, .13, z - 1.8, [1.4, .4, 1])
      }
    } else {
      // Broken gateways remain walkable through the middle; scattered crystals.
      for (const sign of [-1, 1]) {
        add(new T.BoxGeometry(1, 1, 1), '#716584', x + sign * 1.05, 1.15, z, [.63, 2.3, .72], [0, i * .08, sign * -.04])
        add(new T.BoxGeometry(1, 1, 1), '#a394b1', x + sign * 1.05, .23, z, [.94, .40, 1.0])
        add(new T.BoxGeometry(1, 1, 1), '#a6c5d3', x + sign * 1.05, 1.25, z + .38, [.08, .52, .025], [0, 0, 0], true)
        block(x + sign * 1.05, z, .47)
      }
      add(new T.BoxGeometry(1, 1, 1), '#9585aa', x + .25, 2.42, z, [2.4, .40, .8], [0, 0, -.08])
      add(new T.BoxGeometry(1, 1, 1), '#776780', x - 1.7, .22, z + 2.3, [1.7, .42, .65], [0, -.8, .08])
      for (let j = 0; j < 5; j++) {
        add(new T.OctahedronGeometry(1), j % 2 ? '#8d91ce' : '#82b9c5', x + 2.4 + Math.sin(j * 2) * .7, .35, z + Math.cos(j * 2) * .7, [.16, .45 + j * .08, .18], [.2, j, .2])
      }
    }
  }
  for (const [i, parts] of [pieces, glows].entries()) {
    if (!parts.length) continue
    const geometry = mergeGeometries(parts)!
    parts.forEach(part => part.dispose())
    scene.add(new T.Mesh(geometry, i ? new T.MeshBasicMaterial({ vertexColors: true }) : new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 })))
  }
}
