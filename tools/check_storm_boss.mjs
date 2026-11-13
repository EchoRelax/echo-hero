import {createRequire} from 'node:module'
import {join} from 'node:path'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const require=createRequire(join(process.env.TEMP,'echo-hero-qa','package.json'))
const {chromium}=require('playwright')
const browser=await chromium.launch({headless:true,channel:'msedge'})
const context=await browser.newContext({viewport:{width:1280,height:900}})
const page=await context.newPage(),errors=[],failed=[]
page.on('pageerror',e=>errors.push(e.message))
page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
page.on('response',r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`)})
await page.route('**/src/main.ts*',async route=>{
 const response=await route.fetch(),body=await response.text()
 await route.fulfill({response,body:body.replace('new Game(root)','window.__stormGame = new Game(root)')})
})
const out='art/enemies/storm/integration-qa';mkdirSync(out,{recursive:true})
try{
 await page.goto(process.env.ECHO_QA_URL??'http://127.0.0.1:5176/')
 await page.waitForFunction(()=>window.__stormGame,{timeout:60000})
 const report=await page.evaluate(()=>{
  const g=window.__stormGame;g.renderer.setAnimationLoop(null)
  const b=g.encounters.find(e=>e.zone.id==='ruins').boss
  const check=(ok,msg)=>{if(!ok)throw Error(msg)}
  check(b.model.root.getObjectByName('Boss3Rig'),'Missing Boss3 GLB')
  const wisps=g.enemies.filter(e=>e.config.model==='wisp')
  check(wisps.length&&wisps.every(e=>e.model.root.getObjectByName('StormWispBody')),'Stormwisp not assigned')
  check(!b.config.attacks.some(a=>['Thunder Lance','Tempest Field'].includes(a.name)),'Old attacks remain')
  let time=0
  const point=(x,z)=>b.position.clone().add({x,y:0,z})
  const tick=p=>b.update(p,1/60,time+=1/60)
  const run=(n,p)=>{let damage=0;for(let i=0;i<n;i++)damage+=tick(p);return damage}
  b.reset();tick(point(0,5));check(b.model.current==='Fly','Boss does not fly')
  b.debugAttack('melee',point(0,2.4));let p=point(0,2.4)
  check(run(35,p)===0,'Melee hits before animation contact')
  check(run(10,p)===55&&b.model.current==='Melee','Melee damage/animation mismatch')
  b.debugAttack('melee',point(0,2.4));check(run(55,point(0,5))===0,'Melee cannot be dodged')
  b.debugAttack('vortices',point(0,4));p=point(0,0)
  run(80,p);check(b.effects.vortices.filter(v=>v.root.visible).length===6,'Missing tornadoes')
  const first=b.effects.vortices[0].point.clone()
  // Keep AI idle while observing the autonomous ten-second hazard lifetime.
  b.state='idle';b.specialCooldown=100;b.basicCooldown=100
  run(90,p);check(first.distanceTo(b.effects.vortices[0].point)>2,'Tornadoes do not travel')
  const hitPoint=b.effects.vortices[0].point.clone()
  b.vortexCooldown=0
  const contact=tick(hitPoint);check(contact===42,'Tornado collider does not match its position')
  check(tick(b.effects.vortices[0].point.clone())===0,'Tornado deals damage every frame')
  run(499,point(0,0));check(b.effects.vortices.some(v=>v.root.visible),'Tornadoes expire before ten seconds')
  run(15,point(0,0));check(b.effects.vortices.every(v=>!v.root.visible),'Tornadoes last longer than ten seconds')
  b.debugAttack('vortices',point(0,4));run(80,point(0,-8))
  b.state='idle';b.specialCooldown=b.basicCooldown=100
  const center=b.anchor.clone(),paths=b.effects.vortices.map(()=>({min:Infinity,max:0})),quadrants=new Set()
  let minOuterReach=Infinity
  for(let frame=0;frame<560;frame++) {
   const previous=b.effects.vortices.map(v=>v.point.clone())
   tick(point(0,-8))
   b.effects.vortices.forEach((v,i)=>{
    const offset=v.point.clone().sub(center),radius=offset.length()
    paths[i].min=Math.min(paths[i].min,radius);paths[i].max=Math.max(paths[i].max,radius)
    quadrants.add(`${offset.x>=0}:${offset.z>=0}`)
    check(radius<=5.80001,'Tornado footprint leaves the arena')
    check(v.point.distanceTo(previous[i])<=v.velocity.length()/60+.00001,'Tornado teleports at a bounce')
    check(v.root.position.distanceTo(v.point)<1e-6,'Tornado visual and collider diverge')
   })
   minOuterReach=Math.min(minOuterReach,Math.max(...b.effects.vortices.map(v=>v.point.distanceTo(center))))
  }
  check(paths.every(p=>p.max-p.min>2.5),'Tornadoes still stay on a ring')
  check(paths.some(p=>p.min<1),'Center remains permanently safe')
  check(quadrants.size===4,'Tornadoes do not cover all arena sectors')
  check(minOuterReach>3,'All tornadoes crowd the center at the same time')
  b.debugAttack('lightning',point(0,4));p=point(0,4)
  check(b.scheduled===6&&b.effects.bolts.filter(x=>x.active).length===6,'Expected initial six lightning warnings')
  const target=b.effects.bolts.find(x=>x.active).point.clone(),fuse=b.effects.bolts.find(x=>x.active).fuse
  const start=b.effects.bolts[0].warning.material.uniforms.uProgress.value
  check(run(20,target)===0,'Lightning damages before radius threshold')
  check(b.effects.bolts[0].warning.material.uniforms.uProgress.value>start,'Warning circle does not expand')
  let hit=0,firstStrike=-1,maxActive=0
  for(let i=20;i<300;i++){
   const damage=tick(target);hit+=damage
   if(damage&&firstStrike<0)firstStrike=(i+1)/60
   maxActive=Math.max(maxActive,b.effects.bolts.filter(x=>x.active).length)
  }
  check(firstStrike>=fuse-1/60,'Lightning hits before its circle reaches full radius')
  check(b.scheduled===18&&b.strikes===18,`Expected 18 bolts: ${b.scheduled}/${b.strikes}`)
  check(maxActive<=7,'Too many simultaneous lightning markers')
  check(b.state==='recoverLightning'||b.state==='lightning','Cast lasts less than five seconds')
  const batchDamage=hit
  // Telegraphed circles have fixed positions; leaving one avoids the strike.
  b.debugAttack('lightning',point(0,4));const safe=point(0,-8)
  check(run(301,safe)===0,'Lightning is unavoidable outside its markers')
  // One marker's strike damages once; the visual flash is not a repeated hitbox.
  b.reset();b.active=true;b.state='idle';b.specialCooldown=b.basicCooldown=100
  b.effects.schedule([point(0,3)]);p=point(0,3)
  let singleDamage=run(110,p);check(singleDamage===95,`Repeated lightning damage ${singleDamage}`)
  // Exact durations and bolt count also hold in enrage.
  b.debugAttack('lightning',point(0,4));b.damage(10000);run(301,point(0,-8))
  check(b.scheduled===18&&b.strikes===18,'Enrage changed bolt count')
  b.debugAttack('vortices',point(0,4));run(90,point(0,0));b.reset()
  check(!b.effects.vortices.some(v=>v.root.visible)&&!b.effects.bolts.some(x=>x.active),'Reset leaves hazards')
  b.debugAttack('lightning',point(0,4));b.damage(b.health.max);check(tick(point(0,4))===0&&!b.effects.bolts.some(x=>x.active),'Death leaves lightning')
  b.debugAttack('vortices',point(0,4));run(90,point(0,0));tick(point(0,15))
  check(!b.active&&b.effects.vortices.every(v=>!v.root.visible),'Leash reset leaves tornadoes')
  b.reset()
  p=point(0,4);const sequence=[]
  for(let i=0;i<1200;i++){
   tick(p)
   if(sequence.at(-1)!==b.state)sequence.push(b.state)
  }
  check(sequence.includes('vortices')&&sequence.includes('lightning')&&sequence.includes('melee'),'Natural AI does not use the complete moveset')
  b.reset()
  return {wisps:wisps.length,clips:[...b.model.actions.keys()],vortices:6,vortexSeconds:10,vortexPaths:paths,minOuterReach,arenaSectors:quadrants.size,bolts:18,castSeconds:5,maxActive,firstStrike,warningFuse:fuse,batchDamage,singleDamage,dodging:true,cleanup:true,naturalMoveset:true}
 })
 // Compose screenshots in the actual arena, running shader compilation too.
 await page.evaluate(()=>{
  const g=window.__stormGame,b=g.encounters.find(e=>e.zone.id==='ruins').boss
  b.reset();g.player.health.grow(10000);g.player.position.copy(b.position).add({x:0,y:0,z:4});g.updateZone()
  g.camera.position.copy(b.position).add({x:0,y:17,z:13});g.camera.lookAt(b.position.x,.7,b.position.z)
  g.camera.zoom=.9;g.camera.updateProjectionMatrix();g.world.updateAtmosphere(g.encounter.zone,5)
  window.__stormPreview={b,time:0,tick(n){for(let i=0;i<n;i++)b.update(g.player.position,1/60,this.time+=1/60)},draw(){
   g.camera.updateMatrixWorld();g.updateHUD();g.vitals.update(g.camera,g.player,g.enemies,0);g.hud.renderPlayer(g.camera,g.player.position,true);g.renderer.render(g.world.scene,g.camera)
  }}
 })
 for(const [name,kind,frames] of [['vortices','vortices',160],['expanding-circles','lightning',40],['lightning','lightning',70]]){
  await page.evaluate(({kind,frames})=>{const p=window.__stormPreview;p.b.debugAttack(kind,window.__stormGame.player.position);p.time=0;p.tick(frames);p.draw()},{kind,frames})
  await page.locator('canvas').screenshot({path:`${out}/${name}.png`})
 }
 await page.evaluate(()=>{
  const g=window.__stormGame,p=window.__stormPreview;p.b.debugAttack('vortices',g.player.position);p.tick(160)
  // Natural follow-up overlaps lightning with the roaming storms.
  for(let i=0;i<600;i++){
   if(p.b.state==='lightning'&&p.b.elapsed>1.17)break
   p.tick(1)
  }
  p.draw()
 })
 await page.locator('canvas').screenshot({path:`${out}/combined.png`})
 if(process.env.ECHO_RECORD_PREVIEW==='1'){
  mkdirSync(`${out}/combat-frames`,{recursive:true})
  await page.evaluate(()=>{const p=window.__stormPreview;p.b.debugAttack('vortices',window.__stormGame.player.position);p.time=0})
  for(let i=0;i<144;i++){
   await page.evaluate(()=>{const p=window.__stormPreview;p.tick(5);p.draw()})
   await page.locator('canvas').screenshot({path:`${out}/combat-frames/${String(i).padStart(3,'0')}.png`})
  }
 }
 await page.evaluate(()=>{
  const g=window.__stormGame,w=g.enemies.find(e=>e.config.model==='wisp')
  g.player.position.copy(w.home).add({x:0,y:0,z:4});g.updateZone()
  g.camera.position.copy(w.home).add({x:0,y:10,z:8});g.camera.lookAt(w.home.x,.6,w.home.z);g.camera.zoom=1.4;g.camera.updateProjectionMatrix()
  g.renderer.render(g.world.scene,g.camera)
 })
 await page.locator('canvas').screenshot({path:`${out}/stormwisps.png`})
 report.victory=await page.evaluate(()=>{
  const g=window.__stormGame,b=window.__stormPreview.b
  g.encounter=g.encounters.find(e=>e.zone.id==='ruins');g.encounter.boss=b
  b.damage(b.health.max);g.winBoss(b)
  if(!g.defeated.has('stormLord')||!g.runes.equip(0,'lightning',g.defeated))throw Error('Storm boss victory does not unlock lightning')
  return true
 })
 assert.deepEqual(errors,[],'Browser/shader errors');assert.deepEqual(failed,[],'Failed asset requests')
 writeFileSync(`${out}/report.json`,JSON.stringify({...report,errors,failed},null,2));console.log(JSON.stringify(report,null,2))
}finally{await browser.close()}
