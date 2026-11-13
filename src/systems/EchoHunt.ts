import * as T from 'three'
import { camps, campEnemy, campOffsets } from '../config/camps'
import { bosses } from '../config/bosses'
import { zones, zonePoint } from '../config/zones'
import { Enemy } from '../entities/Enemy'
import { BossController } from '../entities/BossController'
import { TreantModel } from '../entities/TreantModel'

export const forestEchoCamps = camps.filter(c => ['fern','briar','ironbark'].includes(c.id))
const enemyIds=forestEchoCamps.flatMap(c=>c.species.map((_,i)=>`${c.id}:${i}`))
export interface EchoProgress {
  phase:'idle'|'camps'|'boss'|'won'|'failed'
  killed:string[]
  shards:number
  completions:number
}
export const newEchoProgress=():EchoProgress=>({phase:'idle',killed:[],shards:0,completions:0})
export function readEcho(raw:unknown,unlocked:boolean):EchoProgress {
  const data=raw as Partial<EchoProgress>|null
  const count=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:0
  const killed=Array.isArray(data?.killed)?enemyIds.filter(id=>data!.killed!.includes(id)):[]
  let phase:EchoProgress['phase']='idle'
  if(unlocked){
    if(data?.phase==='camps'||data?.phase==='boss')phase=killed.length===enemyIds.length?'boss':'camps'
    else if(data?.phase==='won'||data?.phase==='failed')phase=data.phase
  }
  return {phase,killed,shards:count(data?.shards),completions:count(data?.completions)}
}

/** First production endgame slice: one saved, repeatable forest expedition. */
export class EchoHunt {
  readonly enemies:Enemy[]=[]
  readonly boss:BossController
  readonly camps=forestEchoCamps
  readonly zone=zones[0]
  private ids=new Map<Enemy,string>()
  private markers:T.Group[]=[]
  private obstacle?:()=>void

  constructor(readonly data:EchoProgress,private scene:T.Scene,private block:(x:number,z:number,radius:number)=>()=>void){
    for(const [tier,camp] of forestEchoCamps.entries())for(const [i,species] of camp.species.entries()){
      const [dx,dz]=campOffsets[i]
      const enemy=new Enemy({...campEnemy(camp,species),name:'Forest Echo',health:[1800,2200,2800][tier],damage:[60,70,85][tier],xp:0,gold:0},new T.Vector3(camp.x+dx,0,camp.z+dz),camp.id)
      this.enemies.push(enemy);this.ids.set(enemy,`${camp.id}:${i}`);scene.add(enemy.model.root)
    }
    for(const camp of forestEchoCamps){
      const group=new T.Group(),ring=new T.Mesh(new T.RingGeometry(5.9,6.02,48).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:'#8bdac7',transparent:true,opacity:.55,depthWrite:false}))
      ring.position.y=.085;group.add(ring)
      const gem=new T.Mesh(new T.OctahedronGeometry(.22),new T.MeshBasicMaterial({color:'#a6ffe1'}));gem.position.set(0,2.7,0);group.add(gem)
      group.position.set(camp.x,0,camp.z);scene.add(group);this.markers.push(group)
    }
    const position=zonePoint(zones[0],0,zones[0].arena)
    const config={...bosses.rootGuardian,name:'Echo of the Root Guardian',health:18000,xp:0,gold:0,
      basic:{...bosses.rootGuardian.basic,damage:55,windup:.48},attacks:[{...bosses.rootGuardian.attacks[0],damage:95},{...bosses.rootGuardian.attacks[1],damage:110}] as const}
    this.boss=new BossController('rootGuardian',config,new TreantModel(),new T.Vector3(position.x,0,position.z),scene)
    this.stop()
  }
  get active(){return this.data.phase==='camps'||this.data.phase==='boss'}
  get cleared(){return forestEchoCamps.filter(c=>this.enemies.filter(e=>e.camp===c.id).every(e=>this.data.killed.includes(this.ids.get(e)!))).length}
  start(){this.data.killed=[];this.data.phase='camps';this.resume()}
  resume(){
    for(const e of this.enemies){e.reset();if(this.data.killed.includes(this.ids.get(e)!)){e.damage(e.health.max*2);e.model.root.visible=false}}
    this.boss.reset();this.boss.targetable=this.data.phase==='boss';this.bossRoot(this.data.phase==='boss')
    this.refresh()
  }
  private bossRoot(visible:boolean){
    if(!visible)this.boss.remove()
    else {this.boss.reset();this.boss.targetable=true}
    this.obstacle?.();this.obstacle=visible?this.block(this.boss.position.x,this.boss.position.z,1.05):undefined
  }
  owns(enemy:Enemy){return this.ids.has(enemy)}
  record(enemy:Enemy){
    const id=this.ids.get(enemy)
    if(!id||this.data.killed.includes(id))return
    this.data.killed.push(id)
    if(this.cleared===3){this.data.phase='boss';this.bossRoot(true)}
    this.refresh()
  }
  refresh(){this.markers.forEach((m,i)=>{m.visible=this.active&&this.enemies.some(e=>e.camp===forestEchoCamps[i].id&&!this.data.killed.includes(this.ids.get(e)!))})}
  target(){return this.data.phase==='boss'?this.boss.position:this.enemies.find(e=>e.health.alive)?.position}
  claim(){
    if(this.data.phase!=='boss'||this.boss.health.alive)return undefined
    const first=this.data.completions===0,reward={shards:first?50:20,gold:first?1500:750}
    this.data.shards+=reward.shards;this.data.completions++;this.data.phase='won';this.stop();return reward
  }
  fail(){this.data.phase='failed';this.stop()}
  stop(){for(const e of this.enemies)e.model.root.visible=false;for(const m of this.markers)m.visible=false;this.boss.remove();this.obstacle?.();this.obstacle=undefined}
}
