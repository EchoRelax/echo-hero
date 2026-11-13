import * as T from 'three'
import {getLanguage} from '../i18n'
import type {EchoProgress} from '../systems/EchoHunt'
import './echo-menu.css'

export class EchoMenu {
  private panel=document.createElement('section')
  private title=document.createElement('strong')
  private text=document.createElement('p')
  private bank=document.createElement('small')
  private reward=document.createElement('small')
  private action=document.createElement('button')
  private altar=new T.Group()
  private last=''
  constructor(root:HTMLElement,scene:T.Scene,start:()=>void,leave:()=>void){
    this.panel.className='echo-panel';this.panel.hidden=true;this.panel.setAttribute('aria-label','Echo Hunt')
    this.action.type='button';this.action.className='echo-action';this.action.addEventListener('click',()=>{
      if(this.action.dataset.active==='yes')leave();else start();this.action.blur()
    })
    this.panel.append(this.title,this.text,this.bank,this.reward,this.action);root.append(this.panel)
    const base=new T.Mesh(new T.CylinderGeometry(.55,.7,.4,6),new T.MeshStandardMaterial({color:'#697a77',flatShading:true}))
    base.position.y=.2
    const gem=new T.Mesh(new T.OctahedronGeometry(.32),new T.MeshBasicMaterial({color:'#9bf0d1'}));gem.position.y=1.0
    this.altar.add(base,gem);this.altar.position.set(3,0,1.8);this.altar.visible=false;scene.add(this.altar)
  }
  update(unlocked:boolean,data:EchoProgress,cleared:number,nearHome:boolean,visible:boolean){
    this.altar.visible=unlocked
    this.panel.hidden=!unlocked||!visible
    if(this.panel.hidden)return
    const active=data.phase==='camps'||data.phase==='boss',ru=getLanguage()==='ru'
    const key=[data.phase,data.shards,data.completions,cleared,nearHome,ru].join(':')
    if(key===this.last)return;this.last=key
    this.panel.dataset.phase=data.phase
    this.title.textContent=ru?'ЭХО ЛЕСА · РАНГ I':'FOREST ECHO · RANK I'
    this.text.textContent=ru?({idle:'Алтарь эха открыт. Зачисти три отмеченных лагеря и пробуди эхо Стража корней.',camps:`Зачищено лагерей: ${cleared}/3. Следуй к бирюзовым отметкам.`,boss:'Эхо Стража пробуждено. Направляйся на лесную арену.',won:'Охота завершена! Награда получена. Можно отправиться снова.',failed:'Охота прервана. Постоянные улучшения сохранены. Попробуй ещё раз.'}[data.phase]):({idle:'Clear three marked camps to awaken the Root Guardian’s echo.',camps:`Camps cleared: ${cleared}/3. Follow the teal markers.`,boss:'The Guardian’s echo is awake. Reach the forest arena.',won:'Hunt complete! Rewards received. You can hunt again.',failed:'Hunt ended. Permanent upgrades retained. Try again.'}[data.phase])
    this.bank.textContent=ru?`Осколки эха: ${data.shards} · Победы: ${data.completions}`:`Echo shards: ${data.shards} · Wins: ${data.completions}`
    const first=data.phase==='won'?data.completions===1:data.completions===0
    this.reward.textContent=ru?`${data.phase==='won'?'Получено':'Награда'}: ${first?50:20} осколков + ${first?1500:750} золота`:`${data.phase==='won'?'Received':'Reward'}: ${first?50:20} shards + ${first?1500:750} gold`
    this.action.dataset.active=active?'yes':'no'
    this.action.textContent=active?(ru?'Прервать и вернуться':'Leave hunt'):(nearHome?(ru?'Начать охоту':'Start hunt'):(ru?'Вернись в лагерь для старта':'Return to camp to start'))
    this.action.disabled=!active&&!nearHome
    this.action.title=ru?'Первая победа: 50 осколков и 1500 золота. Повтор: 20 осколков и 750 золота.':'First win: 50 shards and 1500 gold. Repeat: 20 shards and 750 gold.'
  }
}
