import {createRequire} from 'node:module'
import {join} from 'node:path'
import {mkdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const require=createRequire(join(process.env.TEMP,'echo-hero-qa','package.json'))
const {chromium}=require('playwright')
const browser=await chromium.launch({headless:true,channel:'msedge'})
const context=await browser.newContext({viewport:{width:1440,height:1000}})
const page=await context.newPage(),errors=[]
page.on('pageerror',e=>errors.push(e.message))
page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
await page.route('**/src/main.ts*',async route=>{
 const response=await route.fetch(),body=await response.text()
 await route.fulfill({response,body:body.replace('new Game(root)','window.__worldGame = new Game(root)')})
})
const out='art/world/biome-dressing';mkdirSync(out,{recursive:true})
try{
 await page.goto(process.env.ECHO_QA_URL??'http://127.0.0.1:5176/')
 await page.waitForFunction(()=>window.__worldGame,{timeout:60000})
 const report=await page.evaluate(async()=>{
  const g=window.__worldGame;g.renderer.setAnimationLoop(null)
  const {zones,insideZone,zonePoint,radialPoint}=await import('/src/config/zones.ts')
  const {camps,campOffsets}=await import('/src/config/camps.ts')
  const result={}
  const check=(ok,msg)=>{if(!ok)throw Error(msg)}
  for(const id of ['canyon','ruins']){
   const zone=zones.find(z=>z.id===id),root=g.world.scene.getObjectByName(`${id}-dressing`)
   check(root,'Missing dressing '+id)
   const features=root.userData.features,counts={}
   for(const f of features)counts[f.kind]=(counts[f.kind]??0)+1
   let triangles=0
   root.traverse(o=>{if(o.isMesh){const p=o.geometry.getAttribute('position');triangles+=(o.geometry.index?.count??p.count)/3;check([...p.array].every(Number.isFinite),'Non-finite scenery geometry')}})
   check(features.length>=80,'Biome dressing is too sparse: '+id+' '+features.length)
   check(root.children.length<=40,'Scenery was not batched')
   const boss=zonePoint(zone,0,zone.arena)
   for(const f of features){
    check(insideZone(f.x,f.z,zone,f.reach+1.3),'Feature outside biome')
    check(Math.hypot(f.x-boss.x,f.z-boss.z)>=9+f.reach-.001,'Feature crowds boss arena')
    for(const c of camps.filter(c=>c.zone===id))for(const [dx,dz] of campOffsets.slice(0,c.species.length)){
     check(Math.hypot(f.x-c.x-dx,f.z-c.z-dz)>=f.reach+1.5-.001,'Feature crowds enemy spawn')
    }
   }
   for(const collider of root.userData.colliders){
    check(Math.hypot(collider.x-boss.x,collider.z-boss.z)-collider.radius>=8,'Collider intrudes on the boss arena')
    for(const c of camps.filter(c=>c.zone===id))for(const [dx,dz] of campOffsets.slice(0,c.species.length)){
     check(Math.hypot(collider.x-c.x-dx,collider.z-c.z-dz)>collider.radius+.45,'New collider overlaps enemy spawn')
    }
   }
   // Newly introduced colliders must leave the clear central travel strip.
   const checkpoints=[radialPoint(zone,0,10),...camps.filter(c=>c.zone===id),boss]
   const route=[]
   for(let j=1;j<checkpoints.length;j++){
    const a=checkpoints[j-1],b=checkpoints[j],distance=Math.hypot(b.x-a.x,b.z-a.z)
    let clear=0,total=0
    for(let t=0;t<=distance;t+=.5){
     const x=a.x+(b.x-a.x)*t/distance,z=a.z+(b.z-a.z)*t/distance
     const newBlocked=root.userData.colliders.some(o=>(x-o.x)**2+(z-o.z)**2<(o.radius+.4)**2)
     check(!newBlocked,'Dressing blocks a travel route')
     if(!g.world.blocked(x,z,.32))clear++;total++
    }
    route.push({clear,total})
   }
   const majors=features.filter(f=>['ribcage','horned-skull','observatory','broken-arch','shattered-conduit'].includes(f.kind)).map(f=>({kind:f.kind,side:f.x*Math.cos(zone.angle)-f.z*Math.sin(zone.angle),depth:-f.x*Math.sin(zone.angle)-f.z*Math.cos(zone.angle)}))
   result[id]={counts,features:features.length,meshes:root.children.length,triangles,colliders:root.userData.colliders.length,majors,route}
  }
  return result
 })
 console.log(JSON.stringify(report,null,2))
 const shots=[['canyon','ribcage'],['canyon','horned-skull'],['canyon','dead-tree'],['ruins','observatory'],['ruins','broken-arch'],['ruins','shattered-conduit']]
 for(const [id,kind] of shots){
  const found=await page.evaluate(({id,kind})=>{
   const g=window.__worldGame,root=g.world.scene.getObjectByName(`${id}-dressing`),f=root.userData.features.find(f=>f.kind===kind)
   if(!f)return false
   g.player.position.set(f.x,f.y??0,f.z+4.5);g.updateZone()
   g.camera.position.set(f.x,13,f.z+10);g.camera.lookAt(f.x,.6,f.z);g.camera.zoom=1.15;g.camera.updateProjectionMatrix()
   g.world.updateAtmosphere(g.encounter.zone,5);g.camera.updateMatrixWorld();g.updateHUD()
   g.vitals.update(g.camera,g.player,g.enemies,0);g.hud.renderPlayer(g.camera,g.player.position,true)
   g.renderer.render(g.world.scene,g.camera)
   return true
  },{id,kind})
  if(found)await page.locator('canvas').screenshot({path:`${out}/${id}-${kind}.png`})
 }
 assert.deepEqual(errors,[])
 writeFileSync(`${out}/report.json`,JSON.stringify({...report,errors},null,2))
}finally{await browser.close()}
