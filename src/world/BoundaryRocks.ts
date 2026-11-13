import * as T from 'three'
import { zones, zoneOutline } from '../config/zones'

export interface RockBoundary { a: { x: number; z: number }; b: { x: number; z: number }; radius: number }

/** Continuous low cliff plinths close the gaps beneath overlapping boulders. */
export function boundaryRocks(scene: T.Scene): RockBoundary[] {
  const segments: (RockBoundary & { color: string })[] = []
  const colors = ['#62765d', '#825848', '#645572']
  for (const [index, zone] of zones.entries()) {
    const points = zoneOutline(zone)
    for (let i = 2; i < points.length; i++) segments.push({ a: points[i - 1], b: points[i], radius: 1.05, color: colors[index] })
    // Each shared radial edge is built once. All entrances at the hub stay open.
    const end = points[1], length = Math.hypot(end.x, end.z)
    segments.push({ a: { x: end.x / length * 11.5, z: end.z / length * 11.5 }, b: end, radius: 1.05, color: colors[index] })
  }
  const samples: { x: number; z: number; angle: number; color: string }[] = []
  const material = new T.MeshStandardMaterial({ roughness: 1, flatShading: true })
  const foundations = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), material, segments.length)
  const transform = new T.Object3D(), tint = new T.Color()
  segments.forEach(({ a, b, color }, i) => {
    const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz)
    const angle = -Math.atan2(dz, dx)
    transform.position.set((a.x + b.x) / 2, .10, (a.z + b.z) / 2)
    transform.rotation.set(0, angle, 0)
    transform.scale.set(length + .5, .95, 2.05)
    transform.updateMatrix();foundations.setMatrixAt(i, transform.matrix)
    foundations.setColorAt(i, tint.set(color).multiplyScalar(.86))
    const count = Math.ceil(length / 1.25)
    // Include endpoints so adjacent segments join under a common boulder.
    for (let j = 0; j <= count; j++) samples.push({ x: T.MathUtils.lerp(a.x, b.x, j / count), z: T.MathUtils.lerp(a.z, b.z, j / count), angle, color })
  })
  const boulders = new T.InstancedMesh(new T.DodecahedronGeometry(1, 0), material, samples.length)
  samples.forEach((p, i) => {
    const height = 1.05 + (Math.sin(i * 4.17) * .5 + .5) * .65
    transform.position.set(p.x, height * .50, p.z)
    transform.rotation.set(Math.sin(i * 2.1) * .13, p.angle + Math.sin(i * 7.3) * .35, Math.cos(i * 1.7) * .14)
    transform.scale.set(1.48 + (i % 3) * .09, height, 1.43)
    transform.updateMatrix();boulders.setMatrixAt(i, transform.matrix)
    boulders.setColorAt(i, tint.set(p.color).multiplyScalar(.91 + (i % 5) * .045))
  })
  foundations.computeBoundingSphere();boulders.computeBoundingSphere()
  scene.add(foundations, boulders)
  return segments
}
