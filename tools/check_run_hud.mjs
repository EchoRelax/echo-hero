import {createRequire} from 'node:module'
import {join} from 'node:path'
import assert from 'node:assert/strict'
const require=createRequire(join(process.env.TEMP,'echo-hero-qa','package.json'))
const {chromium}=require('playwright')
const browser=await chromium.launch({headless:true,channel:'msedge'})
const errors=[]
for(const [width,height] of [[1440,900],[390,844],[320,740],[844,390]]){
 for(const language of ['ru','en']){
  const context=await browser.newContext({viewport:{width,height}})
  await context.addInitScript(lang=>localStorage.setItem('echo-hunt-settings',JSON.stringify({language:lang})),language)
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
  await page.goto('http://127.0.0.1:5173/');await page.locator('.cargo:not([hidden])').waitFor()
  const layout=await page.evaluate(()=>{
   const timer=document.querySelector('.first-boss-timer'),cargo=document.querySelector('.cargo'),guide=document.querySelector('.training-guide')
   const t=timer.getBoundingClientRect(),c=cargo.getBoundingClientRect(),g=guide.getBoundingClientRect(),style=getComputedStyle(cargo)
   return {belowGuide:t.y>=g.bottom+5,noOverlap:t.right<=c.x||t.x>=c.right||t.bottom+5<=c.y||t.y>=c.bottom+5,cargoVisible:c.x>=0&&c.right<=innerWidth&&c.y>=0&&c.bottom<=innerHeight,plain:style.backgroundImage==='none'&&style.borderTopWidth==='0px'&&!cargo.querySelector('svg'),notInHeader:!document.querySelector('.resources .cargo')}
  })
  if(!layout.noOverlap){console.log(await page.evaluate(()=>[...document.querySelectorAll('.training-guide,.first-boss-timer,.cargo')].map(n=>({name:n.className,rect:n.getBoundingClientRect().toJSON()}))));await page.screenshot({path:'art/ui/run-hud-overlap.png'})}
  assert.deepEqual(layout,{belowGuide:true,noOverlap:true,cargoVisible:true,plain:true,notInHeader:true},`${width}x${height} ${language}`)
  if(language==='ru')await page.screenshot({path:`art/ui/run-hud-${width}x${height}.png`})
  await page.locator('.training-dismiss').click();assert(await page.locator('.first-boss-timer').isVisible())
  await page.locator('.open-settings').click()
  const stopped=await page.locator('.first-boss-timer time').textContent()
  await page.waitForTimeout(150)
  assert.equal(await page.locator('.first-boss-timer time').textContent(),stopped)
  console.log(`${width}x${height} ${language}: sidebar, compact cargo, tutorial dismissal and menu pause passed`)
  await context.close()
 }
}
const context=await browser.newContext({viewport:{width:900,height:700}})
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
await page.goto('http://127.0.0.1:5173/');await page.locator('.pause').click()
const core=await page.evaluate(async()=>{
 const {FirstBossRun}=await import('/src/systems/FirstBossRun.ts')
 const {formatRunTime}=await import('/src/ui/FirstBossTimer.ts')
 const record={campKills:{}}
 const run=new FirstBossRun(record,false)
 run.setRunning(true,1000);run.update(5000);run.setRunning(false,6000);run.update(12000)
 if(run.seconds!==5)throw Error('Pause includes idle time')
 run.setRunning(true,20000);run.finish(23500);run.setRunning(true,24000);run.update(99000)
 if(run.seconds!==8.5||!run.completed)throw Error('First boss does not freeze the clock')
 if(formatRunTime(3599)!=='59:59'||formatRunTime(3600)!=='1:00:00')throw Error('Hour formatting incorrect')
 const unknown=new FirstBossRun({campKills:{}},true)
 if(unknown.seconds!==undefined)throw Error('Legacy victory fabricates a completion time')
 return 'Active wall time, pause, finish, old records and formatting passed'
})
console.log(core)
await page.evaluate(async()=>{
 const {Game}=await import('/src/game/Game.ts')
 const {newProgress}=await import('/src/systems/Progression.ts')
 const progress=newProgress();progress.gold=79;progress.baseUnlocked=true
 localStorage.setItem('echo-hunt-progress',JSON.stringify({version:6,progress,defeatedBosses:[],slots:[null,null],quests:{completed:0,kills:{valley:0,canyon:0,ruins:0},visited:['valley']},hunt:{campKills:{}}}))
 const root=document.querySelector('#game');root.replaceChildren()
 const game=new Game(root);game.renderer.setAnimationLoop(null);window.testGame=game
 game.player.position.set(0,0,5);game.progress.loadCargo(17);game.follow(1);game.hud.updateProgress(game.progress);game.frame(performance.now())
 game.vitals.reveal(game.enemies[0]);game.frame(performance.now())
})
assert.equal(await page.locator('.cargo-value').textContent(),'17 / 20')
const mob=await page.locator('.mob-vitals:not([hidden])').first().evaluate(n=>({width:n.offsetWidth,height:n.offsetHeight,plain:getComputedStyle(n).backgroundImage==='none',healthText:n.querySelectorAll('.mob-health').length,coin:n.querySelectorAll('.mob-gold svg.ui-icon').length}))
assert.deepEqual(mob,{width:104,height:27,plain:true,healthText:0,coin:1})
await page.locator('.mob-vitals:not([hidden])').first().screenshot({path:'art/ui/mob-vitals-minimal.png'})
await page.evaluate(()=>{const g=window.testGame;g.player.position.z=2.5;g.follow(1);g.frame(performance.now()+16)})
assert(await page.locator('.flying-coin').count()>0)
assert.equal(await page.locator('.wallet strong').textContent(),'79')
assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('echo-hunt-progress')).progress.gold),96)
await page.waitForTimeout(250);await page.screenshot({path:'art/ui/camp-gold-transfer.png'})
await page.waitForFunction(()=>document.querySelector('.wallet strong').textContent==='96')
await page.waitForFunction(()=>!document.querySelector('.flying-coin'))
assert.equal(await page.locator('.cargo-value').textContent(),'0 / 20')
// Opening a menu mid-flight settles the display without losing banked coins.
await page.evaluate(()=>{const g=window.testGame;g.progress.loadCargo(10);g.frame(performance.now()+32);g.toggleUpgrades()})
assert.equal(await page.locator('.wallet strong').textContent(),'106')
assert.equal(await page.locator('.flying-coin').count(),0)
await page.evaluate(()=>window.testGame.toggleUpgrades())
const finalTime=await page.evaluate(()=>{const g=window.testGame;g.winBoss(g.encounters[0].boss);return g.firstBossRun.seconds})
await page.waitForTimeout(100)
assert.equal(await page.evaluate(()=>{const g=window.testGame;g.frame(performance.now());return g.firstBossRun.seconds}),finalTime)
await page.evaluate(()=>window.testGame.toggleRunes())
assert(await page.locator('.first-boss-timer.completed').isVisible())
assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('echo-hunt-progress')).hunt.firstBossSeconds),finalTime)
console.log('Real camp entry: visible coin flight, arrival-synced count, exact save, menu cancellation and actual boss-win freeze passed')
await context.close();await browser.close();assert.deepEqual(errors,[])
