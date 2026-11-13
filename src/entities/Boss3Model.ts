import * as T from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { contactShadow } from '../effects/SceneLook'

export type StormPose = 'Hover' | 'Fly' | 'Melee' | 'VortexCast' | 'StormCast' | 'StormChannel'
const poses: StormPose[] = ['Hover','Fly','Melee','VortexCast','StormCast','StormChannel']
const flash = new T.Color('#7f75aa'), energy = new T.Color('#305fba')

export class Boss3Model {
  private static asset: GLTF
  static async preload() {
    const asset=await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/boss3.glb?v=8k-storm-1`)
    for(const pose of poses)if(!asset.animations.some(c=>c.name===pose))throw Error(`Boss3 animation ${pose} is missing`)
    this.asset=asset
  }

  readonly root=new T.Group()
  private mixer:T.AnimationMixer
  private actions=new Map<StormPose,T.AnimationAction>()
  private current:StormPose='Hover'
  private surfaces:{material:T.MeshStandardMaterial;emissive:T.Color}[]=[]

  constructor() {
    if(!Boss3Model.asset)throw Error('Boss3 must be loaded before starting the game')
    const model=clone(Boss3Model.asset.scene),visual=new T.Group()
    const bounds=new T.Box3().setFromObject(model),center=bounds.getCenter(new T.Vector3())
    visual.scale.setScalar(3.5/(bounds.max.y-bounds.min.y));visual.position.y=.4
    model.position.sub(new T.Vector3(center.x,bounds.min.y,center.z));visual.add(model)
    this.root.add(visual,contactShadow(1.1))
    model.traverse(node=>{
      if(!(node instanceof T.Mesh))return
      node.frustumCulled=false
      const copy=(source:T.Material)=>{
        const material=source.clone()
        if(material instanceof T.MeshStandardMaterial)this.surfaces.push({material,emissive:material.emissive.clone()})
        return material
      }
      node.material=Array.isArray(node.material)?node.material.map(copy):copy(node.material)
    })
    this.mixer=new T.AnimationMixer(model)
    for(const clip of Boss3Model.asset.animations) {
      const action=this.mixer.clipAction(clip).play().setEffectiveWeight(clip.name==='Hover'?1:0)
      if(!['Hover','Fly','StormChannel'].includes(clip.name)){action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true}
      this.actions.set(clip.name as StormPose,action)
    }
  }

  pose(name:StormPose,progress:number,dt:number,hit=false,power=0) {
    const action=this.actions.get(name)!
    if(name!==this.current){action.reset().play();this.current=name}
    const looping=['Hover','Fly','StormChannel'].includes(name)
    action.paused=!looping
    if(!looping)action.time=T.MathUtils.clamp(progress,0,1)*action.getClip().duration
    for(const [pose,candidate] of this.actions) {
      const target=Number(pose===name)
      candidate.setEffectiveWeight(!looping||dt===0?target:T.MathUtils.damp(candidate.getEffectiveWeight(),target,16,dt))
    }
    this.mixer.update(dt)
    for(const {material,emissive} of this.surfaces){material.emissive.copy(hit?flash:emissive);if(!hit)material.emissive.lerp(energy,power*.12)}
  }
}
