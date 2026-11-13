import type {RuneId} from '../config/runes'
import './dev-tools.css'

export interface DevControls {
  invincible(enabled:boolean):string
  gold(amount:number):string
  xp(amount:number):string
  rune(id:RuneId,slot:0|1):string
}

/** Applies cheats directly to normal gameplay; development builds only. */
export class DevTools {
  constructor(root:HTMLElement,controls:DevControls){
    const toggle=document.createElement('button')
    toggle.className='dev-toggle';toggle.textContent='DEV · F2'
    toggle.setAttribute('aria-controls','dev-tools');toggle.setAttribute('aria-expanded','false')
    const panel=document.createElement('section')
    panel.id='dev-tools';panel.className='dev-panel';panel.hidden=true
    panel.setAttribute('aria-label','Панель разработчика')
    panel.innerHTML=`
      <div class="dev-heading"><strong>Дев-панель</strong><button type="button" data-close aria-label="Закрыть дев-панель">×</button></div>
      <p>F2 — открыть / скрыть. Золото, опыт и выданные руны сохраняются в текущем прогрессе.</p>
      <fieldset><legend>Герой</legend><label><input type="checkbox" data-invincible> Бессмертие</label></fieldset>
      <form data-gold><label class="dev-select">Золото<input name="amount" aria-label="Количество золота" type="number" min="1" max="1000000" step="1" value="1000" required></label><button class="dev-primary" type="submit">Получить золото</button></form>
      <form data-xp><label class="dev-select">Опыт<input name="amount" aria-label="Количество опыта" type="number" min="1" max="1000000" step="1" value="1000" required></label><button class="dev-primary" type="submit">Получить опыт</button></form>
      <fieldset><legend>Выдать руну</legend>
        <label class="dev-select">Руна<select data-rune aria-label="Руна"><option value="root">Корни</option><option value="fire">Огонь</option><option value="lightning">Молния</option></select></label>
        <label class="dev-select">Слот<select data-slot aria-label="Слот руны"><option value="0">1</option><option value="1">2</option></select></label>
        <button type="button" data-grant-rune>Выдать и надеть</button>
      </fieldset>
      <output class="dev-status" role="status">Изменения применяются к текущему герою.</output>`
    root.append(toggle,panel)
    const status=panel.querySelector<HTMLOutputElement>('output')!
    const show=(open:boolean)=>{panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));toggle.blur()}
    const act=(run:()=>string)=>{status.textContent=run();if(document.activeElement instanceof HTMLElement)document.activeElement.blur()}
    toggle.addEventListener('click',()=>show(Boolean(panel.hidden)))
    panel.querySelector('[data-close]')!.addEventListener('click',()=>show(false))
    panel.querySelector<HTMLInputElement>('[data-invincible]')!.addEventListener('change',event=>act(()=>controls.invincible((event.target as HTMLInputElement).checked)))
    for(const kind of ['gold','xp'] as const){
      const form=panel.querySelector<HTMLFormElement>(`[data-${kind}]`)!
      form.addEventListener('submit',event=>{event.preventDefault();if(form.reportValidity())act(()=>controls[kind](Number(new FormData(form).get('amount'))))})
    }
    panel.querySelector('[data-grant-rune]')!.addEventListener('click',()=>act(()=>controls.rune(panel.querySelector<HTMLSelectElement>('[data-rune]')!.value as RuneId,Number(panel.querySelector<HTMLSelectElement>('[data-slot]')!.value) as 0|1)))
    window.addEventListener('keydown',event=>{if(event.code==='F2'&&!event.repeat){event.preventDefault();show(Boolean(panel.hidden))}})
  }
}
