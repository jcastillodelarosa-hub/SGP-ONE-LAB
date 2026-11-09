const prefix='META_TURNO_';
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function lineGoalKey(line){if(!/^[A-Z][A-Z0-9_]{0,49}$/.test(line))throw Error('Selecciona una línea válida.');return prefix+line;}
export function readLineGoal(config,line){const n=config?.[lineGoalKey(line)]?.quantity;return Number.isSafeInteger(n)&&n>0?n:null;}
export async function saveLineGoal(config,line,input,save){
 const key=lineGoalKey(line),raw=String(input).trim(),n=Number(raw);
 if(!/^\d+$/.test(raw)||!Number.isSafeInteger(n)||n<=0)throw Error('Indica una meta entera mayor que cero.');
 const value={quantity:n};await save(key,value);config[key]=value;return n;
}
export function mountLineGoalsConfig({host,config,save,canEdit}){
 if(!host)return;
 const lines=[...new Set(['PANELES_2','FRAMES_2',...Object.keys(config||{}).filter(k=>k.startsWith(prefix)).map(k=>k.slice(prefix.length)).filter(k=>/^[A-Z][A-Z0-9_]{0,49}$/.test(k))])];
 host.innerHTML='<div class="general-config-head"><div><b>Meta de producción por turno</b><span>Define las unidades esperadas por línea. No cambia las metas guardadas en cierres anteriores.</span></div></div><div class="shift-config-grid"><label>Línea <select data-goal-line>'+lines.map(l=>'<option value="'+esc(l)+'">'+esc(l.replaceAll('_',' '))+'</option>').join('')+'</select></label><label>Unidades por turno <input data-goal-quantity type="number" min="1" step="1" inputmode="numeric" placeholder="Sin meta definida"></label></div><div class="general-config-actions"><button class="primary" type="button" data-goal-save>Guardar meta</button></div><p data-goal-status role="status" aria-live="polite"></p>';
 const line=host.querySelector('[data-goal-line]'),quantity=host.querySelector('[data-goal-quantity]'),button=host.querySelector('[data-goal-save]'),status=host.querySelector('[data-goal-status]');
 let busy=false;
 function paint(){quantity.value=readLineGoal(config,line.value)??'';quantity.disabled=busy||!canEdit();button.disabled=busy||!canEdit();line.disabled=busy;status.textContent=canEdit()?(quantity.value?'Meta guardada: '+quantity.value+' unidades por turno.':'Esta línea no tiene meta definida.'):'Solo un administrador puede modificar la meta.';}
 line.addEventListener('change',paint);
 button.addEventListener('click',async()=>{
  if(busy||!canEdit())return;const selected=line.value,input=quantity.value;
  busy=true;button.disabled=true;quantity.disabled=true;line.disabled=true;status.textContent='Guardando meta…';
  try{await saveLineGoal(config,selected,input,save);paint();status.textContent='Meta guardada para '+selected.replaceAll('_',' ')+'.';}
  catch(e){status.textContent='No se guardó la meta: '+(e?.message||e);}
  finally{busy=false;button.disabled=!canEdit();quantity.disabled=!canEdit();line.disabled=false;}
 });
 paint();
}
