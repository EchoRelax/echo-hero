import {createRequire} from 'node:module'
import {join} from 'node:path'
import assert from 'node:assert/strict'
const require=createRequire(join(process.env.TEMP,'echo-hero-qa','package.json'))
const {chromium}=require('playwright')
const browser=await chromium.launch({headless:true,channel:'msedge'})
const errors=[]
for(const [width,height] of [[1920,1080],[1600,900],[1440,900],[1366,768],[1280,720],[1024,768],[960,540],[800,600],[844,390]]){
 for(const language of ['ru','en']){
  const context=await browser.newContext({viewport:{width,height}})
  await context.addInitScript(lang=>{
   localStorage.setItem('echo-hunt-settings',JSON.stringify({language:lang}))
   localStorage.setItem('echo-hunt-progress',JSON.stringify({version:6,progress:{level:2,xp:0,gold:57,cargo:0,baseUnlocked:true,milestonePaid:0,talents:{warrior:0,resilience:0,gatherer:0},upgrades:{damage:1,health:0,speed:0,pickup:0}},defeatedBosses:[],slots:[null,null],quests:{completed:0,kills:{valley:0,canyon:0,ruins:0},visited:['valley']},hunt:{campKills:{}}}))
  },language)
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message))
  await page.goto('http://127.0.0.1:5173/');await page.locator('.open-upgrades').click();await page.evaluate(()=>document.fonts.ready)
  const layout=await page.locator('.upgrades-panel').evaluate(panel=>{
   const body=panel.querySelector('.upgrade-list'),r=body.getBoundingClientRect()
   const rows=[...body.querySelectorAll('.upgrade-row')]
   return {vertical:body.scrollHeight>body.clientHeight+1,horizontal:body.scrollWidth>body.clientWidth+1,allVisible:rows.every(n=>{const b=n.getBoundingClientRect();return b.y>=r.y&&b.bottom<=r.bottom+1}),descriptions:body.querySelectorAll('small').length,icons:body.querySelectorAll('.upgrade-icon svg').length,overflows:rows.filter(n=>[...n.querySelectorAll('.upgrade-info,.upgrade-buy')].some(el=>el.scrollWidth>el.clientWidth+1)).map(n=>n.dataset.upgrade),splitValues:rows.filter(n=>{const s=n.querySelector('.upgrade-stats'),a=s.firstElementChild,b=s.querySelector('.upgrade-stat-next');return b&&Math.abs(a.getBoundingClientRect().y-b.getBoundingClientRect().y)>1}).map(n=>n.dataset.upgrade)}
  })
  if(language==='ru')await page.screenshot({path:`art/ui/upgrade-grid-${width}x${height}.png`})
  assert.deepEqual(layout,{vertical:false,horizontal:false,allVisible:true,descriptions:0,icons:12,overflows:[],splitValues:[]},`${width}x${height} ${language}`)
  await page.locator('[data-upgrade="damage"] .upgrade-buy').click()
  assert.equal(await page.locator('.upgrade-gold').textContent(),'51')
  await page.locator('.talent-toggle').click()
  assert(await page.locator('.upgrade-list').isHidden());assert(await page.locator('.talent-section').isVisible())
  await page.locator('.talent-toggle').click();assert.equal(await page.locator('.upgrade-row:visible').count(),12)
  await page.locator('.close-upgrades').click()
  assert(await page.locator('.open-upgrades').evaluate(n=>n===document.activeElement))
  console.log(`${width}x${height} ${language}: 12 upgrades, no scrolling, readable values, purchase and talent view passed`)
  await context.close()
 }
}
await browser.close();assert.deepEqual(errors,[])
