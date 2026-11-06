import {ncTrackingMatches} from '../services/nc-glass-tracking.js';
import {isActiveGlassNc} from '../services/nc-glass-order-hints.js';

const text=value=>String(value??'').trim();
const normalized=value=>text(value).normalize('NFC').replace(/\s+/g,' ').toLocaleUpperCase('es');
const stages=['ENSAMBLE','EMPAQUE'];
const messages={
 UNAUTHORIZED:'No tienes acceso vigente a NC Vidrio. Vuelve a abrir el detalle con una sesión autorizada.',
 UNAVAILABLE:'No se pudo consultar NC Vidrio. No se puede confirmar cuántas NC hay por revisar.',
 CHANGED:'La NC cambió o ya no está disponible. Actualiza las candidatas y vuelve a confirmar.',
 INVALID_SELECTION:'Selecciona una NC y una etapa, y confirma la coincidencia con la orden.',
 STALE:'La orden o la sesión cambió. Cierra este detalle y vuelve a abrirlo.'
};
const failure=code=>Object.assign(new Error(messages[code]||messages.UNAVAILABLE),{code});
const orderIdentity=row=>JSON.stringify([row?.key,row?.produccion,row?.oficial?.sistema,row?.linea??row?.line]);
const sourceIdentity=source=>JSON.stringify([
 normalized(source.consecutivo),normalized(source.orden),normalized(source.sistema),
 source.activo,normalized(source.estado_nc),normalized(source.linea_responsable),source.semana_maestro??null
]);
const candidateIdentity=candidate=>JSON.stringify([
 normalized(candidate.reference),sourceIdentity(candidate.source),candidate.sources.map(sourceIdentity).sort()
]);

/** Validate a successful, active-NC response. Errors are never converted into zero. */
export function ncGlassReviewCandidates(result,row){
 if(result?.status!=='READY')throw failure(result?.status==='UNAUTHORIZED'?'UNAUTHORIZED':'UNAVAILABLE');
 if(!text(row?.key)||!text(row?.produccion)||!text(row?.oficial?.sistema)||!text(row?.linea??row?.line))throw failure('UNAVAILABLE');
 if(!Array.isArray(result.candidates)||!Number.isInteger(result.count)||result.count<0||result.count!==result.candidates.length)throw failure('UNAVAILABLE');
 const references=new Set();
 return Object.freeze(result.candidates.map(candidate=>{
  const reference=normalized(candidate?.reference),sources=candidate?.sources;
  if(!reference||references.has(reference)||!candidate?.source||!Array.isArray(sources)||!sources.length)throw failure('UNAVAILABLE');
  references.add(reference);
  const valid=source=>source&&normalized(source.consecutivo)===reference&&isActiveGlassNc(source)&&ncTrackingMatches(source,row);
  if(!valid(candidate.source)||sources.some(source=>!valid(source))||!sources.some(source=>sourceIdentity(source)===sourceIdentity(candidate.source)))throw failure('UNAVAILABLE');
  return Object.freeze({
   reference:text(candidate.reference),source:Object.freeze({...candidate.source}),
   sources:Object.freeze(sources.map(source=>Object.freeze({...source}))),sameResponsibleLine:candidate.sameResponsibleLine===true
  });
 }));
}

/** The fresh read must retain the exact selected evidence before preparing a draft. */
export function requireNcGlassReviewSelection({previous,result,row,stage,confirmed}){
 if(!previous||!stages.includes(stage)||confirmed!==true)throw failure('INVALID_SELECTION');
 const fresh=ncGlassReviewCandidates(result,row).find(candidate=>normalized(candidate.reference)===normalized(previous.reference));
 if(!fresh||candidateIdentity(previous)!==candidateIdentity(fresh))throw failure('CHANGED');
 return {reference:fresh.reference,stage,source:fresh.source};
}

/**
 * Read-only, explicit NC review. The caller owns the existing form and all writes.
 * readCandidates must return the active, unsaved references for this exact order.
 * isCurrent must include the caller's exact session, role, order and view lifetime.
 * No quantity, canonical key, stage, stored link or RPC write is inferred here.
 */
export function mountNcGlassReview(host,{row,scope,readCandidates,onPrepare,isCurrent=()=>true}){
 const doc=host.ownerDocument,root=doc.createElement('section');
 const initialOrder=orderIdentity(row),initialScope=JSON.stringify(scope??null);
 let disposed=false,invalid=false,busy=false,prepared=false,generation=0,candidates=[];
 root.className='lp-nc-review';root.setAttribute('aria-label','NC Vidrio por revisar');
 root.innerHTML=`<style>
  .lp-nc-review{min-width:0;border:1px solid #cbd5e1;border-radius:10px;padding:12px;margin:10px 0;overflow-wrap:anywhere}
  .lp-nc-review h4,.lp-nc-review h5,.lp-nc-review p{margin:0 0 8px}
  .lp-nc-review h4{font-size:15px}.lp-nc-review h5{font-size:13px}
  .lp-nc-review dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 12px;margin:0 0 10px}
  .lp-nc-review dl>div{min-width:0}.lp-nc-review dt{font-size:11px;color:#526174}.lp-nc-review dd{margin:2px 0 0;font-size:12px;white-space:pre-wrap}
  .lp-nc-review .lp-nc-review-wide{grid-column:1/-1}
  .lp-nc-review-list{list-style:none;padding:0;margin:8px 0;display:grid;gap:8px;max-height:320px;overflow:auto}
  .lp-nc-review-list>li{border:1px solid #e2e8f0;border-radius:8px;padding:9px;min-width:0}
  .lp-nc-review-list>li[data-selected=true]{border-color:#2563eb;background:#eff6ff}
  .lp-nc-review-candidate-head{display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:4px 10px;font-size:12px;margin-bottom:5px}
  .lp-nc-review-list p,.lp-nc-review-note{font-size:12px;color:#46566c}
  .lp-nc-review details{font-size:12px}.lp-nc-review details>summary{cursor:pointer;color:#334e75}.lp-nc-review details>dl{margin-top:8px}
  .lp-nc-review-source+.lp-nc-review-source{padding-top:8px;border-top:1px solid #e2e8f0}
  .lp-nc-review-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .lp-nc-review-controls label{display:grid;gap:5px;min-width:0;font-size:12px;font-weight:600}
  .lp-nc-review select{box-sizing:border-box;max-width:100%;width:100%;min-width:0;padding:8px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#172033}
  .lp-nc-review .lp-nc-review-confirm{display:flex;align-items:flex-start;gap:8px;grid-column:1/-1;font-weight:400}
  .lp-nc-review input[type=checkbox]{flex:0 0 auto;min-width:16px;min-height:16px;width:16px;margin:2px 0 0}
  .lp-nc-review-actions{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
  .lp-nc-review-actions button{max-width:100%;white-space:normal;padding:8px 10px}
  .lp-nc-review [data-nc-review-status]{font-size:12px;margin:8px 0 0}
  @media(max-width:480px){.lp-nc-review dl,.lp-nc-review-controls{grid-template-columns:minmax(0,1fr)}}
 </style>
 <h4>NC Vidrio por revisar</h4>
 <dl data-nc-review-order></dl>
 <ul class="lp-nc-review-list" data-nc-review-list aria-label="NC candidatas"></ul>
 <div class="lp-nc-review-controls">
  <label>NC por revisar<select data-nc-review-reference disabled><option value="">Selecciona una NC</option></select></label>
  <label>Etapa de la afectación<select data-nc-review-stage disabled><option value="">Selecciona una etapa</option><option value="ENSAMBLE">Ensamble</option><option value="EMPAQUE">Empaque</option></select></label>
  <label class="lp-nc-review-confirm"><input type="checkbox" data-nc-review-confirm disabled><span>Confirmo que esta NC corresponde a esta orden y línea.</span></label>
 </div>
 <div class="lp-nc-review-actions"><button type="button" data-nc-review-prepare disabled>Preparar afectación</button><button type="button" data-nc-review-refresh disabled>Actualizar candidatas</button></div>
 <p class="lp-nc-review-note">NC ≠ ventanas. Preparar no guarda. Registrar una afectación no vincula automáticamente la NC de origen.</p>
 <p role="status" aria-live="polite" data-nc-review-status>Consultando NC Vidrio…</p>`;
 host.append(root);
 const find=selector=>root.querySelector(selector);
 const list=find('[data-nc-review-list]'),reference=find('[data-nc-review-reference]'),stage=find('[data-nc-review-stage]');
 const confirm=find('[data-nc-review-confirm]'),prepare=find('[data-nc-review-prepare]'),refresh=find('[data-nc-review-refresh]'),status=find('[data-nc-review-status]');
 const make=(tag,value,className)=>{const element=doc.createElement(tag);if(className)element.className=className;if(value!==undefined)element.textContent=String(value);return element;};
 function detail(parent,label,value,wide=false){const group=make('div');if(wide)group.className='lp-nc-review-wide';group.append(make('dt',label),make('dd',value==null||value===''?'Sin dato':value));parent.append(group);}
 detail(find('[data-nc-review-order]'),'Producción',row?.produccion,true);
 detail(find('[data-nc-review-order]'),'Línea',row?.linea??row?.line);

 function current(){
  if(disposed||invalid||!root.isConnected)return false;
  let valid=false;try{valid=isCurrent()&&initialOrder===orderIdentity(row)&&initialScope===JSON.stringify(scope??null);}catch{}
  if(valid)return true;
  invalid=true;++generation;candidates=[];list.replaceChildren();reference.replaceChildren(makeOption('','Selecciona una NC'));reference.value='';stage.value='';confirm.checked=false;
  reference.disabled=stage.disabled=confirm.disabled=prepare.disabled=refresh.disabled=true;root.setAttribute('aria-busy','false');status.textContent=messages.STALE;return false;
 }
 function makeOption(value,label){const option=make('option',label);option.value=value;return option;}
 function reset(){reference.value='';stage.value='';confirm.checked=false;prepared=false;}
 function sync(){
  if(!current())return;
  const selected=candidates[Number(reference.value)];
  reference.disabled=stage.disabled=confirm.disabled=busy||!candidates.length;
  refresh.disabled=busy;prepare.disabled=busy||prepared||reference.value===''||!selected||!stages.includes(stage.value)||!confirm.checked;
  root.setAttribute('aria-busy',String(busy));
  Array.from(list.children).forEach((card,index)=>card.dataset.selected=String(reference.value!==''&&Number(reference.value)===index));
 }
 function renderCandidates(){
  list.replaceChildren();reference.replaceChildren(makeOption('','Selecciona una NC'));
  candidates.forEach((candidate,index)=>{
   const card=make('li'),heading=make('div',undefined,'lp-nc-review-candidate-head');
   heading.append(make('strong','NC '+candidate.reference),make('span',text(candidate.source.estado_nc)+' · '+(text(candidate.source.linea_responsable)||'Sin línea responsable')));card.append(heading);
   card.append(make('p','Posible relación · Sin afectación registrada para esta NC'));
   const disclosure=make('details');disclosure.append(make('summary','Ver detalle de la NC'));
   const target=make('dl');detail(target,'Key exacta de la orden',row?.key,true);detail(target,'Sistema de esta orden',row?.oficial?.sistema);disclosure.append(target);
   for(const source of candidate.sources){
    const facts=make('dl',undefined,'lp-nc-review-source');
    detail(facts,'Producción completa de origen',source.orden,true);detail(facts,'Sistema de origen',source.sistema);
    detail(facts,'Consecutivo',source.consecutivo);detail(facts,'Estado NC',source.estado_nc);detail(facts,'Línea responsable',source.linea_responsable);
    disclosure.append(facts);
   }
   if(!candidate.sameResponsibleLine)card.append(make('p','Línea responsable distinta o sin dato. Revisa la coincidencia.'));
   card.append(disclosure);
   list.append(card);reference.append(makeOption(String(index),'NC '+candidate.reference+' · '+text(candidate.source.estado_nc)+' · '+(text(candidate.source.linea_responsable)||'Sin línea responsable')));
  });
  reset();
 }
 async function load(force=false){
  if(!current()||busy)return;
  const request=++generation;busy=true;candidates=[];renderCandidates();status.textContent='Consultando NC Vidrio…';sync();
  try{
   const result=await readCandidates({force});if(!current()||request!==generation)return;
   candidates=ncGlassReviewCandidates(result,row);renderCandidates();
   status.textContent=candidates.length?candidates.length+' NC por revisar. Selecciona una NC y una etapa, y confirma la coincidencia.':'Sin candidatas para esta orden en la consulta actual.';
  }catch(error){if(current()&&request===generation){candidates=[];renderCandidates();status.textContent=messages[error?.code]||messages.UNAVAILABLE;}}
  finally{if(current()&&request===generation){busy=false;sync();}}
 }
 function changed(){if(!current()||busy)return;confirm.checked=false;prepared=false;status.textContent='Revisa la NC y la etapa elegidas, y confirma la coincidencia.';sync();}
 reference.onchange=stage.onchange=changed;
 confirm.onchange=()=>{if(current()&&!busy){prepared=false;sync();}};
 refresh.onclick=()=>void load(true);
 prepare.onclick=async()=>{
  if(!current()||busy||prepared)return;
  const selectedValue=reference.value,selectedStage=stage.value,selected=candidates[Number(selectedValue)];
  if(selectedValue===''||!selected||!stages.includes(selectedStage)||!confirm.checked){status.textContent=messages.INVALID_SELECTION;sync();return;}
  const request=++generation;busy=true;status.textContent='Comprobando de nuevo la NC y el acceso…';sync();
  let preparing=false;
  try{
   const result=await readCandidates({force:true});if(!current()||request!==generation)return;
   if(reference.value!==selectedValue||stage.value!==selectedStage||!confirm.checked)throw failure('INVALID_SELECTION');
   const choice=requireNcGlassReviewSelection({previous:selected,result,row,stage:selectedStage,confirmed:confirm.checked});
   if(!current()||request!==generation)return;
   preparing=true;await onPrepare(choice);if(!current()||request!==generation)return;
   prepared=true;status.textContent='Formulario preparado. Indica las ventanas afectadas antes de guardar.';
  }catch(error){
   if(current()&&request===generation){
    if(!preparing){candidates=[];renderCandidates();}
    else{confirm.checked=false;prepared=false;}
    status.textContent=preparing?(error instanceof Error&&text(error.message)?error.message:'No se pudo preparar el formulario. Revisa el acceso y vuelve a confirmar.'):messages[error?.code]||messages.UNAVAILABLE;
   }
  }finally{if(current()&&request===generation){busy=false;sync();}}
 };
 void load();
 return ()=>{if(disposed)return;disposed=true;++generation;candidates=[];reference.onchange=stage.onchange=confirm.onchange=prepare.onclick=refresh.onclick=null;root.remove();};
}
