import {createRequire} from 'node:module'
import {join} from 'node:path'
import {mkdirSync} from 'node:fs'
import assert from 'node:assert/strict'

const require=createRequire(join(process.env.TEMP,'echo-hero-qa','package.json'))
const {chromium}=require('playwright')
const browser=await chromium.launch({headless:true,channel:'msedge'})
const context=await browser.newContext({viewport:{width:1280,height:900}})
await context.addInitScript(()=>{
 if(sessionStorage.getItem('rune-reward-seeded'))return
 localStorage.setItem('echo-hunt-progress',JSON.stringify({version:8,progress:{level:10,xp:0,gold:7,cargo:0,baseUnlocked:true,milestonePaid:0,talents:{warrior:0,resilience:0,gatherer:0},upgrades:{damage:0,health:0,speed:0,pickup:0}},defeatedBosses:[],slots:[null,null]}))
 localStorage.setItem('echo-hunt-settings',JSON.stringify({language:'ru',muted:true}))
 sessionStorage.setItem('rune-reward-seeded','1')
})
const page=await context.newPage(),errors=[]
page.on('pageerror',e=>errors.push(e.message))
await page.route('**/src/main.ts*',async route=>{
 const response=await route.fetch(),body=await response.text()
 await route.fulfill({response,body:body.replace('new Game(root)','window.__rewardGame = new Game(root)')})
})
mkdirSync('art/rune-reward',{recursive:true})
const mode=()=>page.evaluate(()=>window.__rewardGame.mode)
const slots=()=>page.evaluate(()=>window.__rewardGame.runes.active)
const load=async()=>{
 await page.goto(process.env.ECHO_QA_URL??'http://127.0.0.1:5176/')
 await page.waitForFunction(()=>window.__rewardGame,{timeout:60000})
 await page.evaluate(()=>window.__rewardGame.renderer.setAnimationLoop(null))
}
const defeat=async id=>{
 const entrance=await page.evaluate(id=>{
  const g=window.__rewardGame,e=g.encounters.find(e=>e.boss?.id===id),b=e.boss
  g.player.position.copy(b.position);g.encounter=e;g.follow(1)
  b.health.damage(b.health.max);g.update(0)
  const opacity=selector=>getComputedStyle(document.querySelector(selector)).opacity
  const start={backdrop:opacity('.rune-reward-backdrop'),action:opacity('.rune-reward-equip'),orbits:opacity('.rune-reward-orbits')}
  g.frame(performance.now())
  return start
 },id)
 assert.deepEqual(entrance,{backdrop:'0',action:'0',orbits:'0'},'Reward must start with a fade in both motion modes')
 await page.waitForFunction(()=>{
  const backdrop=Number(getComputedStyle(document.querySelector('.rune-reward-backdrop')).opacity)
  const action=getComputedStyle(document.querySelector('.rune-reward-equip')).opacity
  return backdrop>.1&&backdrop<.8&&action==='0'
 },null,{timeout:5000})
 assert.equal(await mode(),'victory')
 assert.equal(await page.locator('.rune-overlay').isVisible(),false)
 assert.equal(await page.locator('.rune-reward').isVisible(),true)
 assert.equal(await page.evaluate(()=>window.__rewardGame.input.active),false)
 await page.keyboard.press('Escape')
 assert.equal(await mode(),'victory','Escape skipped the reward')
}
const fit=async()=>{
 const bounds=await page.locator('.rune-reward-content').boundingBox(),vp=page.viewportSize()
 assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=vp.width&&bounds.y+bounds.height<=vp.height,'Reward does not fit viewport')
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
}
const waitForReveal=()=>page.waitForFunction(()=>{
 const selectors=['.rune-reward-backdrop','.rune-reward-orbits','.rune-reward-equip']
 return selectors.every(selector=>getComputedStyle(document.querySelector(selector)).opacity==='1')
})
try{
 await load()
 await defeat('rootGuardian')
 assert.equal(await page.locator('.rune-reward').getAttribute('data-rune'),'root')
 assert.equal(await page.locator('#reward-rune-title').textContent(),'Руна корней')
 assert((await page.locator('#reward-rune-description').textContent()).includes('45%'))
 assert.equal(await page.locator('.rune-reward-choice').isVisible(),false)
 await waitForReveal()
 const outer=page.locator('.rune-reward-orbit-outer')
 const inner=page.locator('.rune-reward-orbit-inner')
 const rotation=element=>new DOMMatrixReadOnly(getComputedStyle(element).transform).b
 const outerStart=await outer.evaluate(rotation),innerStart=await inner.evaluate(rotation)
 assert(outerStart>0&&innerStart<0,'The two rings must rotate in opposite directions')
 await page.waitForFunction(previous=>{
  const ring=document.querySelector('.rune-reward-orbit-outer')
  return Math.abs(new DOMMatrixReadOnly(getComputedStyle(ring).transform).b-previous)>.02
 },outerStart)
 await fit()
 assert.equal(await page.locator('.rune-reward-equip').textContent(),'Снарядить')
 await page.screenshot({path:'art/rune-reward/root-desktop.png'})
 await page.keyboard.press('Shift+Tab')
 assert.equal(await page.locator('.rune-reward-equip').evaluate(e=>e===document.activeElement),true)
 await page.keyboard.press('Enter')
 assert.deepEqual(await slots(),['root',null]);assert.equal(await mode(),'active')
 assert.equal(await page.evaluate(()=>window.__rewardGame.input.active),true)
 assert.equal(await page.locator('.rune-reward').isVisible(),false)
 assert.equal(await outer.evaluate(e=>e.style.transform),'','Closing the reward must clean up the orbit tween')
 await defeat('ashGolem')
 assert.equal(await page.locator('.rune-reward').getAttribute('data-rune'),'fire')
 await waitForReveal()
 await page.setViewportSize({width:390,height:844});await fit()
 await page.screenshot({path:'art/rune-reward/fire-mobile.png'})
 await page.locator('.rune-reward-equip').click()
 assert.deepEqual(await slots(),['root','fire'])
 await defeat('stormLord')
 assert.equal(await page.locator('.rune-reward').getAttribute('data-rune'),'lightning')
 assert.equal(await page.locator('.rune-reward-choice').isVisible(),true)
 await waitForReveal();await fit()
 await page.screenshot({path:'art/rune-reward/lightning-mobile.png'})
 await page.keyboard.press('Shift+Tab')
 assert.equal(await page.locator('.rune-reward-equip').evaluate(e=>e===document.activeElement),true)
 await page.keyboard.press('Tab')
 assert.equal(await page.locator('.rune-reward-slots button').first().evaluate(e=>e===document.activeElement),true)
 await page.locator('.rune-reward-slots button').nth(1).click()
 assert.equal(await page.locator('.rune-reward-slots button').nth(1).getAttribute('aria-pressed'),'true')
 await page.setViewportSize({width:844,height:390});await fit()
 await page.screenshot({path:'art/rune-reward/lightning-landscape.png'})
 await page.setViewportSize({width:1280,height:900});await fit()
 await page.screenshot({path:'art/rune-reward/lightning-desktop.png'})
 await page.locator('.rune-reward-equip').click()
 assert.deepEqual(await slots(),['root','lightning']);assert.equal(await mode(),'active')
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('echo-hunt-progress')))
 assert.deepEqual(saved.slots,['root','lightning']);assert.equal(saved.defeatedBosses.length,3)
 await load();assert.deepEqual(await slots(),['root','lightning'])
 // Normal equipment management still lets the player switch to a previously earned rune.
 await page.locator('.open-runes').first().click()
 assert.equal(await page.locator('.rune-overlay').isVisible(),true)
 assert.equal(await page.locator('.rune-reward').isVisible(),false)
 await page.locator('.rune-card').nth(1).locator('button').nth(1).click()
 assert.deepEqual(await slots(),['root','fire'])
 await page.keyboard.press('Escape');assert.equal(await mode(),'active')
 // A rune granted before the actual boss kill must not trap the player on the reward.
 await page.evaluate(()=>{
  // This is a separate save fixture; bypass pagehide saving the previous run over it.
  window.__rewardGame.restarting=true
  localStorage.setItem('echo-hunt-progress',JSON.stringify({version:8,progress:window.__rewardGame.progress.snapshot(),defeatedBosses:[],grantedRunes:['root'],slots:['root',null]}))
 })
 await page.emulateMedia({reducedMotion:'reduce'})
 await load();await defeat('rootGuardian')
 await waitForReveal()
 assert.equal(await page.locator('.rune-reward-choice').isVisible(),false)
 assert.equal(await page.locator('.rune-reward-sigil').evaluate(e=>getComputedStyle(e).transform),'none')
 assert.equal(await outer.evaluate(e=>getComputedStyle(e).transform),'none')
 await page.locator('.rune-reward-equip').click()
 assert.deepEqual(await slots(),['root',null]);assert.equal(await mode(),'active')
 assert.deepEqual(errors,[])
 console.log('PASS: all three actual boss deaths reveal their rune; free slots, replacement selection, equip/resume, save/reload, existing rune menu, keyboard focus, reduced motion, desktop/mobile/landscape, already-equipped dev rune')
}finally{await browser.close()}
