import * as T from 'three'
import { stormBossCombat as rules } from '../config/bosses'

const vertex = `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`
const vortexFragment = `
  varying vec2 vUv;uniform float uTime;uniform float uFade;uniform float uSeed;
  void main(){
    float y=vUv.y;float a=vUv.x*6.2831853;
    float spiral=a*3.0+y*18.0-uTime*7.0+uSeed;
    float ribbon=pow(.5+.5*sin(spiral+sin(y*15.0-uTime*3.0)*.25),6.0);
    float cloud=.5+.5*sin(a*5.0-y*12.0+uTime*3.0);
    float jag=sin(y*37.0+floor(uTime*12.0)*2.0+uSeed)*.45;
    float bolt=1.0-smoothstep(.025,.10,abs(sin(a*2.0+y*5.0+jag-uTime*1.2)));
    float ends=smoothstep(0.0,.10,y)*(1.0-smoothstep(.75,1.0,y));
    float alpha=(.08+cloud*.09+ribbon*.38+bolt*.6)*ends*uFade;
    vec3 color=mix(vec3(.14,.20,.48),vec3(.40,.59,.97),ribbon);
    color=mix(color,vec3(.67,.90,1.0),bolt);
    gl_FragColor=vec4(color,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`
const boltFragment = `
  varying vec2 vUv;uniform float uTime;uniform float uLife;uniform float uSeed;
  float hash(float x){return fract(sin(x*127.1+uSeed)*43758.5453);}
  float zig(float y,float seed){float k=y*18.0;float n=floor(k);return mix(hash(n+seed),hash(n+1.0+seed),fract(k));}
  void main(){
    float y=vUv.y;float tick=floor(uTime*26.0);
    float center=.5+(zig(y,tick)*2.0-1.0)*.19*sin(y*3.14159);
    float d=abs(vUv.x-center);
    float core=1.0-smoothstep(.008,.021,d);float glow=exp(-d*38.0)*.7;
    float branchCenter=center+(1.0-y)*.45+sin(y*45.0+tick)*.035;
    float branch=(1.0-smoothstep(.006,.018,abs(vUv.x-branchCenter)))*step(.23,y)*(1.0-step(.66,y));
    float alpha=(core+glow+branch*.7)*uLife;
    vec3 color=mix(vec3(.28,.46,1.0),vec3(.87,.97,1.0),min(1.0,core+branch));
    gl_FragColor=vec4(color,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`
const warningFragment = `
  varying vec2 vUv;uniform float uProgress;
  void main(){
    float r=length(vUv-.5)*2.0;float p=max(.025,uProgress);
    float outer=(1.0-smoothstep(.018,.04,abs(r-.965)))*.28;
    float rim=1.0-smoothstep(.015,.055,abs(r-p*.94));
    float fill=(1.0-smoothstep(p*.93,p*.96,r))*(.10+.14*uProgress);
    float alpha=max(outer,max(rim*.85,fill))*(1.0-step(1.0,r));
    gl_FragColor=vec4(mix(vec3(.32,.40,.92),vec3(.87,.91,1.0),rim),alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`

export interface StormBolt {
  root: T.Group
  warning: T.Mesh<T.PlaneGeometry, T.ShaderMaterial>
  flash: T.Group
  scar: T.Mesh<T.RingGeometry, T.MeshBasicMaterial>
  point: T.Vector3
  age: number
  fuse: number
  struck: boolean
  active: boolean
}

export class StormBossEffects {
  readonly root = new T.Group()
  readonly vortices: { root: T.Group; shell: T.Mesh<T.CylinderGeometry, T.ShaderMaterial>; ring: T.Mesh<T.RingGeometry, T.MeshBasicMaterial>; point: T.Vector3; velocity: T.Vector3 }[]
  readonly bolts: StormBolt[]
  private clock = 0
  private vortexAge = 100
  private vortexActive = false
  private center = new T.Vector3()
  private normal = new T.Vector3()

  constructor() {
    this.root.name = 'Boss3StormEffects'
    const geometry = new T.CylinderGeometry(.95, .20, 3.3, 24, 6, true).translate(0, 1.65, 0)
    this.vortices = Array.from({length: rules.vortexCount}, (_,i) => {
      const root=new T.Group()
      const material=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:vortexFragment,
        uniforms:{uTime:{value:0},uFade:{value:0},uSeed:{value:i*1.7}},transparent:true,depthWrite:false,side:T.DoubleSide})
      const shell=new T.Mesh(geometry,material)
      const inner=new T.Mesh(geometry,material);inner.scale.set(.65,.92,.65);inner.rotation.y=1.8
      const ring=new T.Mesh(new T.RingGeometry(rules.vortexRadius-.07,rules.vortexRadius,40).rotateX(-Math.PI/2),
        new T.MeshBasicMaterial({color:'#bad6ff',transparent:true,opacity:0,depthWrite:false}))
      ring.position.y=.09;root.add(shell,inner,ring);root.visible=false;this.root.add(root)
      return {root,shell,ring,point:new T.Vector3(),velocity:new T.Vector3()}
    })
    const boltGeometry=new T.PlaneGeometry(2,8).translate(0,4,0)
    this.bolts=Array.from({length:7}, (_,i) => {
      const root=new T.Group()
      const warning=new T.Mesh(new T.PlaneGeometry(rules.boltRadius*2,rules.boltRadius*2).rotateX(-Math.PI/2),
        new T.ShaderMaterial({vertexShader:vertex,fragmentShader:warningFragment,uniforms:{uProgress:{value:0}},transparent:true,depthWrite:false,side:T.DoubleSide}))
      warning.position.y=.085
      const material=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:boltFragment,
        uniforms:{uTime:{value:0},uLife:{value:0},uSeed:{value:i*17.3}},transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending})
      const flash=new T.Group(),a=new T.Mesh(boltGeometry,material),b=new T.Mesh(boltGeometry,material)
      b.rotation.y=Math.PI/2;flash.add(a,b);flash.visible=false
      const scar=new T.Mesh(new T.RingGeometry(.65,1,40).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:'#bfdcff',transparent:true,opacity:0,depthWrite:false}))
      scar.scale.setScalar(rules.boltRadius);scar.position.y=.095
      root.add(warning,flash,scar);root.visible=false;this.root.add(root)
      return {root,warning,flash,scar,point:new T.Vector3(),age:0,fuse:1,struck:false,active:false}
    })
  }

  prepareVortices(center:T.Vector3, facing:number) {
    this.center.copy(center);this.vortexAge=0;this.vortexActive=false
    this.vortices.forEach((v,i) => {
      const angle=facing+i*Math.PI*2/rules.vortexCount
      // Offset each storm's crossing phase. Equal crossing times preserve
      // their spacing after reflections: some stay outside while others cross
      // the center, without all six gathering into one central cluster.
      const across=[0,.7,-1.2,.5,-.8,1.3][i]
      const halfChord=Math.sqrt(rules.vortexTravelRadius**2-across**2)
      const along=halfChord*(2*i/rules.vortexCount-1)
      const heading=angle-Math.atan2(across,along)
      const speed=2*halfChord/rules.vortexCrossingTime
      v.point.copy(center).add(new T.Vector3(Math.sin(heading)*along+Math.cos(heading)*across,0,Math.cos(heading)*along-Math.sin(heading)*across))
      v.velocity.set(Math.sin(heading)*speed,0,Math.cos(heading)*speed)
      v.root.position.copy(v.point);v.root.visible=true;v.shell.material.uniforms.uFade.value=0;v.ring.material.opacity=.5
    })
  }

  summonVortices() { this.vortexAge=0;this.vortexActive=true }

  private moveVortex(v: typeof this.vortices[number], dt: number) {
    // Consume the frame up to each wall contact, then reflect the remaining
    // movement. This keeps speed continuous and the footprint inside the arena.
    let remaining=dt
    for(let bounce=0;remaining>1e-7&&bounce<4;bounce++) {
      const x=v.point.x-this.center.x,z=v.point.z-this.center.z
      const endX=x+v.velocity.x*remaining,endZ=z+v.velocity.z*remaining
      if(endX*endX+endZ*endZ<=rules.vortexTravelRadius**2) {
        v.point.addScaledVector(v.velocity,remaining)
        break
      }
      const speedSquared=v.velocity.lengthSq(),along=x*v.velocity.x+z*v.velocity.z
      const discriminant=along*along+speedSquared*(rules.vortexTravelRadius**2-x*x-z*z)
      const contact=T.MathUtils.clamp((-along+Math.sqrt(Math.max(0,discriminant)))/speedSquared,0,remaining)
      v.point.addScaledVector(v.velocity,contact)
      this.normal.copy(v.point).sub(this.center).setY(0).normalize()
      v.velocity.reflect(this.normal)
      v.point.addScaledVector(this.normal,-1e-6)
      remaining-=contact
    }
  }

  schedule(points:T.Vector3[]) {
    const free=this.bolts.filter(b=>!b.active)
    if(free.length<points.length) throw Error('Storm lightning pool is exhausted')
    points.forEach((p,i) => {
      const bolt=free[i];bolt.point.copy(p);bolt.root.position.copy(p);bolt.root.visible=true
      bolt.age=0;bolt.fuse=rules.boltWarning+(Math.random()-.5)*.12;bolt.struck=false;bolt.active=true
      bolt.warning.visible=true;bolt.warning.material.uniforms.uProgress.value=0;bolt.flash.visible=false;bolt.scar.visible=false
    })
  }

  update(dt:number,player:T.Vector3) {
    this.clock+=dt
    const struck:StormBolt[]=[]
    if(this.vortexActive) {
      this.vortexAge+=dt
      const alive=this.vortexAge<rules.vortexDuration
      const fade=T.MathUtils.smoothstep(this.vortexAge,0,.25)*(1-T.MathUtils.smoothstep(this.vortexAge,9.2,10))
      this.vortices.forEach((v,i) => {
        this.moveVortex(v,dt)
        v.root.position.copy(v.point);v.root.visible=alive;v.shell.rotation.y=this.clock*.7
        v.shell.material.uniforms.uTime.value=this.clock;v.shell.material.uniforms.uFade.value=fade
        v.ring.material.opacity=alive?.6:0
      })
      if(!alive)this.vortexActive=false
    }
    for(const bolt of this.bolts) {
      if(!bolt.active)continue
      bolt.age+=dt
      if(!bolt.struck&&bolt.age>=bolt.fuse) { bolt.struck=true;struck.push(bolt);bolt.warning.visible=false;bolt.flash.visible=true;bolt.scar.visible=true }
      bolt.warning.material.uniforms.uProgress.value=Math.min(1,bolt.age/bolt.fuse)
      const after=bolt.age-bolt.fuse
      const flashLife=Math.max(0,1-after/.26)
      bolt.flash.visible=bolt.struck&&flashLife>0
      for(const child of bolt.flash.children) {
        const m=(child as T.Mesh<T.PlaneGeometry,T.ShaderMaterial>).material
        m.uniforms.uTime.value=this.clock;m.uniforms.uLife.value=flashLife
      }
      bolt.scar.material.opacity=bolt.struck?Math.max(0,.8*(1-after/.38)):0
      if(bolt.struck&&after>=.38) { bolt.active=false;bolt.root.visible=false }
    }
    const inVortex=this.vortexActive&&this.vortexAge>=.25&&this.vortexAge<rules.vortexDuration&&this.vortices.some(v=>v.point.distanceToSquared(player)<=rules.vortexRadius**2)
    return {struck,inVortex}
  }

  clear() {
    this.vortexAge=100;this.vortexActive=false
    for(const v of this.vortices)v.root.visible=false
    for(const b of this.bolts){b.active=false;b.root.visible=false;b.flash.visible=false;b.warning.visible=false}
  }
}
