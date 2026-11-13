import * as T from 'three'
import type { BossModel } from './RootGuardianModel'
import { ForestAssets } from '../world/ForestAssets'
import { contactShadow } from '../effects/SceneLook'
import { clone } from 'three/addons/utils/SkeletonUtils.js'

export class TreantModel implements BossModel {
  readonly root = new T.Group()
  private mixer: T.AnimationMixer
  private actions = new Map<string, T.AnimationAction>()
  private surfaces: T.MeshStandardMaterial[] = []
  private current = 'Idle'

  constructor() {
    const asset = {scene:clone(ForestAssets.treant.scene),animations:ForestAssets.treant.animations}
    this.root.add(asset.scene, contactShadow(1.2))
    this.mixer = new T.AnimationMixer(asset.scene)
    for (const clip of asset.animations) this.actions.set(clip.name, this.mixer.clipAction(clip).play().setEffectiveWeight(clip.name === 'Idle' ? 1 : 0))
    asset.scene.traverse(node => {
      if (!(node instanceof T.Mesh)) return
      node.frustumCulled = false
      node.material=Array.isArray(node.material)?node.material.map(m=>m.clone()):node.material.clone()
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        if (material instanceof T.MeshStandardMaterial) this.surfaces.push(material)
      }
    })
  }

  animate(_time: number, charge: number, impact: number, _enraged: boolean, hit: boolean, moving = false, casting = false, dt = 0) {
    const striking = charge > 0 || impact > 0
    const name = striking ? (casting ? 'Cast' : 'Melee') : moving ? 'Walk' : 'Idle'
    const action = this.actions.get(name)!
    if (name !== this.current) { action.reset().play(); this.current = name }
    if (striking) {
      action.paused = true
      action.time = action.getClip().duration * (impact > 0 ? .665 + (1 - impact) * .335 : charge * .665)
    } else action.paused = false
    for (const [clip, candidate] of this.actions) candidate.setEffectiveWeight(T.MathUtils.damp(candidate.getEffectiveWeight(), clip === name ? 1 : 0, striking ? 24 : 10, dt))
    this.mixer.update(dt)
    for (const material of this.surfaces) material.emissive.set(hit ? '#774120' : '#000000')
  }
}
