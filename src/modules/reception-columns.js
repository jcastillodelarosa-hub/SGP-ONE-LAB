import {receptionColumns,receptionOptions,newReceptionTableState} from '../domain/reception-table.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Same dialog/selection/focus pattern as Seguimiento; no LP data dependencies.
export function createReceptionColumns({root,onChange}){
 const states={pending:newReceptionTableState(),received:newReceptionTableState()};
 const tables={pending:root.querySelector('#recTable'),received:root.querySelector('#recReceivedBody').closest('table')};
 let data={pending:[],received:[]},aluminum=new Map(),dialog=null,origin=null;
 function close(restore=true){
  if(dialog){dialog.close();dialog.remove();dialog=null;}
  origin?.setAttribute('aria-expanded','false');
  if(restore)origin?.focus({preventScroll:true});
  origin=null;
 }
 function open(table,key,button){
  close(false);origin=button;button.setAttribute('aria-expanded','true');
  const state=states[table],[,label,numeric]=receptionColumns[table].find(([k])=>k===key),options=receptionOptions(data[table],key,aluminum);
  let draft=state.filters[key]?[...state.filters[key]]:null;
  dialog=document.createElement('dialog');dialog.className='lp-column-menu rec-column-menu';dialog.setAttribute('aria-labelledby','rec-column-title');
  dialog.innerHTML='<header><b id="rec-column-title">'+esc(label)+'</b><button type="button" data-column-close aria-label="Cerrar menú de columna">×</button></header><details data-menu-section="sort"><summary>Ordenar columna</summary><button type="button" data-column-order="asc">Ascendente · '+(numeric?'menor → mayor':'A → Z')+'</button><button type="button" data-column-order="desc">Descendente · '+(numeric?'mayor → menor':'Z → A')+'</button></details><details data-menu-section="filter" open><summary>Filtrar columna</summary><label>Buscar valores<input type="search" data-column-search></label><div class="lp-column-selection"><button type="button" data-column-reset>Seleccionar todos</button><button type="button" data-column-none>Desmarcar todos</button></div><fieldset><legend>Valores</legend>'+options.map(([valueKey,value])=>'<label data-value-label><input type="checkbox" data-column-value="'+esc(valueKey)+'" '+(draft===null||draft.includes(valueKey)?'checked':'')+'>'+esc(value===null?'Sin dato':value)+'</label>').join('')+'</fieldset><p data-no-values hidden>No hay valores coincidentes.</p></details><footer><button type="button" data-column-cancel>Cancelar</button><button type="button" data-column-apply>Aplicar</button></footer>';
  root.append(dialog);dialog.showModal();
  const position=()=>{
   if(!dialog)return;
   dialog.style.cssText='';
   if(matchMedia('(min-width:701px)').matches){
    const rect=button.getBoundingClientRect(),top=Math.max(12,Math.min(rect.bottom+4,innerHeight-640));
    Object.assign(dialog.style,{margin:'0',left:Math.max(12,Math.min(rect.left,innerWidth-dialog.offsetWidth-12))+'px',top:top+'px',maxHeight:(innerHeight-top-12)+'px'});
   }
  };
  position();const resize=new AbortController();window.addEventListener('resize',position,{signal:resize.signal});dialog.addEventListener('close',()=>resize.abort(),{once:true});
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.onkeydown=event=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return;}
   if(event.key!=='Tab')return;
   const controls=[...dialog.querySelectorAll('button,summary,input')].filter(el=>el.checkVisibility()),first=controls[0],last=controls.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  };
  dialog.querySelector('[data-column-close]').onclick=()=>close();
  dialog.querySelector('[data-column-cancel]').onclick=()=>close();
  dialog.querySelectorAll('[data-menu-section]').forEach(section=>section.querySelector('summary').onclick=event=>{
   event.preventDefault();section.open=!section.open;dialog.querySelectorAll('[data-menu-section]').forEach(other=>{if(other!==section)other.open=false;});
  });
  dialog.querySelectorAll('[data-column-order]').forEach(b=>b.onclick=()=>{state.sort=key;state.direction=b.dataset.columnOrder;close();onChange();});
  const inputs=()=>[...dialog.querySelectorAll('[data-column-value]')];
  inputs().forEach(input=>input.onchange=()=>{draft=inputs().filter(x=>x.checked).map(x=>x.dataset.columnValue);});
  dialog.querySelector('[data-column-search]').oninput=event=>{
   const query=event.target.value.toLocaleLowerCase('es');let visible=0;
   dialog.querySelectorAll('[data-value-label]').forEach(label=>{label.hidden=!label.textContent.toLocaleLowerCase('es').includes(query);if(!label.hidden)visible++;});
   dialog.querySelector('[data-no-values]').hidden=visible>0;
  };
  dialog.querySelector('[data-column-reset]').onclick=()=>{inputs().forEach(x=>x.checked=true);draft=null;};
  dialog.querySelector('[data-column-none]').onclick=()=>{inputs().forEach(x=>x.checked=false);draft=[];};
  dialog.querySelector('[data-column-apply]').onclick=()=>{
   if(draft===null)delete state.filters[key];else state.filters[key]=[...draft];
   close();onChange();
  };
  dialog.querySelector('[data-column-close]').focus({preventScroll:true});
 }
 function update(rows,index){
  data=rows;aluminum=index;
  for(const [table,node] of Object.entries(tables)){
   receptionColumns[table].forEach(([key,label],i)=>{
    const th=node.tHead.rows[0].cells[i],state=states[table];
    th.scope='col';th.setAttribute('aria-sort',state.sort===key?(state.direction==='desc'?'descending':'ascending'):'none');
    let button=th.querySelector('button');
    if(!button){button=document.createElement('button');button.type='button';button.dataset.recColumn=key;button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');th.replaceChildren(button);button.onclick=()=>open(table,key,button);}
    const filtered=Object.hasOwn(state.filters,key),sorted=state.sort===key;
    button.textContent=label+(sorted?(state.direction==='desc'?' ↓':' ↑'):' ▾')+(filtered?' •':'');
    button.classList.toggle('is-filtered',filtered);button.setAttribute('aria-label',label+(filtered?', filtro activo':'')+(sorted?', orden '+(state.direction==='desc'?'descendente':'ascendente'):'')+'; ordenar o filtrar');
   });
  }
 }
 function reset(){close(false);states.pending=newReceptionTableState();states.received=newReceptionTableState();}
 root.querySelector('#recClearColumns').onclick=()=>{reset();onChange();};
 return {states,update,reset,close,active:()=>Object.values(states).some(s=>Object.keys(s.filters).length>0)};
}
