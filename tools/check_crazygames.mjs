import {createRequire} from 'node:module'
import {join} from 'node:path'
import assert from 'node:assert/strict'
const require=createRequire(join(process.env.TEMP,'echo-hero-qa','package.json'))
const {chromium}=require('playwright')
const browser=await chromium.launch({headless:true,channel:'msedge'})
const save=(level,gold)=>JSON.stringify({version:6,progress:{level,xp:0,gold,cargo:0,baseUnlocked:true,milestonePaid:Math.floor(level/5),talents:{warrior:0,resilience:0,gatherer:0},upgrades:{damage:1,health:0,speed:0,pickup:0}},defeatedBosses:[],slots:[null,null],quests:{completed:0,kills:{valley:0,canyon:0,ruins:0},visited:['valley']},hunt:{campKills:{},firstBossSeconds:12}})

// Isolated SDK fixture; never connects to a player account or production data.
async function fixture(options={}){
 const context=await browser.newContext({viewport:{width:1280,height:720}})
 await context.addInitScript(({options,localSave})=>{
  if(!localStorage.getItem('__seeded')){localStorage.setItem('echo-hunt-progress',localSave);localStorage.setItem('__seeded','1')}
  if(!sessionStorage.getItem('__cg_store'))sessionStorage.setItem('__cg_store',JSON.stringify(options.cloud??{}))
  window.sdkData=JSON.parse(sessionStorage.getItem('__cg_store'));window.sdkEvents=[];window.failWrites=false
  const persist=()=>sessionStorage.setItem('__cg_store',JSON.stringify(window.sdkData))
  window.CrazyGames={SDK:{
   environment:options.disabled?'disabled':'local',
   init:async()=>{window.sdkEvents.push('init');await new Promise(r=>setTimeout(r,30));if(options.initError)throw Error('SDK init failed')},
   data:{
    getItem(key){if(options.readError)throw Error('dataModuleDisabled');return window.sdkData[key]??null},
    setItem(key,value){if(window.failWrites)throw Error('Data quota');window.sdkData[key]=value;persist()},
    removeItem(key){if(window.failWrites)throw Error('Data quota');delete window.sdkData[key];persist()},
   },
   game:{settings:{muteAudio:true},addSettingsChangeListener(listener){window.platformSettingsListener=listener},loadingStart(){window.sdkEvents.push('loadingStart')},loadingStop(){window.sdkEvents.push('loadingStop')},gameplayStart(){window.sdkEvents.push('gameplayStart')},gameplayStop(){window.sdkEvents.push('gameplayStop')},happytime(){window.sdkEvents.push('happytime')},reportGameCompletedPercentage(value){window.sdkEvents.push('progress:'+value)}},
   user:{systemInfo:{locale:'en-US'},addAuthListener(listener){window.authListener=listener}},
  }}
 },{options,localSave:options.localSave??save(1,7)})
 const page=await context.newPage();const errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 await page.goto('http://127.0.0.1:5173/')
 return {context,page,errors}
}

const {context,page,errors}=await fixture({cloud:{'echo-hunt-progress':save(5,200)}})
await page.locator('.open-upgrades').waitFor()
assert.deepEqual(await page.evaluate(()=>window.sdkEvents.filter(e=>!e.startsWith('progress:'))),['init','loadingStart','loadingStop','gameplayStart'])
assert.equal(await page.locator('.level').textContent(),'5')
assert.equal(await page.locator('.wallet strong').textContent(),'200')
assert.equal(await page.locator('html').getAttribute('lang'),'en')
await page.locator('.open-upgrades').click()
await page.locator('.talent-toggle').click();await page.locator('.talent-toggle').click()
await page.locator('.close-upgrades').click()
assert.deepEqual((await page.evaluate(()=>window.sdkEvents)).slice(-2),['gameplayStop','gameplayStart'])
const beforeFocus=await page.evaluate(()=>window.sdkEvents.length)
await page.evaluate(()=>window.dispatchEvent(new Event('blur')))
await page.evaluate(()=>window.dispatchEvent(new Event('focus')))
assert.equal(await page.evaluate(()=>window.sdkEvents.length),beforeFocus,'Focus change sends duplicate SDK gameplay events')
await page.locator('.open-settings').click();await page.locator('.language-choice').selectOption('ru')
assert.equal(await page.evaluate(()=>JSON.parse(window.sdkData['echo-hunt-settings']).language),'ru')
assert.equal(await page.evaluate(()=>localStorage.getItem('echo-hunt-settings')),null)
const sound=await page.evaluate(async()=>{
 const {AudioSystem}=await import('/src/audio/AudioSystem.ts')
 const settings={muted:false,master:.7,effects:.8,quality:'auto',language:'ru'}
 const audio=new AudioSystem(settings)
 let gain=-1
 audio.context={currentTime:0}
 audio.master={gain:{setTargetAtTime(value){gain=value}}}
 audio.apply(settings);const forced=gain
 window.platformSettingsListener({muteAudio:false});const restored=gain
 audio.apply({...settings,muted:true});window.platformSettingsListener({muteAudio:false})
 return {forced,restored,preference:gain}
})
assert.deepEqual(sound,{forced:0,restored:.7*.8,preference:0})
await page.locator('.settings-close').click();await page.locator('.open-upgrades').click()
const cloudBefore=await page.evaluate(()=>window.sdkData['echo-hunt-progress'])
await page.evaluate(()=>window.failWrites=true)
await page.locator('[data-upgrade="damage"] button').click()
assert(await page.locator('.save-status').isVisible())
assert.equal(await page.evaluate(()=>window.sdkData['echo-hunt-progress']),cloudBefore)
assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('echo-hunt-progress')).progress.gold),7)
await page.evaluate(()=>window.failWrites=false)
const protectedWrite=await page.evaluate(async()=>{
 const {gameStorage}=await import('/src/platform/CrazyGames.ts')
 window.authListener()
 try{gameStorage.setItem('echo-hunt-progress','bad');return false}catch{return true}
})
assert(protectedWrite)
assert.equal(await page.evaluate(()=>window.sdkData['echo-hunt-progress']),cloudBefore)
assert.deepEqual(errors,[])
await context.close()
console.log('SDK order, cloud priority, locale, menu lifecycle, focus, audio, write failures and account switching passed')

const migrated=await fixture({localSave:save(3,79)})
await migrated.page.locator('.open-upgrades').waitFor()
assert.equal(await migrated.page.locator('.wallet strong').textContent(),'79')
assert.equal(await migrated.page.evaluate(()=>window.sdkData['echo-hunt-sdk-migration-v1']),'1')
await migrated.page.locator('.open-settings').click()
await migrated.page.locator('.reset-request').click()
await Promise.all([migrated.page.waitForEvent('domcontentloaded'),migrated.page.locator('.reset-confirm').click()])
await migrated.page.locator('.open-upgrades').waitFor()
assert.equal(await migrated.page.locator('.level').textContent(),'1')
assert.equal(await migrated.page.locator('.wallet strong').textContent(),'0')
assert.equal(await migrated.page.evaluate(()=>JSON.parse(localStorage.getItem('echo-hunt-progress')).progress.gold),79)
await migrated.context.close()
console.log('One-time migration and reset without stale-save resurrection passed')

for(const options of [{readError:true},{initError:true}]){
 const failed=await fixture(options)
 await failed.page.waitForFunction(()=>{const text=document.querySelector('.startup-error h1')?.textContent??'';return text.includes('could not start')||text.includes('Не удалось')})
 assert.equal(await failed.page.locator('.open-upgrades').count(),0)
 assert.equal(await failed.page.evaluate(()=>JSON.parse(localStorage.getItem('echo-hunt-progress')).progress.gold),7)
 assert.equal(await failed.page.evaluate(()=>window.sdkData['echo-hunt-progress']??null),null)
 assert(!(await failed.page.evaluate(()=>window.sdkEvents)).includes('gameplayStart'))
 await failed.context.close()
}
console.log('Init and Data read failures cannot start a blank run or overwrite saves')

const disabled=await fixture({disabled:true})
await disabled.page.locator('.open-upgrades').waitFor()
assert.equal(await disabled.page.locator('.wallet strong').textContent(),'7')
assert.deepEqual(await disabled.page.evaluate(()=>window.sdkEvents),['init'])
await disabled.context.close()
console.log('Disabled SDK uses standalone storage without portal calls')
await browser.close()
