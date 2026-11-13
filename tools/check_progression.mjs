import {createRequire} from 'node:module'
import {join} from 'node:path'
import {writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const require=createRequire(join(process.env.TEMP,'echo-hero-qa','package.json'))
const {chromium}=require('playwright')
const browser=await chromium.launch({headless:true,channel:'msedge'})
const page=await browser.newPage()
await page.goto('http://127.0.0.1:5173/')
await page.locator('.pause').waitFor()
await page.locator('.pause').click()
const result=await page.evaluate(async()=>{
 const {Progression,newProgress,levelThreshold}=await import('/src/systems/Progression.ts')
 const {SaveSystem}=await import('/src/systems/SaveSystem.ts')
 const {camps,campStats,campEnemy}=await import('/src/config/camps.ts')
 const {bosses}=await import('/src/config/bosses.ts')
 const {talentKeys}=await import('/src/config/balance.ts')
 const check=(value,message)=>{if(!value)throw Error(message)}
 const p=new Progression(newProgress())
 check(p.stat('damage')===1&&p.talentPoints===0,'Fresh stats or points incorrect')
 check(!p.chooseTalent('warrior'),'Talent granted before level 5')
 p.addXp(30);check(p.level===2&&p.stat('damage')===1&&p.stat('health')===108,'Rounding doubles early damage')
 while(p.level<15)p.addXp(p.nextLevel)
 check(p.talentPoints===3,'Multiple milestone points lost')
 for(const key of talentKeys)check(p.chooseTalent(key),'Unable to spend available point')
 check(p.talentPoints===0&&!p.chooseTalent('warrior'),'Point spent twice')
 const copy=p.snapshot();copy.talents.warrior=99;check(p.talentRank('warrior')===1,'Snapshot mutates live ranks')
 const makeSave=(progress,version=6)=>({version,progress,defeatedBosses:[],slots:[null,null],quests:{completed:0,kills:{valley:0,canyon:0,ruins:0},visited:['valley']},hunt:{campKills:{}}})
 const legacy=newProgress();delete legacy.talents;legacy.level=15;legacy.gold=123;legacy.milestonePaid=3
 localStorage.setItem('echo-hunt-progress',JSON.stringify(makeSave(legacy,5)))
 const saves=new SaveSystem(), migrated=saves.load(), mp=new Progression(migrated.progress)
 check(mp.level===15&&mp.gold===123&&mp.talentPoints===3,'Old save not migrated')
 check(mp.claimMilestones()===0,'Old milestone gold paid again')
 mp.chooseTalent('gatherer');saves.write({...migrated,progress:mp.snapshot()})
 const reloaded=new Progression(saves.load().progress)
 check(reloaded.talentPoints===2&&reloaded.talentRank('gatherer')===1,'Choice not persisted')
 const invalid={...newProgress(),level:5,talents:{warrior:900,resilience:-1,gatherer:2.5}}
 localStorage.setItem('echo-hunt-progress',JSON.stringify(makeSave(invalid)))
 const safe=new Progression(saves.load().progress)
 check(safe.talentPoints===0&&safe.talentRank('warrior')===1&&safe.talentRank('resilience')===0,'Corrupt talent ranks not clamped')
 for(const lvl of [1,5,10,25,50])check(levelThreshold(lvl)>0,'XP threshold invalid')
 const profiles=[]
 for(const preferred of talentKeys){
  const progress=new Progression(newProgress())
  let kills=0,seconds=0,trips=0,spent=0
  const checkpoints=[]
  const gather=(coins,depth)=>{
   while(coins>0){const accepted=progress.loadCargo(coins);coins-=accepted;if(coins>0||progress.cargo===progress.stat('capacity')){progress.deposit();trips++;seconds+=2*depth/progress.stat('movement')}}
  }
  for(const [index,zone] of ['valley','canyon','ruins'].entries()){
   const targets={damage:[22,100,600][index],health:[180,450,950][index],capacity:[120,800,2500][index],speed:[0,8,20][index]}
   const needs=key=>key==='speed'?progress.rank(key)<targets[key]:progress.stat(key)<targets[key]
   const localCamps=camps.filter(c=>c.zone===zone)
   let stageKills=0
   while(Object.keys(targets).some(needs)){
    let candidates=Object.keys(targets).filter(needs).sort((a,b)=>progress.price(a)-progress.price(b))
    if(candidates.length&&progress.gold>=progress.price(candidates[0])){const key=candidates[0];spent+=progress.price(key);progress.buy(key);continue}
    check(stageKills<10000,'Progression stalled')
    const farm=localCamps.map(c=>{
     const definition=campEnemy(c,c.species[0]),stats=campStats(c)
     const hits=Math.ceil(stats.health/Math.max(1,Math.round(progress.stat('damage')*(1-(definition.armor??0)))))
     const depth=[13,27,41,54][c.tier]
     const fight=hits*progress.stat('speed')+.6
     const travel=2*depth/progress.stat('movement')*stats.gold/progress.stat('capacity')
     return {c,stats,hits,depth,fight,score:stats.gold/(fight+travel)}
    }).sort((a,b)=>b.score-a.score)[0]
    seconds+=farm.fight;kills++;stageKills++
    progress.addXp(farm.stats.xp);progress.claimMilestones()
    while(progress.talentPoints)progress.chooseTalent(preferred)
    gather(farm.stats.gold,farm.depth)
    // Bank partial loads whenever they cover the cheapest pending purchase.
    candidates=Object.keys(targets).filter(needs).sort((a,b)=>progress.price(a)-progress.price(b))
    if(candidates.length&&progress.gold<progress.price(candidates[0])&&progress.gold+progress.cargo>=progress.price(candidates[0])){progress.deposit();trips++;seconds+=2*farm.depth/progress.stat('movement')}
   }
   const boss=Object.values(bosses)[index]
   const bossSeconds=Math.ceil(boss.health/progress.stat('damage'))*progress.stat('speed')
   checkpoints.push({zone,level:progress.level,damage:progress.stat('damage'),health:progress.stat('health'),capacity:progress.stat('capacity'),ranks:{damage:progress.rank('damage'),health:progress.rank('health'),capacity:progress.rank('capacity'),speed:progress.rank('speed')},stageKills,totalKills:kills,minutes:Math.round(seconds/60),trips,bossSeconds:Math.round(bossSeconds),bossSpecialHits:Math.ceil(progress.stat('health')/Math.max(...boss.attacks.map(a=>a.damage)))})
   seconds+=bossSeconds;progress.addXp(boss.xp);progress.claimMilestones();while(progress.talentPoints)progress.chooseTalent(preferred);gather(boss.gold,54)
  }
  profiles.push({preferred,spent,checkpoints})
 }
 return {tests:'Rounding, milestone points, repeat spending, snapshots, v5 migration, persistence, malformed data passed',profiles}
})
await browser.close()
assert.equal(result.profiles.length,3)
for(const profile of result.profiles) {
 for(const checkpoint of profile.checkpoints) {
  assert(checkpoint.bossSeconds>=15&&checkpoint.bossSeconds<=40,'Basic boss duration outside reference range')
  assert(checkpoint.bossSpecialHits>=5&&checkpoint.bossSpecialHits<=15,'Reference health outside encounter range')
 }
 assert(profile.checkpoints[2].level<=45,'XP curve grants too many levels before final checkpoint')
 assert(profile.checkpoints[2].totalKills<2000,'Economy stalls late progression')
}
const minutes=result.profiles.map(profile=>profile.checkpoints[2].minutes)
assert(Math.max(...minutes)/Math.min(...minutes)<1.15,'Talent preference dominates the economy model')
writeFileSync('art/balance-report.json',JSON.stringify(result,null,2))
console.log(JSON.stringify(result,null,2))
