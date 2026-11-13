import {createRequire} from 'node:module'
import {join} from 'node:path'
import assert from 'node:assert/strict'
const require=createRequire(join(process.env.TEMP,'echo-hero-qa','package.json'))
const {chromium}=require('playwright')
const browser=await chromium.launch({headless:true,channel:'msedge'})
const page=await browser.newPage({viewport:{width:900,height:700}})
await page.addInitScript(()=>{
 localStorage.setItem('echo-hunt-settings',JSON.stringify({language:'ru'}))
 localStorage.setItem('echo-hunt-progress',JSON.stringify({version:6,progress:{level:4,xp:74,gold:0,cargo:0,baseUnlocked:false,milestonePaid:0,talents:{warrior:0,resilience:0,gatherer:0},upgrades:{damage:3,health:0,speed:0,pickup:0}},defeatedBosses:[],slots:[null,null],quests:{completed:0,kills:{valley:0,canyon:0,ruins:0},visited:['valley']},hunt:{campKills:{}}}))
})
await page.goto('http://127.0.0.1:5173/');await page.locator('.open-upgrades').waitFor()
await page.keyboard.down('s');await page.waitForTimeout(1600);await page.keyboard.up('s')
await page.locator('.level-notice:not([hidden])').waitFor({timeout:10000})
assert.equal(await page.locator('.level').textContent(),'5')
const notice=await page.locator('.level-notice').textContent()
assert(notice.includes('+8 ОЗ')&&notice.includes('+1%')&&notice.includes('талант'))
assert.equal(await page.locator('.talent-badge').textContent(),'1')
const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('echo-hunt-progress')).progress)
assert.equal(stored.level,5);assert.equal(stored.milestonePaid,1);assert.equal(stored.gold,20)
assert(await page.locator('.upgrade-overlay').isHidden(),'Level-up interrupted gameplay')
await page.locator('.level-notice').screenshot({path:'art/ui/level-up-reward.png'})
await page.locator('.open-upgrades').click();await page.locator('.talent-toggle').click();assert.equal(await page.locator('.talent-choice:visible').count(),3)
await browser.close();console.log('Live combat: level 4→5, reward notice, milestone gold, talent badge and nonblocking unlock passed')
