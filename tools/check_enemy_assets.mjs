import { createRequire } from 'node:module'
import { join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const require = createRequire(join(process.env.TEMP, 'echo-hero-qa', 'package.json'))
const { chromium } = require('playwright')
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()
const errors = [], failed = []
page.on('pageerror', error => errors.push(error.message))
page.on('response', response => { if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`) })
// Expose the real game only in this isolated browser's intercepted entry module.
await page.route('**/src/main.ts*', async route => {
  const response = await route.fetch()
  const body = await response.text()
  assert(body.includes('new Game(root)'), 'Game entry changed')
  await route.fulfill({ response, body: body.replace('new Game(root)', 'window.__assetGame = new Game(root)') })
})
const out = 'art/enemies/integration-qa'
mkdirSync(out, { recursive: true })
try {
  await page.goto(process.env.ECHO_QA_URL ?? 'http://127.0.0.1:5176/')
  await page.waitForFunction(() => window.__assetGame, { timeout: 60000 })
  const report = await page.evaluate(() => {
    const g = window.__assetGame
    g.renderer.setAnimationLoop(null)
    const guardians = g.enemies.filter(e => e.config.model === 'guardian')
    const imps = g.enemies.filter(e => e.config.model === 'imp')
    const boss = g.encounters.find(e => e.zone.id === 'canyon').boss
    const check = (ok, message) => { if (!ok) throw Error(message) }
    check(guardians.length > 0 && imps.length > 0, 'Missing canyon enemies')
    check(guardians.every(e => e.model.root.getObjectByName('GolemRig')), 'Guardian uses a placeholder')
    check(imps.every(e => e.model.root.getObjectByName('ChaosbesBody')), 'Imp uses a placeholder')
    check(boss.model.root.getObjectByName('Boss2Rig'), 'Ash boss uses a placeholder')
    const first = guardians[0], second = guardians[1]
    const a = first.model.golem, b = second.model.golem
    const boneA = a.root.getObjectByName('UpperArm_L'), boneB = b.root.getObjectByName('UpperArm_L')
    check(boneA !== boneB, 'Golem instances share bones')
    second.reset()
    const otherPose = boneB.quaternion.clone()
    first.reset()
    let player = first.home.clone().add({ x: 0, y: 0, z: 3 })
    first.update(g.world, player, 1 / 60, 0)
    check(a.current === 'Walk', 'Chasing does not play Walk')
    const walkStart = boneA.quaternion.clone()
    for (let i = 1; i < 20; i++) first.update(g.world, player, 1 / 60, i / 60)
    check(walkStart.angleTo(boneA.quaternion) > .01, 'Walk bones do not move')
    check(otherPose.angleTo(boneB.quaternion) < 1e-5, 'Animating one golem moves another')
    player = first.position.clone().add({ x: 0, y: 0, z: .8 })
    let strike = 0, impactPose = -1
    for (let i = 0; i < 120; i++) {
      const damage = first.update(g.world, player, 1 / 60, i / 60)
      if (damage > 0) {
        check(a.current === 'Attack', 'Damage does not play Attack')
        impactPose = a.actions.get('Attack').time / a.actions.get('Attack').getClip().duration
        check(Math.abs(impactPose - .64) < 1e-5, 'Attack impact is out of sync')
        strike = damage; break
      }
    }
    check(strike > 0, 'Guardian never attacks')
    const otherSkin = b.surfaces[0].material.emissive.clone()
    a.animate(0, 0, 0, false, true, false, false, 1 / 60)
    check(otherSkin.equals(b.surfaces[0].material.emissive), 'Hit flash leaks to another golem')
    first.damage(first.health.max * 2)
    for (let i = 0; i < 30; i++) first.update(g.world, player, 1 / 60, i / 60)
    check(!first.model.root.visible, 'Defeated golem stays visible')
    first.reset()
    check(first.model.root.visible && a.current === 'Idle', 'Reset does not restore golem')
    check(imps[0].model.root.getObjectByProperty('isMesh', true), 'Chaosbes has no mesh')
    // Exercise the actual boss controller through a telegraphed attack too.
    boss.reset();player = boss.position.clone().add({ x: 0, y: 0, z: 3.3 })
    let bossDamage = 0
    for (let i = 0; i < 180; i++) {
      const damage = boss.update(player, 1 / 60, i / 60)
      if (damage > 0) {
        check(['GroundSlam','Melee'].includes(boss.model.current), 'Boss does not play its attack')
        bossDamage = damage;break
      }
    }
    check(bossDamage > 0, 'Boss attack never lands')
    return { guardians: guardians.length, imps: imps.length, clips: [...a.actions.keys()], strike, impactPose, bossDamage, independentSkeletons: true, deathAndReset: true }
  })
  for (const [name, camp] of [['chaosbes', 'embers'], ['golem', 'quarry'], ['golem-boss', null]]) {
    await page.evaluate(({camp}) => {
      const g = window.__assetGame
      const boss = g.encounters.find(e => e.zone.id === 'canyon').boss
      const targets = camp ? g.enemies.filter(e => e.camp === camp) : []
      for (const target of targets) target.reset()
      boss.reset()
      const point = camp ? targets[0].home.clone() : boss.position.clone()
      g.player.position.copy(point).add({ x: 0, y: 0, z: 5 })
      g.updateZone()
      g.camera.position.copy(point).add({ x: 0, y: 12, z: 10 })
      g.camera.lookAt(point.x, .8, point.z)
      g.camera.zoom = camp ? 1.4 : 1.2;g.camera.updateProjectionMatrix()
      const golem = targets.find(e => e.model.golem)
      if (golem) golem.model.animate(0, false, .75, 0, 0, 0, 1 / 60)
      if (!camp) boss.model.animate(0, .75, 0, false, false, false, false, 1 / 60)
      g.renderer.render(g.world.scene, g.camera)
    }, {camp})
    await page.locator('canvas').screenshot({ path: `${out}/${name}.png` })
  }
  assert.deepEqual(errors, [], 'Browser errors')
  assert.deepEqual(failed, [], 'Asset requests failed')
  writeFileSync(`${out}/report.json`, JSON.stringify({ ...report, errors, failed }, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally {
  await browser.close()
}
