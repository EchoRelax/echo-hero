import {createRequire} from 'node:module'
import {join} from 'node:path'
import assert from 'node:assert/strict'
const require=createRequire(join(process.env.TEMP,'echo-hero-qa','package.json'))
const {chromium}=require('playwright')
const browser=await chromium.launch({headless:true,channel:'msedge'})
const errors=[]
for(const [width,height] of [[1440,900],[390,844],[320,740],[844,390]]) {
 for(const language of ['ru','en']) {
  const context=await browser.newContext({viewport:{width,height},hasTouch:width<900})
  await context.addInitScript(lang=>localStorage.setItem('echo-hunt-settings',JSON.stringify({language:lang})),language)
  const page=await context.newPage()
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto('http://127.0.0.1:5173/')
  await page.locator('.open-upgrades').waitFor()
  for(const [open,panel] of [['.open-upgrades','.upgrades-panel'],['.open-runes','.rune-panel'],['.open-settings','.settings-panel']]) {
   await page.locator(open).first().click()
   const dialog=page.locator(panel), body=dialog.locator('.modal-body:visible'),close=dialog.locator('.panel-close')
   const before=await close.boundingBox()
   const layout=await dialog.evaluate(n=>{
    const header=n.querySelector('.modal-header'),body=n.querySelector('.modal-body'),close=n.querySelector('.panel-close'),title=n.querySelector('h2')
    const r=n.getBoundingClientRect(),h=header.getBoundingClientRect(),b=body.getBoundingClientRect(),c=close.getBoundingClientRect(),t=title.getBoundingClientRect()
    return {fits:r.y>=0&&r.bottom<=innerHeight&&r.x>=0&&r.right<=innerWidth,overlap:t.right>c.x,headerOutsideBody:h.bottom<=b.top+1,pageScroll:document.documentElement.scrollHeight>innerHeight,outerScroll:n.scrollHeight>n.clientHeight,bodyOverflow:body.scrollWidth>body.clientWidth,closeTarget:c.width>=44&&c.height>=44}
   })
   assert.deepEqual(layout,{fits:true,overlap:false,headerOutsideBody:true,pageScroll:false,outerScroll:false,bodyOverflow:false,closeTarget:true},`${width} ${height} ${language} ${panel}`)
   await body.evaluate(n=>n.scrollTop=n.scrollHeight)
   assert.deepEqual(await close.boundingBox(),before,'Close button moved on scroll')
   const scrolled=await body.evaluate(n=>({scroll:n.scrollTop,needed:n.scrollHeight>n.clientHeight}))
   if(scrolled.needed)assert(scrolled.scroll>0)
   if(language==='ru')await page.screenshot({path:`art/ui/clean-${width}x${height}-${panel.slice(1)}.png`})
   await close.click()
   assert(await page.locator(open).first().evaluate(n=>n===document.activeElement),'Focus did not return')
  }
  console.log(`${width}x${height} ${language}: all three menus fit, scroll only inside body, close fixed and accessible`)
  await context.close()
 }
}
await browser.close()
assert.deepEqual(errors,[])
