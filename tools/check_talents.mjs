import {createRequire} from 'node:module'
import {join} from 'node:path'
import assert from 'node:assert/strict'
const require=createRequire(join(process.env.TEMP,'echo-hero-qa','package.json'))
const {chromium}=require('playwright')
const browser=await chromium.launch({headless:true,channel:'msedge'})
const errors=[]
for(const [width,height] of [[1440,900],[390,844],[320,740],[844,390]]){
 for(const language of ['ru','en']){
  const context=await browser.newContext({viewport:{width,height},hasTouch:width<900})
  await context.addInitScript(lang=>{
   localStorage.setItem('echo-hunt-settings',JSON.stringify({language:lang}))
   if(!localStorage.getItem('echo-hunt-progress'))localStorage.setItem('echo-hunt-progress',JSON.stringify({version:5,progress:{level:5,xp:0,gold:500,cargo:0,baseUnlocked:true,milestonePaid:1,upgrades:{damage:19,health:5,capacity:4,speed:0,pickup:0}},defeatedBosses:[],slots:[null,null],quests:{completed:0,kills:{valley:5,canyon:0,ruins:0},visited:['valley']},hunt:{campKills:{}}}))
  },language)
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
  await page.goto('http://127.0.0.1:5173/');await page.locator('.open-upgrades').waitFor()
  assert.equal(await page.locator('.talent-badge').textContent(),'1')
  await page.locator('.open-upgrades').click()
  await page.locator('.talent-toggle').click()
  assert.equal(await page.locator('.talent-choice:visible').count(),3)
  assert.equal(await page.locator('.talent-choice svg.ui-icon').count(),3)
  assert.equal(await page.locator('#talent-title').textContent(),language==='ru'?'Таланты':'Talents')
  const layout=await page.locator('.talent-section').evaluate(n=>({overflow:n.scrollWidth>n.clientWidth,bodyOverflow:n.closest('.modal-body').scrollWidth>n.closest('.modal-body').clientWidth}))
  assert.deepEqual(layout,{overflow:false,bodyOverflow:false})
  if(language==='ru')await page.screenshot({path:`art/ui/talents-${width}x${height}.png`})
  await page.locator('[data-talent="warrior"]').click()
  assert.equal(await page.locator('.talent-choice:visible').count(),0)
  assert(await page.locator('.talent-summary').textContent().then(t=>t.includes('+3%')))
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('echo-hunt-progress')).progress.talents.warrior),1)
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('echo-hunt-progress')).version),6)
  await page.locator('.close-upgrades').click()
  assert(await page.locator('.talent-badge').isHidden())
  await page.reload();await page.locator('.open-upgrades').waitFor();await page.locator('.open-upgrades').click()
  assert(await page.locator('.talent-summary').textContent().then(t=>t.includes('+3%')))
  assert.equal(await page.locator('.talent-choice:visible').count(),0)
  console.log(`${width}x${height} ${language}: old save credit, icons, choice, layout and reload passed`)
  await context.close()
 }
}
await browser.close();assert.deepEqual(errors,[])
