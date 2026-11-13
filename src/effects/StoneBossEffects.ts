import * as T from 'three'
import { GroundWarning } from './GroundWarning'

export interface StoneWave {
  root: T.Group
  origin: T.Vector3
  angle: number
  age: number
  previous: number
  distance: number
  hit: boolean
}

const rockGeometry = new T.IcosahedronGeometry(1, 0)
const rockMaterials = ['#4f5559', '#69665c', '#827565'].map(color => new T.MeshStandardMaterial({ color, flatShading: true, roughness: .95 }))
const dustGeometry = new T.IcosahedronGeometry(1, 0)

export class StoneBossEffects {
  readonly root = new T.Group()
  readonly eruptions: { point: T.Vector3; warning: GroundWarning; rocks: T.Group; age: number }[]
  readonly waves: StoneWave[]
  readonly lane: GroundWarning
  private core: T.Mesh<T.IcosahedronGeometry, T.MeshBasicMaterial>
  private orbit: T.Group
  private shock: T.Mesh<T.RingGeometry, T.MeshBasicMaterial>
  private shockAge = 10

  constructor(readonly radius: number, readonly waveWidth: number, readonly waveLength: number) {
    this.root.name = 'Boss2StoneEffects'
    this.eruptions = Array.from({ length: 5 }, () => {
      const warning = new GroundWarning({ name: 'Stone Eruption', kind: 'circle', radius, warning: 1.5, damage: 0 })
      const rocks = this.pile(7, false);rocks.visible = false
      this.root.add(warning.root, rocks)
      return { point: new T.Vector3(), warning, rocks, age: 10 }
    })
    this.lane = new GroundWarning({ name: 'Rolling Stone Waves', kind: 'line', length: waveLength, width: waveWidth, warning: .6, damage: 0 })
    this.root.add(this.lane.root)
    this.waves = Array.from({ length: 6 }, () => {
      const root = this.pile(9, true);root.visible = false;this.root.add(root)
      return { root, origin: new T.Vector3(), angle: 0, age: 10, previous: 0, distance: 0, hit: false }
    })
    this.orbit = this.pile(8, false);this.orbit.visible = false;this.root.add(this.orbit)
    this.orbit.children.forEach((rock, i) => {
      if (rock.name === 'Dust') { rock.visible = false;return }
      rock.scale.multiplyScalar(.32)
      rock.position.set(Math.cos(i * Math.PI / 4) * 1.35, .25 + (i % 3) * .22, Math.sin(i * Math.PI / 4) * 1.35)
    })
    this.core = new T.Mesh(new T.IcosahedronGeometry(.19, 1), new T.MeshBasicMaterial({ color: '#89ffff', transparent: true, opacity: 0, depthWrite: false }))
    this.root.add(this.core)
    this.shock = new T.Mesh(new T.RingGeometry(.82, 1, 48).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: '#d5c09a', transparent: true, depthWrite: false }))
    this.shock.visible = false;this.root.add(this.shock)
  }

  private pile(count: number, wave: boolean) {
    const group = new T.Group()
    for (let i = 0; i < count; i++) {
      const rock = new T.Mesh(rockGeometry, rockMaterials[i % rockMaterials.length])
      const angle = i * 2.399
      const scale = .3 + (i % 3) * .12
      rock.position.set(wave ? (i % 3 - 1) * .78 : Math.cos(angle) * .52,
        wave ? .3 + Math.floor(i / 3) * .28 : .25 + (i % 3) * .26,
        wave ? (Math.floor(i / 3) - 1) * .30 : Math.sin(angle) * .52)
      rock.rotation.set(i * .7, angle, i * .35);rock.scale.set(scale, scale * (wave ? 1 : 1.6), scale)
      group.add(rock)
    }
    const dust = new T.Mesh(dustGeometry, new T.MeshBasicMaterial({ color: '#b59a76', transparent: true, opacity: .18, depthWrite: false }))
    dust.name = 'Dust';dust.position.y = .16;dust.scale.set(wave ? 1.5 : 1.15, .26, .75);group.add(dust)
    return group
  }

  markEruptions(points: T.Vector3[]) {
    this.eruptions.forEach((e, i) => { e.point.copy(points[i]);e.warning.aim(e.point, 0);e.rocks.position.copy(e.point);e.age = 10;e.rocks.visible = false })
  }

  showEruptions(progress: number) {
    for (const e of this.eruptions) e.warning.show(progress, 0)
  }

  erupt(origin: T.Vector3) {
    for (const e of this.eruptions) { e.age = 0;e.rocks.visible = true;e.rocks.scale.y = .04;e.rocks.position.y = -.12;e.warning.root.visible = false }
    this.shock.position.copy(origin).setY(.09);this.shockAge = 0;this.shock.visible = true;this.shock.scale.setScalar(.5);this.shock.material.opacity = 1
  }

  markLane(origin: T.Vector3, angle: number, progress: number) {
    this.lane.aim(origin, angle);this.lane.show(progress, 0)
  }

  launch(index: number, origin: T.Vector3, angle: number) {
    const wave = this.waves[index]
    wave.origin.copy(origin);wave.angle = angle;wave.age = 0;wave.previous = wave.distance = .8;wave.hit = false
    wave.root.visible = true;wave.root.rotation.y = angle;wave.root.scale.setScalar(1)
    wave.root.position.copy(origin).add(new T.Vector3(Math.sin(angle) * .8, 0, Math.cos(angle) * .8))
    this.lane.root.visible = false
  }

  charge(origin: T.Vector3, angle: number, power: number, time: number) {
    this.core.visible = this.orbit.visible = power > 0
    this.core.position.copy(origin).add(new T.Vector3(Math.sin(angle) * .48, 2.45, Math.cos(angle) * .48))
    this.core.material.opacity = power * (.5 + .15 * Math.sin(time * 15));this.core.scale.setScalar(.6 + power * .7)
    this.orbit.position.copy(origin).setY(.8 + power * .6);this.orbit.rotation.y = time * 1.5
    this.orbit.scale.setScalar(.65 + power * .35)
  }

  update(dt: number, speed: number) {
    for (const e of this.eruptions) {
      e.age += dt;e.rocks.visible = e.age < 1.6
      if (e.rocks.visible) {
        const rise = T.MathUtils.smoothstep(e.age, 0, .14), sink = T.MathUtils.smoothstep(e.age, .85, 1.6)
        e.rocks.scale.set(1, Math.max(.02, rise * (1 - sink)), 1);e.rocks.position.y = -.12 - sink * .5
      }
    }
    for (const wave of this.waves) {
      if (!wave.root.visible) continue
      wave.age += dt;wave.previous = wave.distance;wave.distance = .8 + wave.age * speed
      wave.root.visible = wave.distance <= this.waveLength
      wave.root.position.copy(wave.origin).add(new T.Vector3(Math.sin(wave.angle) * wave.distance, 0, Math.cos(wave.angle) * wave.distance))
      const fade = 1 - T.MathUtils.smoothstep(wave.distance, this.waveLength - 1.2, this.waveLength)
      wave.root.scale.set(1, Math.max(.03, fade), 1)
      for (const [i, rock] of wave.root.children.entries()) {
        if (rock.name === 'Dust') continue
        rock.rotation.x += dt * (5 + i % 3);rock.position.y = .32 + Math.floor(i / 3) * .28 + Math.abs(Math.sin(wave.age * 12 + i)) * .18
      }
    }
    this.shockAge += dt;this.shock.visible = this.shockAge < .5
    this.shock.scale.setScalar(.5 + this.shockAge * 8);this.shock.material.opacity = Math.max(0, 1 - this.shockAge * 2)
  }

  clear() {
    for (const e of this.eruptions) { e.age = 10;e.rocks.visible = e.warning.root.visible = false }
    for (const wave of this.waves) wave.root.visible = false
    this.lane.root.visible = this.orbit.visible = this.core.visible = this.shock.visible = false
    this.shockAge = 10
  }
}
