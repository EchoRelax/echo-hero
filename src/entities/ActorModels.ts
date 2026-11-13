import * as T from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { EnemyDefinition } from '../config/balance'
import { contactShadow, contour } from '../effects/SceneLook'
import { GolemModel } from './GolemModel'

const box = new T.BoxGeometry(1, 1, 1)
const gem = new T.IcosahedronGeometry(1, 0)
const orb = new T.SphereGeometry(1, 12, 6)

function material(color: string) {
  return new T.MeshStandardMaterial({ color, flatShading: true })
}

function part(parent: T.Group, geometry: T.BufferGeometry, surface: T.Material, position: number[], size: number[]) {
  const mesh = new T.Mesh(geometry, surface)
  mesh.position.set(position[0], position[1], position[2])
  mesh.scale.set(size[0], size[1], size[2])
  parent.add(mesh)
  return mesh
}

export class EnemyModel {
  private static assets = new Map<string, T.Group>()

  static async preload() {
    const loader = new GLTFLoader()
    await Promise.all([GolemModel.preload(), ...[['slime', 'slime'], ['beetle', 'bug'], ['imp', 'chaosbes'], ['wisp', 'stormwisp']].map(async ([kind, file]) => {
      const asset = await loader.loadAsync(`${import.meta.env.BASE_URL}models/${file}.glb?v=${kind === 'wisp' ? '4k-2' : kind === 'imp' ? '6k-1' : '3500-1'}`)
      if (kind === 'imp' || kind === 'wisp') {
        const bounds = new T.Box3().setFromObject(asset.scene)
        const center = bounds.getCenter(new T.Vector3())
        const size = (kind === 'wisp' ? 1.8 : 1.65) / (bounds.max.y - bounds.min.y)
        asset.scene.position.sub(new T.Vector3(center.x, bounds.min.y, center.z)).multiplyScalar(size)
        asset.scene.scale.multiplyScalar(size)
      }
      EnemyModel.assets.set(kind, asset.scene)
    })])
  }

  readonly root = new T.Group()
  private body = new T.Group()
  private skin: T.MeshStandardMaterial
  private importedSkins: T.MeshStandardMaterial[] = []
  private golem?: GolemModel

  constructor(private config: EnemyDefinition) {
    this.skin = material(config.color)
    this.root.add(contactShadow(0.52), this.body)
    if (config.model === 'guardian') {
      this.golem = new GolemModel(1.5, false)
      this.body.add(this.golem.root)
      return
    }
    const asset = EnemyModel.assets.get(config.model)
    if (asset) {
      const model = asset.clone(true)
      // Geometry and texture maps are shared; emissive hit flashes are per mob.
      const materials = new Map<T.Material, T.Material>()
      model.traverse(object => {
        if (!(object instanceof T.Mesh)) return
        const copy = (source: T.Material) => {
          let clone = materials.get(source)
          if (!clone) {
            clone = source.clone()
            materials.set(source, clone)
            if (clone instanceof T.MeshStandardMaterial) {
              clone.roughness = Math.max(0.65, clone.roughness)
              if (clone.map) clone.map.anisotropy = 2
              this.importedSkins.push(clone)
            }
          }
          return clone
        }
        object.material = Array.isArray(object.material) ? object.material.map(copy) : copy(object.material)
      })
      this.body.add(model)
      return
    }
    if (config.model !== 'slime') {
      this.variant()
      return
    }
    contour(part(this.body, orb, this.skin, [0, 0.55, 0], [0.8, 0.58, 0.66]))
    const leaf = material('#477842')
    part(this.body, gem, leaf, [0.15, 1.15, 0], [0.2, 0.36, 0.13]).rotation.z = -0.55
    part(this.body, gem, leaf, [-0.15, 1.11, -0.06], [0.17, 0.31, 0.12]).rotation.z = 0.72
    const face = material('#203f32')
    const eye = material('#fff8c8')
    for (const x of [-0.25, 0.25]) {
      part(this.body, gem, eye, [x, 0.68, 0.54], [0.17, 0.19, 0.11])
      part(this.body, gem, face, [x, 0.67, 0.63], [0.073, 0.105, 0.045])
    }
    part(this.body, box, face, [0, 0.4, 0.635], [0.19, 0.055, 0.035])
  }

  private variant() {
    const shell = material('#373141')
    const spark = material(this.config.model === 'wisp' ? '#b9f6ff' : '#ffcb81')
    const kind = this.config.model
    const shape = kind === 'guardian' ? box : gem
    const core = part(this.body, shape, this.skin, [0, kind === 'wisp' ? 0.9 : 0.58, 0], [0.71, 0.61, 0.74])
    if (kind !== 'beetle') contour(core)
    part(this.body, gem, spark, [0, 0.76, 0.59], [0.19, 0.16, 0.15])
    for (const side of [-1, 1]) {
      if (kind === 'beetle') {
        contour(part(this.body, orb, this.skin, [side * 0.32, 0.64, -0.05], [0.43, 0.41, 0.71]))
        for (const z of [-0.44, 0, 0.42]) part(this.body, box, shell, [side * 0.61, 0.23, z], [0.37, 0.13, 0.15]).rotation.z = side * -0.41
      } else {
        part(this.body, shape, shell, [side * 0.62, 0.51, -0.03], [0.26, 0.38, 0.27])
        part(this.body, gem, spark, [side * 0.41, 1.08, -0.04], [0.14, 0.33, 0.15]).rotation.z = -side * 0.38
      }
    }
  }

  animate(time: number, moving: boolean, charge: number, hit: number, defeat: number, impact = 0, dt = 0) {
    this.root.visible = defeat < 1
    this.root.scale.setScalar(1 - defeat)
    if (this.golem) {
      this.golem.animate(time, charge, impact, false, hit > 0, moving, false, dt)
      return
    }
    const pulse = Math.sin(time * (moving ? 13 : 4))
    const beetle = this.config.model === 'beetle'
    const floating = this.config.model === 'wisp' || this.config.model === 'imp'
    this.body.position.y = floating ? 0.21 + pulse * 0.12 : moving ? Math.max(0, pulse) * (beetle ? 0.035 : 0.12) : 0
    this.body.position.z = impact * 0.24 - charge * 0.13
    this.body.rotation.x = impact * 0.27 - charge * 0.18
    const size = this.config.model === 'guardian' ? 0.78 : 0.70
    const bounce = floating ? .02 : beetle ? .025 : .09
    const squash = floating ? .04 : .18
    this.body.scale.set(size * (1 + charge * 0.13), size * (1 + pulse * bounce - charge * squash), size * (1 + charge * 0.13))
    this.skin.emissive.set(hit > 0 ? '#f38942' : '#000000')
    for (const skin of this.importedSkins) skin.emissive.set(hit > 0 ? '#f38942' : '#000000')
  }
}

