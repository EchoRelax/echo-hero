import { createRequire } from 'node:module'
import { join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const require = createRequire(join(process.env.TEMP, 'echo-hero-qa', 'package.json'))
const { chromium } = require('playwright')
const browser = await chromium.launch({ headless: true, channel: 'msedge' })
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage(), errors = [], failed = []
page.on('pageerror', e => errors.push(e.message))
page.on('response', r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`) })
await page.route('**/src/main.ts*', async route => {
  const response = await route.fetch(), body = await response.text()
  assert(body.includes('new Game(root)'))
  await route.fulfill({ response, body: body.replace('new Game(root)', 'window.__assetGame = new Game(root)') })
})
const out = 'art/enemies/boss2/integration-qa';mkdirSync(out, { recursive: true })
try {
  await page.goto(process.env.ECHO_QA_URL ?? 'http://127.0.0.1:5176/')
  await page.waitForFunction(() => window.__assetGame, { timeout: 60000 })
  const report = await page.evaluate(() => {
    const g = window.__assetGame;g.renderer.setAnimationLoop(null)
    const b = g.encounters.find(e => e.zone.id === 'canyon').boss
    const check = (value, message) => { if (!value) throw Error(message) }
    check(b.model.root.getObjectByName('Boss2Rig'), 'New boss model is not assigned')
    check(b.model.actions.size === 6, 'Missing animations')
    const point = (x, z) => b.position.clone().add({x,y:0,z})
    let time = 0
    const tick = p => b.update(p, 1 / 60, time += 1 / 60)
    const run = (frames, p) => { let total = 0;for (let i = 0; i < frames; i++) total += tick(p);return total }
    b.reset();tick(point(0, 5));check(b.model.current === 'Walk', 'Boss does not walk')
    b.reset();b.specialCooldown = 100
    let p = point(0, 2.4);tick(p)
    check(run(30, p) === 0, 'Basic damage before impact')
    check(run(15, p) === 26 && b.model.current === 'Melee', 'Basic strike does not match animation')
    b.reset();b.specialCooldown = 100;p = point(0, 2.4);tick(p);run(20, p)
    check(run(30, point(0, 5)) === 0, 'Basic strike cannot be dodged')
    b.reset();b.specialCooldown = 0;p = point(0, 5);tick(p)
    check(b.effects.eruptions.filter(e => e.warning.root.visible).length === 5, 'Expected five telegraphed eruptions')
    check(run(80, p) === 0, 'Eruptions hit before the slam')
    check(run(15, p) === 57 && b.model.current === 'GroundSlam', 'Slam impact/damage mismatch')
    check(b.effects.eruptions.every(e => e.rocks.visible && !e.warning.root.visible), 'Eruption visuals missing')
    check(run(25, p) === 0, 'Lingering rocks deal repeated damage')
    b.reset();b.specialCooldown = 0;tick(point(0, 5))
    const safe = point(-8, 0)
    check(b.effects.eruptions.every(e => !e.warning.contains(safe)), 'Dodge fixture is not safe')
    check(run(100, safe) === 0, 'Eruptions cannot be dodged')
    b.reset();b.next = 'charge';b.specialCooldown = 0;p = point(0, 5);tick(p)
    check(run(90, p) === 0, 'Charge damages the player')
    check(b.model.current === 'Charge' && b.effects.core.visible, 'Internal charge missing')
    const launches = [];let previous = 0, total = 0
    for (let i = 0; i < 340; i++) {
      total += tick(p)
      if (b.launched !== previous) {
        launches.push({ frame:i, angle:b.effects.waves[b.launched-1].angle });previous=b.launched
        check(b.model.current === 'WaveRelease', 'Wave launches without release animation')
      }
    }
    check(launches.length === 6, `Expected six sequential waves: ${launches.length}`)
    check(launches.every((s,i) => !i || s.frame - launches[i-1].frame >= 42), 'Waves are simultaneous')
    check(new Set(launches.map(s => s.angle.toFixed(3))).size === 6, 'Waves use the same direction')
    check(total === 46, `Travelling wave should hit once, got ${total}`)
    // Run the same barrage from a safe angular gap: no unavoidable arena damage.
    b.reset();b.next='charge';b.specialCooldown=0;p=point(0,5);tick(p);run(97,p)
    check(run(340, point(4.6,8)) === 0, 'Wave gap is not dodgeable')
    // Snapshot tempo at windup: crossing enrage cannot skip release events.
    b.reset();b.next='charge';b.specialCooldown=0;p=point(0,5);tick(p);b.damage(1600)
    check(b.attackTempo === 1, 'In-progress attack changed tempo')
    run(120,p);check(b.effects.waves.some(w=>w.root.visible), 'Reset fixture has no waves')
    b.reset()
    check(!b.effects.waves.some(w=>w.root.visible) && !b.effects.lane.root.visible && !b.effects.core.visible, 'Reset leaves active hazards')
    b.next='charge';b.specialCooldown=0;tick(p);run(120,p);b.damage(b.health.max)
    check(tick(p) === 0 && !b.effects.waves.some(w=>w.root.visible), 'Death leaves active waves')
    b.reset();b.damage(1600);b.next='charge';b.specialCooldown=0;tick(p)
    check(b.attackTempo === .85, 'Enrage does not accelerate next ability')
    b.reset();b.next='slam';b.specialCooldown=0;p=point(0,5);tick(p);run(20,p)
    tick(point(0,15))
    check(!b.active && b.health.current === b.health.max && b.effects.eruptions.every(e=>!e.warning.root.visible), 'Leash reset leaves warning or damage')
    return { model:'boss2.glb', clips:[...b.model.actions.keys()], eruptionZones:5, basicDamage:26, eruptionDamage:57, waveDamage:total, launches, dodgeChecks:true, deathAndReset:true, enrageTiming:true }
  })
  // Capture gameplay compositions at exact combat phases.
  await page.evaluate(() => {
    const g = window.__assetGame,b=g.encounters.find(e=>e.zone.id==='canyon').boss
    b.reset();g.world.setDefeated(new Set(['rootGuardian']))
    g.player.health.grow(5000);g.player.position.copy(b.position).add({x:0,y:0,z:5});g.updateZone()
    g.camera.position.copy(b.position).add({x:0,y:0,z:0}).add({x:0,y:15,z:12})
    g.camera.lookAt(b.position.x,.5,b.position.z+1);g.camera.zoom=1;g.camera.updateProjectionMatrix()
    g.world.updateAtmosphere(g.encounter.zone,1)
    window.__bossPreview = {
      boss:b,time:0,
      tick(n) { for(let i=0;i<n;i++) b.update(g.player.position,1/60,this.time+=1/60) },
      draw() {
        g.camera.updateMatrixWorld();g.updateHUD();g.vitals.update(g.camera,g.player,g.enemies,0);g.hud.renderPlayer(g.camera,g.player.position,true)
        g.renderer.render(g.world.scene,g.camera)
      },
    }
  })
  for (const [name, ability, frames] of [['slam-windup','slam',70],['eruption','slam',96],['charge','charge',75],['wave','charge',140],['wave-turn','charge',200]]) {
    await page.evaluate(({ability,frames}) => {
      const p=window.__bossPreview,b=p.boss;b.reset();b.next=ability;b.specialCooldown=0;p.time=0;p.tick(frames);p.draw()
    }, {ability,frames})
    await page.locator('canvas').screenshot({path:`${out}/${name}.png`})
  }
  if (process.env.ECHO_RECORD_PREVIEW === '1') {
    mkdirSync(`${out}/combat-frames`,{recursive:true})
    await page.evaluate(() => {
      const p=window.__bossPreview,b=p.boss;b.reset();b.next='slam';b.specialCooldown=0;p.time=0
    })
    for(let frame=0;frame<144;frame++) {
      await page.evaluate(() => { const p=window.__bossPreview;p.tick(5);p.draw() })
      await page.locator('canvas').screenshot({path:`${out}/combat-frames/${String(frame).padStart(3,'0')}.png`})
    }
  }
  report.victoryProgression = await page.evaluate(() => {
    const g=window.__assetGame,b=window.__bossPreview.boss
    b.damage(b.health.max);g.winBoss(b)
    if (!g.defeated.has('ashGolem') || g.encounters.find(e=>e.zone.id==='canyon').boss || b.model.root.visible) throw Error('Boss victory is not persisted')
    if (!g.runes.equip(0,'fire',g.defeated)) throw Error('Victory does not unlock fire rune')
    const save=JSON.parse(localStorage.getItem('echo-hunt-progress'))
    if(!save.defeatedBosses.includes('ashGolem')) throw Error('Boss victory missing from save')
    return true
  })
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[])
  writeFileSync(`${out}/report.json`,JSON.stringify({...report,errors,failed},null,2));console.log(JSON.stringify(report,null,2))
} finally { await browser.close() }
