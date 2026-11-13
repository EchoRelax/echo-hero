import * as T from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { contactShadow } from '../effects/SceneLook'
import type { BossModel } from './RootGuardianModel'

type Pose = 'Idle' | 'Walk' | 'Attack'
const hitColor = new T.Color('#774120')

export class GolemModel implements BossModel {
  private static asset: GLTF

  static async preload() {
    const asset = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/golem.glb?v=6k-rig-1`)
    for (const name of ['Idle', 'Walk', 'Attack']) {
      if (!asset.animations.some(clip => clip.name === name)) throw new Error(`Golem animation ${name} is missing`)
    }
    this.asset = asset
  }

  readonly root = new T.Group()
  private mixer: T.AnimationMixer
  private actions = new Map<Pose, T.AnimationAction>()
  private surfaces: { material: T.MeshStandardMaterial; emissive: T.Color }[] = []
  private current: Pose = 'Idle'

  constructor(height = 1.5, shadow = true) {
    if (!GolemModel.asset) throw new Error('Golem asset must be loaded before starting the game')
    // SkeletonUtils gives each enemy its own bones; geometry and textures stay shared.
    const model = clone(GolemModel.asset.scene)
    const bounds = new T.Box3().setFromObject(model)
    const scale = height / (bounds.max.y - bounds.min.y)
    const center = bounds.getCenter(new T.Vector3())
    const visual = new T.Group()
    visual.scale.setScalar(scale)
    model.position.sub(new T.Vector3(center.x, bounds.min.y, center.z))
    visual.add(model)
    this.root.add(visual)
    if (shadow) this.root.add(contactShadow(height * .4))
    const materials = new Map<T.Material, T.Material>()
    model.traverse(node => {
      if (!(node instanceof T.Mesh)) return
      node.frustumCulled = false
      const copy = (source: T.Material) => {
        let material = materials.get(source)
        if (!material) {
          material = source.clone()
          materials.set(source, material)
          if (material instanceof T.MeshStandardMaterial) {
            material.roughness = Math.max(.65, material.roughness)
            this.surfaces.push({ material, emissive: material.emissive.clone() })
          }
        }
        return material
      }
      node.material = Array.isArray(node.material) ? node.material.map(copy) : copy(node.material)
    })
    this.mixer = new T.AnimationMixer(model)
    for (const clip of GolemModel.asset.animations) {
      const action = this.mixer.clipAction(clip)
      if (clip.name === 'Attack') action.setLoop(T.LoopOnce, 1).clampWhenFinished = true
      action.play().setEffectiveWeight(clip.name === 'Idle' ? 1 : 0)
      this.actions.set(clip.name as Pose, action)
    }
  }

  animate(_time: number, charge: number, impact: number, _enraged: boolean, hit: boolean, moving = false, _casting = false, dt = 0) {
    const striking = charge > 0 || impact > 0
    const name: Pose = striking ? 'Attack' : moving ? 'Walk' : 'Idle'
    const action = this.actions.get(name)!
    if (name !== this.current) {
      action.reset().play()
      this.current = name
    }
    action.paused = striking
    if (striking) {
      // Authored impact is at 64%: match the combat windup and recovery exactly.
      action.time = action.getClip().duration * (impact > 0 ? .64 + (1 - impact) * .36 : charge * .64)
    }
    for (const [pose, candidate] of this.actions) {
      candidate.setEffectiveWeight(striking || dt === 0 ? Number(pose === name)
        : T.MathUtils.damp(candidate.getEffectiveWeight(), Number(pose === name), 12, dt))
    }
    this.mixer.update(dt)
    for (const { material, emissive } of this.surfaces) material.emissive.copy(hit ? hitColor : emissive)
  }
}
