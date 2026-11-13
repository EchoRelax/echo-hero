import * as T from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { contactShadow } from '../effects/SceneLook'
import type { BossModel } from './RootGuardianModel'

export type StonePose = 'Idle' | 'Walk' | 'Melee' | 'GroundSlam' | 'Charge' | 'WaveRelease'
const poses: StonePose[] = ['Idle', 'Walk', 'Melee', 'GroundSlam', 'Charge', 'WaveRelease']
const flash = new T.Color('#b7774b'), energy = new T.Color('#148c99')

export class Boss2Model implements BossModel {
  private static asset: GLTF
  static async preload() {
    const asset = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/boss2.glb?v=8k-stone-2`)
    for (const name of poses) if (!asset.animations.some(clip => clip.name === name)) throw Error(`Boss2 animation ${name} is missing`)
    this.asset = asset
  }

  readonly root = new T.Group()
  private mixer: T.AnimationMixer
  private actions = new Map<StonePose, T.AnimationAction>()
  private current: StonePose = 'Idle'
  private surfaces: { material: T.MeshStandardMaterial; emissive: T.Color }[] = []

  constructor() {
    if (!Boss2Model.asset) throw Error('Boss2 must be loaded before starting the game')
    const model = clone(Boss2Model.asset.scene), visual = new T.Group()
    const bounds = new T.Box3().setFromObject(model), center = bounds.getCenter(new T.Vector3())
    visual.scale.setScalar(3.5 / (bounds.max.y - bounds.min.y))
    model.position.sub(new T.Vector3(center.x, bounds.min.y, center.z))
    visual.add(model);this.root.add(visual, contactShadow(1.3))
    model.traverse(node => {
      if (!(node instanceof T.Mesh)) return
      node.frustumCulled = false
      const copy = (source: T.Material) => {
        const material = source.clone()
        if (material instanceof T.MeshStandardMaterial) this.surfaces.push({ material, emissive: material.emissive.clone() })
        return material
      }
      node.material = Array.isArray(node.material) ? node.material.map(copy) : copy(node.material)
    })
    this.mixer = new T.AnimationMixer(model)
    for (const clip of Boss2Model.asset.animations) {
      const action = this.mixer.clipAction(clip).play().setEffectiveWeight(clip.name === 'Idle' ? 1 : 0)
      if (clip.name !== 'Idle' && clip.name !== 'Walk') { action.setLoop(T.LoopOnce, 1);action.clampWhenFinished = true }
      this.actions.set(clip.name as StonePose, action)
    }
  }

  pose(name: StonePose, progress: number, dt: number, hit = false, charge = 0) {
    const action = this.actions.get(name)!
    if (name !== this.current) { action.reset().play();this.current = name }
    const looping = name === 'Idle' || name === 'Walk'
    action.paused = !looping
    if (!looping) action.time = T.MathUtils.clamp(progress, 0, 1) * action.getClip().duration
    for (const [pose, candidate] of this.actions) {
      const weight = Number(pose === name)
      // Sampled attack poses must land on the combat event, with no blend delay.
      candidate.setEffectiveWeight(!looping || dt === 0 ? weight : T.MathUtils.damp(candidate.getEffectiveWeight(), weight, 14, dt))
    }
    this.mixer.update(dt)
    for (const { material, emissive } of this.surfaces) {
      material.emissive.copy(hit ? flash : emissive)
      if (!hit) material.emissive.lerp(energy, charge * .12)
    }
  }

  animate(_time: number, charge: number, impact: number, _enraged: boolean, hit: boolean, moving = false, casting = false, dt = 0) {
    const striking = charge > 0 || impact > 0
    const contact = casting ? .64 : .62
    this.pose(striking ? casting ? 'GroundSlam' : 'Melee' : moving ? 'Walk' : 'Idle',
      impact > 0 ? contact + (1 - impact) * (1 - contact) : charge * contact, dt, hit)
  }
}
