import { Scene, Vector3 } from 'three'
import { bosses, stormBossCombat as rules } from '../config/bosses'
import { Health } from '../game/combat'
import { StormBossEffects } from '../effects/StormBossEffects'
import { Boss3Model, type StormPose } from './Boss3Model'

type State='idle'|'melee'|'recoverMelee'|'vortices'|'recoverVortices'|'lightning'|'recoverLightning'

export class StormBossController {
  readonly id='stormLord' as const
  readonly config=bosses.stormLord
  readonly health=new Health(this.config.health)
  active=false
  targetable=true
  private anchor=new Vector3()
  private effects=new StormBossEffects()
  private state:State='idle'
  private elapsed=0
  private specialCooldown=1
  private basicCooldown=0
  private vortexCooldown=0
  private flash=0
  private facing=0
  private attackTempo=1
  private next:'vortices'|'lightning'='vortices'
  private batches=0
  private scheduled=0
  private strikes=0

  constructor(private model:Boss3Model,position:Vector3,scene:Scene) {
    this.anchor.copy(position);this.position.copy(position);scene.add(model.root,this.effects.root)
  }
  get position(){return this.model.root.position}
  get enraged(){return this.health.current<=this.health.max*this.config.enrageAt}
  get warningName(){
    return this.state==='vortices'?this.config.attacks[0].name:this.state==='lightning'?this.config.attacks[1].name:this.state==='melee'?'Quick Strike':undefined
  }
  private get tempo(){return this.enraged?this.config.enrageTempo:1}

  damage(amount:number){if(!this.targetable)return 0;this.flash=.17;return this.health.damage(amount)}
  reset(){
    this.model.root.visible=true;this.model.root.rotation.y=0;this.position.copy(this.anchor);this.health.restore();this.active=false
    this.state='idle';this.elapsed=this.basicCooldown=this.vortexCooldown=this.flash=this.batches=this.scheduled=this.strikes=0
    this.specialCooldown=1;this.next='vortices';this.effects.clear();this.model.pose('Hover',0,0)
  }
  remove(){this.active=false;this.model.root.visible=false;this.effects.clear()}
  private enter(state:State){this.state=state;this.elapsed=0}
  private face(player:Vector3){this.facing=Math.atan2(player.x-this.position.x,player.z-this.position.z);this.model.root.rotation.y=this.facing}

  private points(player:Vector3){
    const points:Vector3[]=[]
    for(let i=0;i<rules.batchSize;i++) {
      let point=this.anchor.clone()
      for(let attempt=0;attempt<40;attempt++) {
        if(i===0) {
          point.copy(player).sub(this.anchor).setY(0).add(new Vector3((Math.random()-.5)*.9,0,(Math.random()-.5)*.9)).clampLength(0,rules.arenaRadius-1).add(this.anchor)
        } else {
          const angle=Math.random()*Math.PI*2,radius=Math.sqrt(Math.random())*rules.arenaRadius
          point.copy(this.anchor).add(new Vector3(Math.sin(angle)*radius,0,Math.cos(angle)*radius))
        }
        if(points.every(p=>p.distanceToSquared(point)>(rules.boltRadius*2+.15)**2))break
      }
      points.push(point.clone())
    }
    return points
  }

  private batch(player:Vector3){this.effects.schedule(this.points(player));this.batches++;this.scheduled+=rules.batchSize}
  private begin(kind:'vortices'|'lightning',player:Vector3){
    this.face(player);this.attackTempo=this.tempo;this.enter(kind)
    if(kind==='vortices'){this.effects.prepareVortices(this.anchor,this.facing);this.next='lightning'}
    else {this.batches=this.scheduled=this.strikes=0;this.batch(player);this.next='vortices'}
  }

  debugAttack(kind:'melee'|'vortices'|'lightning',player:Vector3){
    if(!import.meta.env.DEV)return
    this.reset();this.active=true;this.attackTempo=this.tempo
    if(kind==='melee'){this.face(player);this.enter('melee')}else this.begin(kind,player)
  }

  update(player:Vector3,dt:number,_time:number){
    if(!this.health.alive||!this.targetable){this.effects.clear();return 0}
    const distance=this.position.distanceTo(player)
    if(this.active&&distance>this.config.resetRadius){this.reset();return 0}
    if(!this.active&&distance<=this.config.engageRadius)this.active=true
    this.flash=Math.max(0,this.flash-dt);this.basicCooldown=Math.max(0,this.basicCooldown-dt);this.vortexCooldown=Math.max(0,this.vortexCooldown-dt)
    const hazards=this.effects.update(dt,player)
    this.strikes+=hazards.struck.length
    let damage=hazards.struck.some(b=>b.point.distanceToSquared(player)<=rules.boltRadius**2)?this.config.attacks[1].damage:0
    if(hazards.inVortex&&this.vortexCooldown===0){damage+=this.config.attacks[0].damage;this.vortexCooldown=rules.vortexHitCooldown}
    if(!this.active){this.model.pose('Hover',0,dt,this.flash>0);return 0}
    this.elapsed+=dt
    let pose:StormPose='Hover',progress=0,power=0
    switch(this.state){
      case 'idle':
        this.specialCooldown-=dt
        if(this.specialCooldown<=0)this.begin(this.next,player)
        else if(distance<=this.config.basic.range&&this.basicCooldown===0){this.face(player);this.attackTempo=this.tempo;this.enter('melee')}
        else if(distance>this.config.basic.range*.88){
          const direction=player.clone().sub(this.position).setY(0).normalize(),candidate=this.position.clone().addScaledVector(direction,dt*rules.flySpeed)
          if(candidate.distanceTo(this.anchor)<=rules.flyRadius){this.position.copy(candidate);this.face(player);pose='Fly'}
        }
        break
      case 'melee':{
        const duration=this.config.basic.windup*this.attackTempo
        pose='Melee';progress=Math.min(1,this.elapsed/duration)*.62
        if(this.elapsed>=duration){
          const offset=player.clone().sub(this.position),ahead=offset.x*Math.sin(this.facing)+offset.z*Math.cos(this.facing)
          if(distance<=this.config.basic.range+.15&&ahead>=-.15)damage+=this.config.basic.damage
          this.basicCooldown=this.config.basic.cooldown*this.tempo;this.enter('recoverMelee')
        }
        break
      }
      case 'recoverMelee':
        pose='Melee';progress=.62+Math.min(1,this.elapsed/rules.meleeRecovery)*.38
        if(this.elapsed>=rules.meleeRecovery)this.enter('idle')
        break
      case 'vortices':{
        const duration=this.config.attacks[0].warning*this.attackTempo
        pose='VortexCast';progress=Math.min(1,this.elapsed/duration)*.65;power=Math.min(1,this.elapsed/duration)
        if(this.elapsed>=duration){this.effects.summonVortices();this.specialCooldown=this.config.recovery;this.enter('recoverVortices')}
        break
      }
      case 'recoverVortices':
        pose='VortexCast';progress=.65+Math.min(1,this.elapsed/rules.vortexRecovery)*.35
        if(this.elapsed>=rules.vortexRecovery)this.enter('idle')
        break
      case 'lightning':
        // A fixed five-second cast, with three groups of six independent warnings.
        while(this.batches<rules.batchCount&&this.elapsed>=this.batches*rules.batchInterval)this.batch(player)
        if(this.elapsed<.65){pose='StormCast';progress=this.elapsed/.65;power=progress}
        else {pose='StormChannel';power=1}
        if(this.elapsed>=rules.castDuration){this.specialCooldown=this.config.recovery;this.enter('recoverLightning')}
        break
      case 'recoverLightning':
        pose='StormCast';progress=power=1-Math.min(1,this.elapsed/rules.stormRecovery)
        if(this.elapsed>=rules.stormRecovery)this.enter('idle')
        break
    }
    this.model.pose(pose,progress,dt,this.flash>0,power)
    return damage
  }
}
