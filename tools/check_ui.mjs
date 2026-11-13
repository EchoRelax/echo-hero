import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import assert from 'node:assert/strict'
const require = createRequire(join(process.env.TEMP, 'echo-hero-qa', 'package.json'))
const { chromium } = require('playwright')
const browser = await chromium.launch({ headless:true, channel:'msedge' })
mkdirSync('art/ui', { recursive:true })
const errors=[]
for(const [name,width,height,touch] of [['desktop',1440,900,false],['mobile',390,844,true],['small',320,740,true],['landscape',844,390,true]]) {
  const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch})
  await context.addInitScript(() => localStorage.setItem('echo-hunt-settings', JSON.stringify({ language:'en' })))
  const page=await context.newPage()
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto('http://127.0.0.1:5173/')
  await page.waitForSelector('.open-upgrades')
  await page.screenshot({path:`art/ui/${name}-first.png`})
  if(await page.locator('.training-dismiss').isVisible()) await page.locator('.training-dismiss').click()
  assert.equal(await page.locator('.brand,.quest-line,.objective,.hero').count(),0)
  assert.equal(await page.locator('.open-runes').count(),2)
  const rects=await page.locator('.action-tile').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}}))
  assert.equal(rects[0].w,rects[2].w)
  for(const r of rects) assert(r.w>=68&&r.x>=0&&r.x+r.w<=width&&r.y+r.h<=height)
  await page.screenshot({path:`art/ui/${name}-hud.png`})
  for(const index of [0,1]) {
    await page.locator('.open-runes').nth(index).click()
    await page.locator('.rune-overlay:not([hidden])').waitFor()
    if(index===0) await page.screenshot({path:`art/ui/${name}-runes.png`})
    await page.getByRole('button',{name:'Close runes',exact:true}).click()
    assert(await page.locator('.open-runes').nth(index).evaluate(n=>n===document.activeElement))
  }
  await page.locator('.open-upgrades').click()
  await page.locator('.upgrade-overlay:not([hidden])').waitFor()
  await page.screenshot({path:`art/ui/${name}-upgrades.png`})
  await page.getByRole('button',{name:'Close upgrades',exact:true}).click()
  await page.locator('.open-settings').click()
  await page.locator('.settings-panel').waitFor()
  await page.screenshot({path:`art/ui/${name}-settings.png`})
  await page.locator('.settings-close').click()
  await page.locator('.pause').click()
  await page.getByRole('button',{name:'Resume hunt'}).click()
  if(name==='desktop'||name==='mobile') {
    // Isolated test browser storage; never touches the user's saved game.
    await context.addInitScript(()=>{
      const save=JSON.parse(localStorage.getItem('echo-hunt-progress'))
      save.progress.level=12;save.progress.xp=80;save.progress.gold=12345
      save.defeatedBosses=['rootGuardian','ashGolem'];save.slots=['root','fire']
      localStorage.setItem('echo-hunt-progress',JSON.stringify(save))
    })
    await page.reload();await page.waitForSelector('.open-runes[data-rune="fire"]')
    if(await page.locator('.training-dismiss').isVisible()) await page.locator('.training-dismiss').click()
    await page.screenshot({path:`art/ui/${name}-equipped.png`})
    await page.locator('.open-runes').first().click()
    await page.getByRole('button',{name:'Unequip Root Rune from slot 1'}).click()
    await page.locator('.close-runes').click()
    assert.equal(await page.locator('.open-runes').first().getAttribute('data-rune'),'empty')
    await page.locator('.open-upgrades').click()
    const buy=page.locator('.upgrade-row button:not(:disabled)').first()
    const before=await page.locator('.upgrade-gold').textContent()
    await buy.click()
    assert.notEqual(await page.locator('.upgrade-gold').textContent(),before)
  }
  console.log(`${name}: layout, rune slots, focus return, upgrades, settings, pause passed`)
  await context.close()
}
await browser.close()
assert.deepEqual(errors,[])
