import {createRequire} from 'node:module'
import {join} from 'node:path'
import {mkdirSync} from 'node:fs'
import assert from 'node:assert/strict'
const require=createRequire(join(process.env.TEMP,'echo-hero-qa','package.json'))
const {chromium}=require('playwright')
const browser=await chromium.launch({headless:true,channel:'msedge'})
const context=await browser.newContext({viewport:{width:1280,height:900}})
const page=await context.newPage(),errors=[]
page.on('pageerror',e=>errors.push(e.message))
await page.route('**/src/main.ts*',async route=>{
 const response=await route.fetch(),body=await response.text()
 await route.fulfill({response,body:body.replace('new Game(root)','window.__echoGame = new Game(root)')})
})
const base={version:6,progress:{level:35,xp:0,gold:100,cargo:0,baseUnlocked:true,milestonePaid:7,talents:{warrior:0,resilience:0,gatherer:0},upgrades:{damage:60,health:80,speed:10,pickup:0}},defeatedBosses:['rootGuardian','ashGolem','stormLord'],slots:['fire','lightning'],quests:{completed:12,kills:{valley:0,canyon:0,ruins:0},visited:['valley','canyon','ruins']},hunt:{campKills:{},firstBossSeconds:60}}
async function boot(save){
 if(save)await page.addInitScript(s=>{if(!sessionStorage.getItem('echo-seeded')){localStorage.setItem('echo-hunt-progress',JSON.stringify(s));sessionStorage.setItem('echo-seeded','1')}},save)
 await page.goto('http://127.0.0.1:5176/')
 await page.waitForFunction(()=>window.__echoGame)
 await page.evaluate(()=>window.__echoGame.renderer.setAnimationLoop(null))
}
mkdirSync('art/echo',{recursive:true})
try{
 await boot(base)
 await page.evaluate(()=>window.__echoGame.frame(performance.now()))
 assert(await page.locator('.echo-action').isVisible())
 await page.locator('.echo-action').click()
 assert.equal(await page.evaluate(()=>window.__echoGame.echoData.phase),'camps')
 assert.equal(await page.evaluate(()=>window.__echoGame.echo.boss.targetable),false)
 assert.equal(await page.evaluate(()=>window.__echoGame.echo.enemies.length),17)
 assert(await page.evaluate(()=>window.__echoGame.enemies.every(e=>!e.model.root.visible)))
 await page.evaluate(()=>{
  const g=window.__echoGame
  for(const e of g.echo.enemies.filter(e=>e.camp==='fern'))g.hit(e,1e6)
  g.frame(performance.now())
 })
 assert.equal(await page.evaluate(()=>window.__echoGame.echo.cleared),1)
 await page.reload();await page.waitForFunction(()=>window.__echoGame);await page.evaluate(()=>window.__echoGame.renderer.setAnimationLoop(null))
 assert.equal(await page.evaluate(()=>window.__echoGame.echo.cleared),1)
 assert(await page.evaluate(()=>window.__echoGame.echo.enemies.filter(e=>e.camp==='fern').every(e=>!e.health.alive)))
 await page.evaluate(()=>{
  const g=window.__echoGame;for(const e of g.echo.enemies)if(e.health.alive)g.hit(e,1e6)
  g.frame(performance.now())
 })
 assert.equal(await page.evaluate(()=>window.__echoGame.echoData.phase),'boss')
 assert.equal(await page.evaluate(()=>window.__echoGame.echo.boss.targetable),true)
 await page.reload();await page.waitForFunction(()=>window.__echoGame);await page.evaluate(()=>window.__echoGame.renderer.setAnimationLoop(null))
 assert.equal(await page.evaluate(()=>window.__echoGame.echoData.phase),'boss')
 await page.evaluate(()=>{
  const g=window.__echoGame;g.player.position.copy(g.echo.boss.position).add({x:0,y:0,z:4});g.follow(1);g.frame(performance.now())
 })
 await page.screenshot({path:'art/echo/forest-boss.png'})
 await page.evaluate(()=>{const g=window.__echoGame;g.hit(g.echo.boss,1e6);g.update(1/60);g.frame(performance.now())})
 assert.equal(await page.evaluate(()=>window.__echoGame.echoData.phase),'won')
 assert.equal(await page.evaluate(()=>window.__echoGame.echoData.shards),50)
 assert.equal(await page.evaluate(()=>window.__echoGame.progress.gold),1600)
 assert.equal(await page.evaluate(()=>window.__echoGame.defeated.size),3)
 await page.screenshot({path:'art/echo/first-win.png'})
 await page.reload();await page.waitForFunction(()=>window.__echoGame);await page.evaluate(()=>{window.__echoGame.renderer.setAnimationLoop(null);window.__echoGame.frame(performance.now())})
 assert.equal(await page.evaluate(()=>window.__echoGame.progress.gold),1600,'Duplicate reward on reload')
 assert.equal(await page.evaluate(()=>window.__echoGame.echoData.shards),50)
 await page.locator('.echo-action').click()
 await page.evaluate(()=>{
  const g=window.__echoGame;for(const e of g.echo.enemies)g.hit(e,1e6);g.hit(g.echo.boss,1e6);g.update(1/60)
 })
 assert.equal(await page.evaluate(()=>window.__echoGame.echoData.shards),70)
 assert.equal(await page.evaluate(()=>window.__echoGame.progress.gold),2350)
 await page.evaluate(()=>window.__echoGame.frame(performance.now()));await page.locator('.echo-action').click()
 await page.evaluate(()=>{const g=window.__echoGame;g.hurtPlayer(1e6);g.update(1/60)})
 assert.equal(await page.evaluate(()=>window.__echoGame.echoData.phase),'failed')
 assert.equal(await page.evaluate(()=>window.__echoGame.echoData.shards),70)
 await page.evaluate(()=>window.__echoGame.frame(performance.now()));await page.locator('.echo-action').click()
 assert.equal(await page.evaluate(()=>window.__echoGame.echoData.killed.length),0)
 await page.evaluate(()=>window.__echoGame.frame(performance.now()));await page.locator('.echo-action').click()
 assert.equal(await page.evaluate(()=>window.__echoGame.echoData.phase),'failed')
 assert(await page.evaluate(()=>window.__echoGame.enemies.every(e=>e.model.root.visible===e.health.alive)))
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.__echoGame.frame(performance.now()));await page.screenshot({path:'art/echo/mobile.png'})
 assert.deepEqual(errors,[])
 // A fresh campaign has no endgame entry, and malformed progress cannot skip camps.
 await page.evaluate(()=>{window.__echoGame.restarting=true;localStorage.setItem('echo-hunt-progress',JSON.stringify({version:6,progress:{level:1,xp:0,gold:0,upgrades:{damage:0,health:0,speed:0,pickup:0}},defeatedBosses:[],echo:{phase:'boss',killed:['fake'],shards:-1}}))})
 await page.reload();await page.waitForFunction(()=>window.__echoGame);await page.evaluate(()=>{window.__echoGame.renderer.setAnimationLoop(null);window.__echoGame.frame(performance.now())})
 assert.equal(await page.locator('.echo-panel').isVisible(),false)
 assert.equal(await page.evaluate(()=>window.__echoGame.echoData.phase),'idle')
 console.log('PASS: campaign gate, 17 enemies, 3 camps, resume, boss lock, first/repeat rewards, no duplicate grant, death, quit, save migration, mobile, unchanged campaign victories')
}finally{await browser.close()}
