import { HomeCamp } from '../world/HomeCamp'
import { localize, onLanguageChange } from '../i18n'
import { crazyGames } from '../platform/CrazyGames'
import { AudioSystem } from '../audio/AudioSystem'
import { loadSettings, storeSettings } from '../systems/Settings'
import { NeutralToneMapping, OrthographicCamera, Vector3, WebGLRenderer } from 'three'
import { hero, upgradeKeys, type Upgrade, type Talent } from '../config/balance'
import { bosses, type BossId } from '../config/bosses'
import { campEnemy, campOffsets, camps } from '../config/camps'
import type { RuneId } from '../config/runes'
import { zones, zoneAt, zonePoint, type Zone } from '../config/zones'
import { SpellVfx } from '../effects/SpellVfx'
import { ImpactVfx } from '../effects/ImpactVfx'
import { SwordSweepVfx } from '../effects/SwordSweepVfx'
import { resizeLook } from '../effects/SceneLook'
import { WorldVitals } from '../effects/WorldVitals'
import { BossController } from '../entities/BossController'
import { Enemy } from '../entities/Enemy'
import { Player } from '../entities/Player'
import { TreantModel } from '../entities/TreantModel'
import { Boss2Model } from '../entities/Boss2Model'
import { StoneBossController } from '../entities/StoneBossController'
import { Boss3Model } from '../entities/Boss3Model'
import { StormBossController } from '../entities/StormBossController'
import { InputManager } from '../input/InputManager'
import { LootSystem, type LootKind } from '../systems/LootSystem'
import { CombatEffects } from '../systems/CombatEffects'
import { HuntReadiness } from '../systems/HuntReadiness'
import { FirstBossRun } from '../systems/FirstBossRun'
import { FirstBossTimer } from '../ui/FirstBossTimer'
import { Progression } from '../systems/Progression'
import { QuestSystem } from '../systems/QuestSystem'
import { RuneSystem, type CombatTarget } from '../systems/RuneSystem'
import { SaveSystem } from '../systems/SaveSystem'
import { SpawnSystem } from '../systems/SpawnSystem'
import { HUD, type OverlayMode } from '../ui/HUD'
import { World } from '../world/World'
import { TrainingGuide } from '../ui/TrainingGuide'
import { GuideArrow } from '../effects/GuideArrow'
import {runes,runeIds} from '../config/runes'
import {EchoHunt,newEchoProgress} from '../systems/EchoHunt'
import {EchoMenu} from '../ui/EchoMenu'

const autosaveInterval = 15
const sweepCosine = Math.cos(hero.sweepAngle / 2)
interface Encounter {
  zone: Zone
  camps: (typeof camps)[number][]
  enemies: Enemy[]
  boss?: BossController | StoneBossController | StormBossController
  targets: CombatTarget[]
  removeObstacle?: () => void
}

export class Game {
  private settings = loadSettings()
  private audio = new AudioSystem(this.settings)
  private restarting = false
  private settingsReturn: 'active' | 'paused' = 'active'
  private bossWarning = ''
  private world = new World()
  private home = new HomeCamp(this.world.scene)
  private extraAttacks = 0
  private extraDelay = 0
  private comboYaw = 0
  private saves = new SaveSystem()
  private saved = this.saves.load()
  private echoData=this.saved.echo??newEchoProgress()
  private echo?:EchoHunt
  private echoMenu:EchoMenu
  private progress = new Progression(this.saved.progress)
  private defeated = new Set(this.saved.defeatedBosses)
  private runes = new RuneSystem(this.saved.slots)
  private quests = new QuestSystem(this.saved.quests)
  private hunt = new HuntReadiness(this.saved.hunt)
  private firstBossRun = new FirstBossRun(this.hunt.record, this.defeated.has('rootGuardian'))
  private sidebar = document.createElement('div')
  private timerView: FirstBossTimer
  private checkpoint: Zone = zones[0]
  private player = new Player(this.progress.stat('health'))
  private enemies = camps.flatMap(camp => camp.species.map((species, index) => {
    const [dx, dz] = campOffsets[index]
    return new Enemy(campEnemy(camp, species), new Vector3(camp.x + dx, 0, camp.z + dz), camp.id)
  }))
  private encounters = zones.map(zone => this.createEncounter(zone))
  private encounter = this.encounters[zones.indexOf(this.checkpoint)]
  private spawns = new SpawnSystem(this.enemies)
  private loot = new LootSystem(this.world.scene)
  private spells = new SpellVfx(this.world.scene)
  private impacts = new ImpactVfx(this.world.scene)
  private sweep = new SwordSweepVfx(this.world.scene)
  private guideArrow = new GuideArrow(this.world.scene)
  private vitals: WorldVitals
  private effects = new CombatEffects({
    hit: (target, damage, element) => this.hit(target, damage, element),
    burst: (point, element, radius) => this.spells.burst(point, element, radius),
    arc: (from, to) => this.spells.arc(from, to),
  })
  private camera = new OrthographicCamera(-9, 9, 7, -7, 0.1, 90)
  private renderer = new WebGLRenderer({ antialias: true })
  private hud: HUD
  private guide: TrainingGuide
  private input: InputManager
  private mode: OverlayMode = 'active'
  private rewardRune?: RuneId
  private focusSuspended = crazyGames.enabled && document.hidden
  private time = 0
  private previous = 0
  private movement = new Vector3()
  private look = new Vector3()
  private cameraOffset = new Vector3(0, 17.5, 12.25)
  private runeOrigin = new Vector3()
  private nextSave = autosaveInterval
  private rest = 0
  private collect = (kind: LootKind, amount: number) => this.collectReward(kind, amount)
  private cargoSpace = () => this.progress.stat('capacity') - this.progress.cargo
  private devInvincible = false
  private grantedRunes = new Set(this.saved.grantedRunes ?? [])

  constructor(private readonly root: HTMLElement) {
    this.renderer.toneMapping = NeutralToneMapping
    this.renderer.toneMappingExposure = 1.06
    root.prepend(this.renderer.domElement)
    this.vitals = new WorldVitals(this.world.scene, root)
    this.renderer.domElement.setAttribute('aria-label', 'Echo Hunt 3D game view')
    localize(this.renderer.domElement)
    this.hud = new HUD(root, {
      settings: this.settings,
      toggleSettings: () => this.toggleSettings(),
      changeSettings: () => { this.audio.apply(this.settings); this.resize(); return storeSettings(this.settings) },
      resetProgress: () => this.resetProgress(),
      pause: () => this.togglePause(),
      respawn: () => this.respawn(),
      toggleUpgrades: () => this.toggleUpgrades(),
      toggleRunes: () => this.toggleRunes(),
      equip: (slot, id) => this.equipRune(slot, id),
      equipReward: (slot, id) => this.equipRewardRune(slot, id),
      buy: key => this.buyUpgrade(key),
      chooseTalent: key => this.chooseTalent(key),
    })
    this.input = new InputManager(root, () => this.togglePause())
    this.echoMenu=new EchoMenu(root,this.world.scene,()=>this.beginEcho(),()=>this.leaveEcho())
    this.sidebar.className = 'hunt-sidebar'
    root.append(this.sidebar)
    this.guide = new TrainingGuide(this.sidebar, () => this.toggleUpgrades())
    this.timerView = new FirstBossTimer(this.sidebar, this.firstBossRun)
    onLanguageChange(() => {
      this.hud.updateProgress(this.progress)
      this.hud.updateRunes(this.runeAccess, this.runes.active)
      this.updateHUD()
      this.updateQuest()
    })
    root.addEventListener('click', event => {
      if (event.target instanceof Element && event.target.closest('button:not(:disabled)')) this.audio.play('click')
    })
    this.world.scene.add(this.player.model.root, ...this.enemies.map(enemy => enemy.model.root))
    this.world.setDefeated(this.defeated)
    this.resize()
    this.hud.updateProgress(this.progress)
    this.hud.updateRunes(this.runeAccess, this.runes.active)
    this.updateQuest()
    crazyGames.reportProgress(Math.round(this.defeated.size / zones.length * 100))
    crazyGames.loadingStop()
    this.respawn()
    if(this.echoUnlocked&&(this.echoData.phase==='camps'||this.echoData.phase==='boss'))this.beginEcho(true)
    new ResizeObserver(() => this.resize()).observe(root)
    document.addEventListener('visibilitychange', () => {
      if (crazyGames.enabled) {
        this.suspendForFocus(document.hidden)
        if (document.hidden) this.save()
        return
      }
      if (!document.hidden) return
      if (this.mode === 'active') this.setMode('paused')
      this.save()
    })
    window.addEventListener('blur', () => {
      if (crazyGames.enabled) this.suspendForFocus(true)
      else if (this.mode === 'active') this.setMode('paused')
      this.save()
    })
    window.addEventListener('focus', () => {
      if (crazyGames.enabled && !document.hidden) this.suspendForFocus(false)
    })
    window.addEventListener('pagehide', () => this.save())
    this.renderer.setAnimationLoop(now => this.frame(now))
    if (import.meta.env.DEV) {
      void import('../dev/DevTools').then(({ DevTools }) => new DevTools(root, {
        invincible: enabled => {
          this.devInvincible=enabled
          if(enabled){this.player.health.restore();if(this.mode==='dead')this.setMode('active')}
          return enabled?'Бессмертие включено.':'Бессмертие выключено.'
        },
        gold: amount => this.devGrant('gold',amount),
        xp: amount => this.devGrant('xp',amount),
        rune: (id,slot) => this.devRune(id,slot),
      }))
    }
  }

  private createEncounter(zone: Zone): Encounter {
    const enemies = this.enemies.filter(enemy => enemy.zone === zone)
    const localCamps = camps.filter(camp => camp.zone === zone.id)
    const targets: CombatTarget[] = [...enemies]
    if (this.defeated.has(zone.boss)) return { zone, camps: localCamps, enemies, targets }
    const position = new Vector3(zonePoint(zone, 0, zone.arena).x, 0, zonePoint(zone, 0, zone.arena).z)
    const boss = this.createBoss(zone.boss, position)
    targets.push(boss)
    return { zone, camps: localCamps, enemies, targets, boss, removeObstacle: this.world.addObstacle(zonePoint(zone, 0, zone.arena).x, zonePoint(zone, 0, zone.arena).z, 1.05) }
  }

  private createBoss(id: BossId, position: Vector3) {
    return id === 'ashGolem' ? new StoneBossController(new Boss2Model(), position, this.world.scene)
      : id === 'stormLord' ? new StormBossController(new Boss3Model(), position, this.world.scene)
      : new BossController(id, bosses[id], new TreantModel(), position, this.world.scene)
  }

  private get echoUnlocked(){return this.defeated.size===3}

  private beginEcho(resume=false){
    if(!this.echoUnlocked||!resume&&(this.mode!=='active'||this.player.position.length()>7))return
    if(this.echo?.active&&!resume)return
    this.echo??=new EchoHunt(this.echoData,this.world.scene,(x,z,r)=>this.world.addObstacle(x,z,r))
    for(const enemy of this.enemies)enemy.model.root.visible=false
    for(const encounter of this.encounters)encounter.boss?.remove()
    if(resume)this.echo.resume();else this.echo.start()
    this.encounter={zone:zones[0],camps:this.echo.camps,enemies:this.echo.enemies,boss:this.echo.boss,targets:[...this.echo.enemies,this.echo.boss]}
    this.player.reset(8);this.clearEchoEffects();this.follow(1);this.setMode('active');this.save()
  }

  private clearEchoEffects(){
    this.effects.clear();this.spells.clear();this.impacts.clear();this.sweep.clear();this.vitals.clear();this.hud.clearDamage();this.extraAttacks=0;this.runes.resetChain();this.bossWarning=''
  }

  private leaveEcho(won=false){
    if(!this.echo||!won&&!this.echo.active)return
    if(!won)this.echo.fail()
    this.echo.stop();this.clearEchoEffects()
    for(const enemy of this.enemies)enemy.model.root.visible=enemy.health.alive
    this.encounter=this.encounters[0];this.checkpoint=zones[0];this.player.reset(0)
    this.follow(1);this.setMode('active');this.hud.updateProgress(this.progress);this.save()
  }

  private get runeAccess(){return new Set([...this.defeated,...[...this.grantedRunes].map(id=>runes[id].unlock)])}

  private devGrant(kind:'gold'|'xp',amount:number){
    if(!import.meta.env.DEV)return ''
    if(!Number.isSafeInteger(amount)||amount<1||amount>1000000)return 'Введите целое число от 1 до 1000000.'
    if(kind==='gold')this.progress.addGold(amount);else this.grantXp(amount)
    this.hud.updateProgress(this.progress);this.save()
    return `Получено ${amount} ${kind==='gold'?'золота':'опыта'}.`
  }

  private devRune(id:RuneId,slot:0|1){
    if(!import.meta.env.DEV||!runeIds.includes(id)||(slot!==0&&slot!==1))return ''
    this.grantedRunes.add(id)
    this.runes.equip(slot,id,this.runeAccess)
    this.hud.updateRunes(this.runeAccess,this.runes.active);this.save()
    return `Руна выдана и надета в слот ${slot+1}.`
  }

  private updateZone() {
    if(this.echo?.active)return
    const zone = zoneAt(this.player.position.x, this.player.position.z)
    if (zone === this.encounter.zone) return
    if (this.encounter.boss?.active) {
      this.effects.clear(this.encounter.boss)
      this.encounter.boss.reset()
    }
    this.encounter = this.encounters[zones.indexOf(zone)]
    if (this.quests.visit(zone.id)) {
      this.save()
    }
  }

  private frame(now: number) {
    this.firstBossRun.update()
    this.timerView.update()
    const dt = Math.min(0.05, Math.max(0, (now - (this.previous || now)) / 1000))
    this.previous = now
    if (this.mode === 'active' && !this.focusSuspended) {
      this.sweep.update(dt)
      this.update(dt)
      this.world.animate(dt)
      this.impacts.update(dt)
      this.follow(1 - Math.exp(-8 * dt))
    } else if (this.mode === 'dead') {
      this.player.updateModel(dt, this.time, this.movement)
    }
    this.world.updateAtmosphere(this.encounter.zone, dt)
    this.camera.updateMatrixWorld()
    this.vitals.update(this.camera, this.player, this.echo?.active?this.echo.enemies:this.enemies, this.mode === 'active' && !this.focusSuspended ? dt : 0)
    this.echoMenu.update(this.echoUnlocked,this.echoData,this.echo?.cleared??0,this.player.position.length()<=7,this.mode==='active')
    this.hud.renderPlayer(this.camera, this.player.position, this.mode === 'active' && this.player.health.alive)
    this.renderer.render(this.world.scene, this.camera)
    this.hud.renderDamage(this.camera, this.mode === 'active' && !this.focusSuspended ? dt : 0)
  }

  private update(dt: number) {
    this.time += dt
    const movement = this.input.read(this.movement)
    const player = this.player
    const { x, z } = player.position
    player.move(this.world, movement, dt, this.progress.stat('movement'))
    if(this.echo?.active&&player.position.length()>10&&zoneAt(player.position.x,player.position.z)!==zones[0])player.position.set(x,0,z)
    this.updateZone()
    if (player.position.x !== x || player.position.z !== z) this.audio.play('step')
    const { boss } = this.encounter
    const enemies = this.echo?.active?this.echo.enemies:this.enemies
    const targets = this.echo?.active?this.encounter.targets:this.encounters.flatMap(encounter => encounter.targets)
    this.effects.update(dt)
    this.home.update(dt, this.progress.baseUnlocked)
    if (this.progress.cargo > 0 && this.home.contains(player.position)) {
      const deposited = this.progress.deposit()
      this.audio.play('gold')
      this.hud.deposit(player.position, this.camera, deposited)
      this.hud.updateProgress(this.progress)
      this.save()
    }
    if (this.extraAttacks > 0) {
      this.extraDelay -= dt
      if (this.extraDelay <= 0) {
        this.extraAttacks--
        this.extraDelay = 0.085
        this.strike(targets, false, this.comboYaw)
      }
    }

    if (player.advanceAttack(dt, this.progress.stat('speed'))) {
      this.comboYaw = player.model.root.rotation.y
      this.strike(targets)
      const roll = Math.random()
      this.extraAttacks = roll < this.progress.stat('tripleAttack') ? 2
        : Math.random() < this.progress.stat('doubleAttack') ? 1 : 0
      this.extraDelay = 0.085
    }
    if (boss && !boss.health.alive) {
      this.winBoss(boss)
      return
    }

    let closest: CombatTarget | undefined
    let rangeSquared = hero.range ** 2
    for (const enemy of targets) {
      if (!enemy.health.alive || enemy.targetable === false) continue
      const distance = enemy.position.distanceToSquared(player.position)
      if (distance <= rangeSquared) {
        closest = enemy
        rangeSquared = distance
      }
    }
    const canAttack = closest !== undefined && rangeSquared <= hero.range ** 2
    if (player.attack.update(dt, canAttack, this.progress.stat('speed')) && closest) {
      player.startAttack(closest.position)
      this.audio.play('swing')
    }

    for (const enemy of enemies) {
      const damage = enemy.update(this.world, player.position, dt, this.time)
      if (damage > 0) this.hurtPlayer(damage)
      if (!player.health.alive) break
    }
    for (let i = 0; i < enemies.length; i++) {
      for (let j = i + 1; j < enemies.length; j++) enemies[i].separate(enemies[j], this.world, dt)
    }

    if (player.health.alive && boss) {
      const wasActive = boss.active
      const damage = boss.update(player.position, dt, this.time)
      const warning = boss.warningName
      if (warning && warning !== this.bossWarning) this.audio.play('warning')
      this.bossWarning = warning ?? ''
      if (wasActive && !boss.active) this.effects.clear(boss)
      if (damage > 0) this.hurtPlayer(damage)
    }
    this.spells.update(dt)
    if (player.health.alive) {
      player.health.heal(this.progress.stat('regeneration') * dt)
      this.recoverAtCheckpoint(dt)
      if (!this.echo?.active) {
        this.loot.update(dt, player.position, this.progress.stat('pickup'), this.collect, this.cargoSpace)
        this.spawns.update(dt)
      }
    }
    player.updateModel(dt, this.time, movement, closest?.health.alive ? closest.position : undefined)
    this.updateHUD()
    if (!player.health.alive) {
      if(this.echo?.active){this.leaveEcho();return}
      this.setMode('dead')
      this.save()
    } else if (this.time >= this.nextSave) {
      this.save()
    }
  }

  private recoverAtCheckpoint(dt: number) {
    const { position, health } = this.player
    const { boss, enemies } = this.encounter
    if (this.progress.baseUnlocked && this.home.contains(position)) {
      const needsHealing = health.current < health.max
      health.heal(health.max / 3 * dt)
      this.rest = needsHealing && health.current < health.max ? this.rest + dt : 0
      return
    }
    const safe = !boss?.active && health.current < health.max &&
      position.x ** 2 + position.z ** 2 < 1.5 ** 2 &&
      !enemies.some(enemy => enemy.health.alive && enemy.position.distanceToSquared(position) < 6 ** 2)
    this.rest = safe ? this.rest + dt : 0
    if (this.rest >= 2) {
      health.restore()
      this.rest = 0
    }
  }

  private updateHUD() {
    if(this.echo?.active){
      this.guideArrow.update(this.player.position,this.echo.target(),this.time)
      const boss=this.echo.boss
      this.hud.update({name:boss.config.name,health:boss.health.current,max:boss.health.max,engaged:this.echoData.phase==='boss',warning:boss.warningName,enraged:boss.enraged})
      return
    }
    this.guide.update(this.progress, this.defeated.has('rootGuardian'), this.player.health.current / this.player.health.max, this.hunt.record.campKills.ironbark ?? 0)
    const destination = this.guide.destination
    let point = destination
    if (destination?.kind === 'camp') {
      const nearest = this.enemies.filter(enemy => enemy.camp === destination.camp && enemy.health.alive)
        .sort((a, b) => a.position.distanceToSquared(this.player.position) - b.position.distanceToSquared(this.player.position))[0]
      if (nearest) point = { ...destination, x: nearest.position.x, z: nearest.position.z }
      const coin = this.loot.nearestGold(this.player.position, 9)
      if (coin && this.progress.cargo < this.progress.stat('capacity')) point = { ...destination, x: coin.x, z: coin.z }
    }
    this.guideArrow.update(this.player.position, destination?.kind === 'upgrades' ? undefined : point, this.time)
    this.root.querySelector('.open-upgrades')?.classList.toggle('tutorial-target', destination?.kind === 'upgrades')
    const { enemies, boss } = this.encounter
    if (boss?.active) {
      this.hud.update({
        name: boss.config.name, health: boss.health.current, max: boss.health.max,
        engaged: true, enraged: boss.enraged, warning: boss.warningName,
      })
      return
    }
    let enemy = enemies[0]
    let distance = Infinity
    for (const candidate of enemies) {
      if (!candidate.health.alive) continue
      const squared = candidate.position.distanceToSquared(this.player.position)
      if (squared < distance) {
        enemy = candidate
        distance = squared
      }
    }
    const nearby = distance <= enemy.config.detection ** 2
    this.hud.update({
      name: enemy.config.name, health: enemy.health.current, max: enemy.health.max, engaged: nearby,
    })
  }

  private strike(targets: readonly CombatTarget[], advanceRunes = true, yaw = this.player.model.root.rotation.y) {
    const origin = this.player.position
    this.sweep.trigger(origin, yaw)
    const forwardX = Math.sin(yaw), forwardZ = Math.cos(yaw)
    const damage = this.progress.stat('damage')
    let nearestHit = Infinity
    for (const target of targets) {
      if (!target.health.alive || target.targetable === false) continue
      const dx = target.position.x - origin.x, dz = target.position.z - origin.z
      const distanceSquared = dx * dx + dz * dz
      if (distanceSquared > hero.range ** 2) continue
      if (dx * forwardX + dz * forwardZ < Math.sqrt(distanceSquared) * sweepCosine) continue
      if (distanceSquared < nearestHit) {
        nearestHit = distanceSquared
        this.runeOrigin.copy(target.position)
      }
      const critical = Math.random() < this.progress.stat('criticalChance')
      this.hit(target, critical ? Math.ceil(damage * this.progress.stat('criticalDamage')) : damage, undefined, critical)
    }
    // A sweep advances the rune chain once, regardless of how many enemies it hits.
    if (advanceRunes && nearestHit < Infinity) this.runes.strike(this.runeOrigin, targets, this.effects)
  }

  private hit(target: CombatTarget, amount: number, element?: RuneId, critical = false) {
    if (!target.health.alive || target.targetable === false) return
    const dealt = target.damage(element ? Math.max(1, Math.round(amount * this.progress.stat('runeDamage'))) : amount)
    if (dealt > 0 && target instanceof Enemy) this.vitals.reveal(target)
    if (dealt > 0) this.audio.play(element ?? (target.health.alive ? 'hit' : 'kill'))
    if (element) this.hud.runeDamage(target.position, dealt, element)
    else {
      if (critical) this.hud.criticalDamage(target.position, dealt)
      else this.hud.damage(target.position, dealt, false)
      this.impacts.trigger(target.position, this.player.position, !target.health.alive)
    }
    if (target instanceof Enemy && !target.health.alive) {
      if(this.echo?.active&&this.echo.owns(target)){this.echo.record(target);this.save();return}
      this.loot.spawn(target.position, target.config.xp, target.config.gold)
      this.quests.kill(target.zone.id)
      if (target.camp) this.hunt.kill(target.camp)
      this.save()
    }
  }

  private hurtPlayer(damage: number) {
    if (import.meta.env.DEV && this.devInvincible) return
    if (!this.player.health.alive) return
    const dealt = this.player.damage(damage)
    if (dealt <= 0) return
    this.audio.play('hurt')
    this.hud.damage(this.player.position, dealt, true)
    this.impacts.trigger(this.player.position, this.player.position, false)
    let overlay = document.querySelector<HTMLElement>('#player-hit-flash')
    if (!overlay) {
      overlay = document.createElement('div')
      overlay.id = 'player-hit-flash'
      Object.assign(overlay.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '90' })
      document.querySelector('#game')?.append(overlay)
    }
    for (const animation of overlay.getAnimations()) animation.cancel()
    overlay.animate([
      { boxShadow: 'inset 0 0 65px 14px rgba(175, 45, 31, .16)' },
      { boxShadow: 'inset 0 0 65px 14px rgba(175, 45, 31, 0)' },
    ], { duration: 220, easing: 'ease-out' })
  }

  private winBoss(boss: BossController | StoneBossController | StormBossController) {
    if(this.echo?.active&&boss===this.echo.boss){
      const reward=this.echo.claim()
      if(reward){this.progress.addGold(reward.gold);this.audio.play('victory');this.leaveEcho(true)}
      return
    }
    if (boss.id === 'rootGuardian') {
      this.firstBossRun.finish()
      this.timerView.update()
    }
    this.extraAttacks = 0
    boss.remove()
    this.encounter.boss = undefined
    this.encounter.removeObstacle?.()
    this.encounter.removeObstacle = undefined
    this.defeated.add(boss.id)
    this.world.setDefeated(this.defeated)
    this.loot.spawn(boss.position, 0, boss.config.gold)
    this.grantXp(boss.config.xp)
    this.hud.updateProgress(this.progress)
    this.hud.updateRunes(this.runeAccess, this.runes.active)
    this.save()
    this.updateHUD()
    this.rewardRune = runeIds.find(id => runes[id].unlock === boss.id)
    this.setMode('victory', boss.id)
    crazyGames.reportProgress(Math.round(this.defeated.size / zones.length * 100))
    crazyGames.bossDefeated()
    this.audio.play('victory')
  }

  private collectReward(kind: LootKind, amount: number) {
    const accepted = kind === 'gold' ? this.progress.loadCargo(amount) : amount
    if (accepted === 0) return 0
    this.audio.play(kind)
    if (kind === 'xp') this.grantXp(accepted)
    this.hud.reward(this.player.position, accepted, kind)
    this.hud.updateProgress(this.progress)
    this.save()
    return accepted
  }

  private grantXp(amount: number) {
    const previous = { level: this.progress.level, health: this.progress.stat('health'), damage: this.progress.stat('damage') }
    if (this.progress.addXp(amount)) {
      const bonus = this.progress.claimMilestones()
      if (bonus > 0) this.hud.reward(this.player.position, bonus, 'gold')
      this.audio.play('level')
      this.player.health.grow(this.progress.stat('health'))
      this.player.health.restore()
      this.hud.levelUp(this.progress, previous)
    }
  }

  private equipRune(slot: 0 | 1, id: RuneId | null) {
    if (this.mode !== 'runes' || !this.runes.equip(slot, id, this.runeAccess)) return
    this.hud.updateRunes(this.runeAccess, this.runes.active)
    this.audio.play('equip')
    this.save()
  }

  private equipRewardRune(slot: 0 | 1, id: RuneId) {
    if (this.mode !== 'victory' || id !== this.rewardRune || !this.defeated.has(runes[id].unlock)) return
    // A rune granted by the dev panel may already occupy the selected slot.
    if (this.runes.active[slot] !== id && !this.runes.equip(slot, id, this.runeAccess)) return
    this.rewardRune = undefined
    this.hud.updateRunes(this.runeAccess, this.runes.active)
    this.save()
    this.setMode('active')
    this.audio.play('equip')
  }

  private buyUpgrade(key: Upgrade) {
    if (this.mode !== 'upgrades' || !this.progress.buy(key)) return
    this.audio.play('buy')
    if (key === 'health') this.player.health.grow(this.progress.stat('health'))
    this.hud.updateProgress(this.progress)
    this.updateHUD()
    this.save()
  }

  private chooseTalent(key: Talent) {
    if (this.mode !== 'upgrades' || !this.progress.chooseTalent(key)) return
    this.player.health.grow(this.progress.stat('health'))
    this.audio.play('buy')
    this.hud.updateProgress(this.progress)
    this.updateHUD()
    this.save()
  }

  private save() {
    if (this.restarting) return
    this.firstBossRun.update()
    this.updateQuest()
    this.hud.setSaveAvailable(this.saves.write({
      progress: this.progress.snapshot(), defeatedBosses: [...this.defeated], slots: this.runes.active, quests: this.quests.data,
      hunt: this.hunt.record,
      echo:this.echoData,grantedRunes:[...this.grantedRunes],
    }))
    this.nextSave = this.time + autosaveInterval
  }

  private updateQuest() {
    this.quests.update({
      level: this.progress.level, upgrades: upgradeKeys.reduce((total, key) => total + this.progress.rank(key), 0),
      defeated: this.defeated, slots: this.runes.active,
    })
  }

  private resize() {
    const width = Math.max(1, this.root.clientWidth)
    const height = Math.max(1, this.root.clientHeight)
    const aspect = width / height
    const halfHeight = Math.max(7.35, 5.2 / aspect)
    this.camera.left = -halfHeight * aspect
    this.camera.right = halfHeight * aspect
    this.camera.top = halfHeight
    this.camera.bottom = -halfHeight
    this.camera.updateProjectionMatrix()
    const pixelLimit = this.settings.quality === 'low' ? 0.85 : this.settings.quality === 'high' ? 2 : matchMedia('(pointer: coarse)').matches ? 1.2 : 1.5
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, pixelLimit))
    this.renderer.setSize(width, height, false)
    resizeLook(width, height)
  }

  private follow(blend: number) {
    this.look.lerp(this.player.position, blend)
    this.camera.position.copy(this.look).add(this.cameraOffset)
    this.camera.lookAt(this.look)
  }

  private togglePause() {
    if (this.mode === 'victory') return
    if (this.mode === 'settings') this.toggleSettings()
    else if (this.mode === 'upgrades') this.toggleUpgrades()
    else if (this.mode === 'runes') this.toggleRunes()
    else if (this.mode !== 'dead') this.setMode(this.mode === 'active' ? 'paused' : 'active')
  }

  private toggleUpgrades() {
    if (this.mode === 'active') this.setMode('upgrades')
    else if (this.mode === 'upgrades') this.setMode('active')
  }

  private toggleRunes() {
    if (this.mode === 'active') this.setMode('runes')
    else if (this.mode === 'runes') this.setMode('active')
  }

  private toggleSettings() {
    if (this.mode === 'settings') this.setMode(this.settingsReturn)
    else if (this.mode === 'active' || this.mode === 'paused') {
      this.settingsReturn = this.mode
      this.setMode('settings')
      this.save()
    }
  }

  private resetProgress() {
    if (this.mode !== 'settings' || !this.saves.reset()) return false
    this.restarting = true
    this.audio.stop()
    window.location.reload()
    return true
  }

  private setMode(mode: OverlayMode, victory?: BossId) {
    this.firstBossRun.setRunning(mode === 'active' && !this.focusSuspended)
    this.timerView.update()
    this.sidebar.hidden = mode !== 'active' || this.echoUnlocked
    this.mode = mode
    this.guide.setActive(mode === 'active' && !this.echoUnlocked)
    if (mode !== 'active') {
      this.guideArrow.root.visible = false
      this.root.querySelector('.open-upgrades')?.classList.remove('tutorial-target')
    }
    this.audio.stop()
    if (mode === 'dead') this.audio.play('death')
    this.input.setActive(mode === 'active' && !this.focusSuspended)
    this.hud.showOverlay(mode, victory)
    crazyGames.setGameplay(mode === 'active')
  }

  private suspendForFocus(suspended: boolean) {
    if (this.focusSuspended === suspended) return
    this.focusSuspended = suspended
    this.firstBossRun.setRunning(this.mode === 'active' && !suspended)
    this.audio.setSuspended(suspended)
    this.input.setActive(this.mode === 'active' && !suspended)
    // CrazyGames handles focus telemetry itself; this only freezes our local simulation.
  }

  private respawn() {
    if(this.echo?.active){this.leaveEcho();return}
    this.rest = 0
    this.extraAttacks = 0
    this.player.reset(this.progress.baseUnlocked ? 0 : 8)
    this.encounter = this.encounters[zones.indexOf(this.checkpoint)]
    for (const enemy of this.enemies) {
      if (enemy.health.alive) enemy.reset()
    }
    for (const encounter of this.encounters) encounter.boss?.reset()
    this.runes.resetChain()
    this.effects.clear()
    this.spells.clear()
    this.impacts.clear()
    this.sweep.clear()
    this.vitals.clear()
    this.hud.clearDamage()
    this.follow(1)
    this.setMode('active')
    this.updateHUD()
  }
}
