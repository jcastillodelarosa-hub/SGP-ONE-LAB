import {canPrepareHistoricalTurn} from '../services/lp01-historical-turn.js';
export function mountHistoricalTurn({host,data,context,state,onPrepare,onRetry,isCurrent}){
 if(!canPrepareHistoricalTurn(data,context)||!onPrepare||!onRetry)return null;
 const box=document.createElement('section');box.className='lp-close';box.dataset.historicalTurn='';
 box.innerHTML='<h4>Preparar turno histórico</h4><p data-historical-context></p><p>Se creará únicamente el registro del turno. No se importará el archivo ni se confirmará el cierre. No se reconstruye un plan histórico ni se arrastran cantidades; la comparación con planificación histórica no está disponible.</p><label>Motivo<textarea maxlength="2000" data-historical-motive></textarea></label><button type="button" data-historical-prepare>Preparar este turno histórico</button><button type="button" data-historical-retry>Reintentar la misma preparación</button><p role="status" data-historical-status></p>';
 box.querySelector('[data-historical-context]').textContent=context.stage+' · '+context.line+' · '+context.date+' / T'+context.shift;
 const input=box.querySelector('textarea'),submit=box.querySelector('[data-historical-prepare]'),retry=box.querySelector('[data-historical-retry]'),status=box.querySelector('[data-historical-status]');input.value=state.historicalMotive||'';
 input.oninput=()=>{state.historicalMotive=input.value;};const paint=()=>{input.disabled=submit.disabled=Boolean(state.busy||state.uncertain);retry.hidden=!state.uncertain;retry.disabled=Boolean(state.busy);};
 const run=async action=>{if(state.busy||!isCurrent())return;state.busy=true;paint();try{await action();state.uncertain=false;if(box.isConnected&&isCurrent())status.textContent='Turno preparado. Selecciona el archivo para importarlo cuando decidas continuar.';}catch(error){state.uncertain=error.uncertain===true;if(box.isConnected&&isCurrent())status.textContent=error.message;}finally{state.busy=false;if(box.isConnected&&isCurrent())paint();}};
 submit.onclick=()=>run(()=>onPrepare(input.value));retry.onclick=()=>run(onRetry);host.append(box);paint();return box;
}
