import * as T from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { contactShadow } from '../effects/SceneLook'

export type HeroPose = 'idle' | 'running' | 'attacking' | 'damaged' | 'dead'
type ClipName = 'Idle' | 'Run' | 'Attack' | 'Hit' | 'Death'
const clipNames: ClipName[] = ['Idle', 'Run', 'Attack', 'Hit', 'Death']

class SwordTrail {
  private geometry = new T.BufferGeometry()
  private surface = new T.MeshBasicMaterial({ color: '#fff4b4', transparent: true, side: T.DoubleSide, depthWrite: false, toneMapped: false })
  private mesh = new T.Mesh(this.geometry, this.surface)
  private samples = Array.from({ length: 10 }, () => ({ base: new T.Vector3(), tip: new T.Vector3() }))
  private cursor = 0
  private count = 0
  private life = 0
  private local = new T.Vector3()
  private inverse = new T.Matrix4()
  private positions = new T.BufferAttribute(new Float32Array(10 * 6), 3).setUsage(T.DynamicDrawUsage)

  constructor(private root: T.Group, private sword: T.Group) {
    const indices = []
    for (let i = 0; i < 9; i++) indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
    this.geometry.setIndex(indices)
    this.geometry.setAttribute('position', this.positions)
    this.mesh.frustumCulled = false
    this.mesh.visible = false
    root.add(this.mesh)
  }

  clear() {
    this.count = this.life = 0
    this.mesh.visible = false
  }

  update(dt: number, cutting: boolean) {
    if (cutting) {
      this.sword.updateWorldMatrix(true, false)
      const sample = this.samples[this.cursor]
      sample.base.set(0, 0, 0.12).applyMatrix4(this.sword.matrixWorld)
      sample.tip.set(0, 0, 1.05).applyMatrix4(this.sword.matrixWorld)
      this.cursor = (this.cursor + 1) % this.samples.length
      this.count = Math.min(this.count + 1, this.samples.length)
      this.life = 0.12
    } else {
      this.life = Math.max(0, this.life - dt)
    }
    this.mesh.visible = this.count > 1 && this.life > 0
    if (!this.life) this.count = 0
    if (!this.mesh.visible) return
    this.root.updateWorldMatrix(true, false)
    this.inverse.copy(this.root.matrixWorld).invert()
    for (let i = 0; i < this.count; i++) {
      const index = (this.cursor - this.count + i + this.samples.length) % this.samples.length
      const { base, tip } = this.samples[index]
      this.local.copy(base).applyMatrix4(this.inverse)
      this.positions.setXYZ(i * 2, this.local.x, this.local.y, this.local.z)
      this.local.copy(tip).applyMatrix4(this.inverse)
      this.positions.setXYZ(i * 2 + 1, this.local.x, this.local.y, this.local.z)
    }
    this.positions.needsUpdate = true
    this.geometry.setDrawRange(0, (this.count - 1) * 6)
    this.surface.opacity = this.life / 0.12 * 0.78
  }
}

export class HeroModel {
  private static heroAsset: GLTF
  private static swordAsset: GLTF
  readonly root = new T.Group()
  private mixer: T.AnimationMixer
  private actions = new Map<ClipName, T.AnimationAction>()
  private current: ClipName = 'Idle'
  private lowerActions = new Map<ClipName, T.AnimationAction>()
  private currentLower: ClipName = 'Idle'
  private trail: SwordTrail
  private previousAttack = -1
  private gaitPhase = 0
  private gaitYaw = 0
  private hips: T.Object3D
  private spine: T.Object3D
  private yawRotation = new T.Quaternion()
  private parentRotation = new T.Quaternion()
  private up = new T.Vector3()
  // 0.72 m of planted travel over 34% of the authored 19/30 s cycle.
  private readonly runSpeed = 0.72 / (0.34 * 19 / 30)

  static async preload() {
    const loader = new GLTFLoader()
    const [hero, sword] = await Promise.all([
      loader.loadAsync(`${import.meta.env.BASE_URL}models/hero.glb?v=arm-clearance-narrow-run-7`),
      loader.loadAsync(`${import.meta.env.BASE_URL}models/sword.glb`),
    ])
    for (const name of clipNames) {
      if (!hero.animations.some(clip => clip.name === name)) throw new Error(`Hero animation ${name} is missing`)
    }
    if (!hero.scene.getObjectByName('SwordSocket')) throw new Error('Hero sword socket is missing')
    HeroModel.heroAsset = hero
    HeroModel.swordAsset = sword
  }

  constructor() {
    const asset = HeroModel.heroAsset
    if (!asset) throw new Error('Hero assets must be loaded before starting the game')
    this.root.add(contactShadow(0.67), asset.scene)
    const socket = asset.scene.getObjectByName('SwordSocket')!
    const sword = HeroModel.swordAsset.scene
    socket.add(sword)
    this.mixer = new T.AnimationMixer(asset.scene)
    this.hips = asset.scene.getObjectByName('Hips')!
    this.spine = asset.scene.getObjectByName('Spine')!
    const lowerBones = new Set(['Root', 'Hips', 'Thigh_L', 'Thigh_R', 'Shin_L', 'Shin_R', 'Foot_L', 'Foot_R'])
    for (const name of clipNames) {
      const source = asset.animations.find(candidate => candidate.name === name)!
      // Disjoint tracks let locomotion continue while the torso plays a strike.
      for (const [layer, actions] of [['upper', this.actions], ['lower', this.lowerActions]] as const) {
        const tracks = source.tracks.filter(track => {
          const bone = T.PropertyBinding.parseTrackName(track.name).nodeName
          return lowerBones.has(bone ?? '') === (layer === 'lower')
        })
        const clip = new T.AnimationClip(`${name}_${layer}`, source.duration, tracks)
        const action = this.mixer.clipAction(clip)
        if (name === 'Hit' || name === 'Death') {
          action.setLoop(T.LoopOnce, 1)
          action.clampWhenFinished = true
        }
        action.play().setEffectiveWeight(name === 'Idle' ? 1 : 0)
        actions.set(name, action)
      }
    }
    this.root.traverse(object => {
      if (!(object instanceof T.Mesh)) return
      object.frustumCulled = false
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of materials) {
        if (material instanceof T.MeshStandardMaterial) {
          if (material.map) material.map.anisotropy = 2
          material.roughness = Math.max(0.65, material.roughness)
        }
      }
    })
    this.trail = new SwordTrail(this.root, sword)
    this.reset()
  }

  reset() {
    for (const [name, action] of [...this.actions, ...this.lowerActions]) {
      action.reset().play().setEffectiveWeight(name === 'Idle' ? 1 : 0)
      action.paused = false
    }
    this.current = this.currentLower = 'Idle'
    this.previousAttack = -1
    this.gaitPhase = this.gaitYaw = 0
    this.trail.clear()
    this.mixer.update(0)
  }

  animate(pose: HeroPose, moving: boolean, _time: number, dt: number, attack: number, _reverse: boolean, velocity = new T.Vector3()) {
    const speed = moving ? velocity.length() : 0
    let direction = moving ? T.MathUtils.euclideanModulo(Math.atan2(velocity.x, velocity.z) - this.root.rotation.y + Math.PI, Math.PI * 2) - Math.PI : 0
    // Keep torso/weapon aimed at the committed strike while the pelvis follows
    // travel. Behind the target, play the gait backwards instead of twisting 180°.
    const backwards = Math.abs(direction) > Math.PI / 2
    if (backwards) direction -= Math.sign(direction) * Math.PI
    this.gaitYaw = T.MathUtils.damp(this.gaitYaw, T.MathUtils.clamp(direction, -1.35, 1.35), 18, dt)
    const runDuration = this.lowerActions.get('Run')!.getClip().duration
    this.gaitPhase = T.MathUtils.euclideanModulo(this.gaitPhase + dt * speed / this.runSpeed * (backwards ? -1 : 1), runDuration)
    const name: ClipName = pose === 'dead' ? 'Death'
      : attack >= 0 ? 'Attack'
      : pose === 'damaged' ? 'Hit'
      : moving ? 'Run' : 'Idle'
    const action = this.actions.get(name)!
    if (name !== this.current) {
      action.reset().play()
      this.current = name
    }
    if (name === 'Attack') {
      if (attack < this.previousAttack) this.trail.clear()
      action.enabled = true
      action.paused = true
      // The blade crossing at phase .49 uses the same clock as Player's damage.
      action.time = T.MathUtils.clamp(attack, 0, 1) * action.getClip().duration
    } else {
      action.paused = false
    }
    for (const [clip, candidate] of this.actions) {
      const weight = T.MathUtils.damp(candidate.getEffectiveWeight(), clip === name ? 1 : 0, name === 'Attack' ? 35 : 20, dt)
      candidate.setEffectiveWeight(weight)
    }
    const lowerName: ClipName = pose === 'dead' ? 'Death'
      : moving ? 'Run' : name === 'Attack' ? 'Attack' : 'Idle'
    const lower = this.lowerActions.get(lowerName)!
    if (lowerName !== this.currentLower) {
      lower.reset().play()
      // Match the upper body's gait when locomotion starts. Starting an attack
      // does not reset this clock, so a planted leg never jumps to frame zero.
      if (lowerName === 'Run') lower.time = this.actions.get('Run')!.time
      this.currentLower = lowerName
    }
    lower.paused = lowerName === 'Attack'
    if (lowerName === 'Attack') lower.time = T.MathUtils.clamp(attack, 0, 1) * lower.getClip().duration
    for (const [clip, candidate] of this.lowerActions) {
      candidate.setEffectiveWeight(T.MathUtils.damp(candidate.getEffectiveWeight(), clip === lowerName ? 1 : 0, 20, dt))
    }
    // A single distance-driven clock survives attacks, stops and layer changes.
    for (const actions of [this.actions, this.lowerActions]) {
      const run = actions.get('Run')!
      run.paused = true
      run.time = this.gaitPhase
    }
    this.mixer.update(dt)
    if (pose !== 'dead') this.orientLegs(this.gaitYaw)
    this.previousAttack = attack
    this.trail.update(dt, name === 'Attack' && attack > 0.23 && attack < 0.66)
  }

  private orientLegs(yaw: number) {
    // Convert world-up to each joint parent's coordinates; the exported rig's
    // bone axes are not the Three.js scene axes. Counter-rotate the spine so
    // this adjustment cannot change the sword's attack direction.
    this.hips.parent!.getWorldQuaternion(this.parentRotation).invert()
    this.up.set(0, 1, 0).applyQuaternion(this.parentRotation)
    this.yawRotation.setFromAxisAngle(this.up, yaw)
    this.hips.quaternion.premultiply(this.yawRotation)
    this.hips.updateWorldMatrix(true, true)
    this.spine.parent!.getWorldQuaternion(this.parentRotation).invert()
    this.up.set(0, 1, 0).applyQuaternion(this.parentRotation)
    this.yawRotation.setFromAxisAngle(this.up, -yaw)
    this.spine.quaternion.premultiply(this.yawRotation)
  }
}
