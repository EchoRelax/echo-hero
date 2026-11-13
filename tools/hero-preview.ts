import * as T from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { HeroModel } from '../src/entities/HeroModel'

// Development-only inspection page, independent of the game's save state.
const scene = new T.Scene()
scene.background = new T.Color('#202833')
const camera = new T.PerspectiveCamera(36, innerWidth / innerHeight, .1, 50)
camera.position.set(3.4, 2.1, 5)
const renderer = new T.WebGLRenderer({ antialias: true })
renderer.setSize(innerWidth, innerHeight)
renderer.setPixelRatio(devicePixelRatio)
document.body.append(renderer.domElement)
const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, .9, 0)
controls.update()
scene.add(new T.HemisphereLight(0xffffff, 0x728091, 2.5))
const light = new T.DirectionalLight(0xffedcf, 2.5)
light.position.set(-3, 6, 5)
scene.add(light)
const grid = new T.GridHelper(12, 24, 0x778899, 0x455365)
scene.add(grid)
await HeroModel.preload()
const hero = new HeroModel()
scene.add(hero.root)
let running = true, strike = -1, time = 0, automatic = true
const velocity = new T.Vector3()
const travel = new T.Vector3()
const speed = document.querySelector<HTMLInputElement>('#speed')!
const angle = document.querySelector<HTMLInputElement>('#angle')!
document.querySelector('#run')!.addEventListener('click', () => running = !running)
document.querySelector('#attack')!.addEventListener('click', () => strike = 0)
function frame(dt: number) {
  time += dt
  const yaw = Number(angle.value) * Math.PI / 180
  velocity.set(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(running ? Number(speed.value) : 0)
  hero.animate(running ? 'running' : 'idle', running, time, dt, strike, false, velocity)
  if (strike >= 0) { strike += dt / .5; if (strike >= 1) strike = -1 }
  travel.addScaledVector(velocity, dt)
  grid.position.set(-travel.x % .5, 0, -travel.z % .5)
  renderer.render(scene, camera)
}
Object.assign(window, { heroPreview: { hero, scene, camera, renderer, frame,
  pause() { automatic = false },
  set(run: boolean, rate: number, direction: number, attack = -1) {
    running = run; speed.value = String(rate); angle.value = String(direction); strike = attack
  },
} })
const clock = new T.Clock()
renderer.setAnimationLoop(() => { const dt = Math.min(clock.getDelta(), .05); if (automatic) frame(dt) })
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})
