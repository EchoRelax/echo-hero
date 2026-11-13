import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
const require = createRequire(join(process.env.TEMP, 'echo-hero-qa', 'package.json'))
const { chromium } = require('playwright')
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 960, height: 760 } })
const errors = []
page.on('pageerror', error => errors.push(error.message))
mkdirSync('art/hero/locomotion-qa', { recursive: true })
await page.goto('http://127.0.0.1:5173/')
await page.waitForSelector('canvas')
await page.waitForTimeout(1000)
await page.keyboard.down('s')
await page.waitForTimeout(700)
await page.keyboard.up('s')
await page.keyboard.down('d')
await page.waitForTimeout(700)
await page.keyboard.up('d')
await page.screenshot({ path: 'art/hero/locomotion-qa/game.png' })
await page.goto('http://127.0.0.1:5173/tools/hero-preview.html')
await page.waitForFunction(() => window.heroPreview)
await page.evaluate(() => window.heroPreview.pause())
const report = await page.evaluate(() => {
  const p = window.heroPreview, h = p.hero
  const report = []
  let maxBladeTilt = 0
  let maxGripError = 0
  for (const running of [false,true]) {
    h.reset(); p.set(running,4.5,0)
    for(let i=0;i<180;i++) {
      p.frame(1/60)
      if(i<60) continue
      h.root.updateWorldMatrix(true,true)
      const socket=h.root.getObjectByName('SwordSocket')
      const base=socket.localToWorld(socket.position.clone().set(0,0,0))
      const tip=socket.localToWorld(socket.position.clone().set(0,0,1))
      const blade=tip.sub(base).normalize()
      maxBladeTilt=Math.max(maxBladeTilt,Math.acos(Math.min(1,blade.y)))
      const hand=h.root.getObjectByName('Hand_L')
      const wrist=hand.getWorldPosition(hand.position.clone())
      maxGripError=Math.max(maxGripError,wrist.addScaledVector(blade,.185).distanceTo(base))
    }
  }
  if(maxBladeTilt>.035 || maxGripError>.035) throw new Error(`Sword grip: tilt=${maxBladeTilt}, error=${maxGripError}`)
  report.push({maxBladeTiltDegrees:maxBladeTilt*180/Math.PI,maxGripErrorMetres:maxGripError})
  for (const [run, speed, angle, attack] of [[false,0,0,-1],[true,4.5,0,-1],[true,7,0,-1],[true,4.5,75,.2],[true,4.5,180,.2],[false,0,0,-1]]) {
    p.set(run,speed,angle,attack)
    for(let i=0;i<90;i++) p.frame(1/60)
    h.root.updateWorldMatrix(true,true)
    let finite = true
    h.root.traverse(o => { finite &&= o.matrixWorld.elements.every(Number.isFinite) })
    const upper = h.actions.get('Run').time, lower = h.lowerActions.get('Run').time
    if (!finite || Math.abs(upper-lower)>1e-6) throw new Error('Invalid skeleton or desynchronized gait')
    report.push({run,speed,angle,finite,synchronized:upper===lower})
  }
  h.reset(); p.set(true,4.5,0)
  return report
})
for (let i=0;i<32;i++) {
  await page.evaluate(() => window.heroPreview.frame(1/60))
  await page.screenshot({ path: `art/hero/locomotion-qa/run-${String(i).padStart(2,'0')}.png` })
}
await page.evaluate(() => { const p=window.heroPreview; p.set(true,4.5,60,.3); p.frame(1/60) })
await page.screenshot({ path: 'art/hero/locomotion-qa/moving-strike.png' })
await page.evaluate(() => {
  const p=window.heroPreview
  p.hero.reset(); p.set(false,0,0)
  p.camera.position.set(0,5,3.5); p.camera.lookAt(0,1,0)
  for(let i=0;i<60;i++) p.frame(1/60)
})
await page.screenshot({ path: 'art/hero/locomotion-qa/guard-game-angle.png' })
await page.evaluate(() => {
  const p=window.heroPreview
  p.camera.position.set(0,1.4,5.5); p.camera.lookAt(0,1.15,0)
  p.set(true,4.5,0)
  for(let i=0;i<65;i++) p.frame(1/60)
})
await page.screenshot({ path: 'art/hero/locomotion-qa/run-front.png' })
console.log(JSON.stringify({ report, errors },null,2))
const playerReport = await page.evaluate(async () => {
  const { Player } = await import('/src/entities/Player.ts')
  const { Vector3 } = await import('/node_modules/three/build/three.module.js')
  const player = new Player(100)
  player.reset(0)
  const world = { move(p,x,z) { p.x+=x; p.z+=z } }
  const motion = new Vector3(1,0,0)
  for(let i=0;i<60;i++) {
    player.move(world,motion,1/60,4.5)
    player.updateModel(1/60,i/60,motion,new Vector3(-10,0,0))
  }
  if(Math.abs(player.position.x-4.5)>1e-6 || Math.abs(player.model.root.rotation.y-Math.PI/2)>.01) throw new Error('Travel or facing regression')
  player.move({move(){}},motion,1/60,4.5)
  if(player.moving || player.velocity.length()>0) throw new Error('Running against wall')
  const phase=player.model.gaitPhase
  for(let i=0;i<30;i++) player.updateModel(1/60,2+i/60,motion)
  if(player.model.gaitPhase!==phase) throw new Error('Gait advances at rest')
  player.startAttack(new Vector3(10,0,0))
  let contacts=0
  for(let i=0;i<40;i++) {
    if(player.advanceAttack(1/60)) contacts++
    player.updateModel(1/60,3+i/60,new Vector3())
  }
  if(contacts!==1) throw new Error('Attack contact regression')
  return { travel:player.position.x, facing:'follows movement despite target behind', wall:'stops gait', attackContacts:contacts }
})
console.log(JSON.stringify(playerReport,null,2))
await browser.close()
if(errors.length) process.exitCode=1
