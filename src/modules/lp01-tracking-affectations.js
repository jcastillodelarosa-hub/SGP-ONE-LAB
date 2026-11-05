import {affectationsTransport} from '../services/lp01-affectations.js';
import {mountAffectationTabs} from './lp01-affectation-tabs.js';
import {orderDetailsTransport} from '../services/lp01-order-details.js';
import {mountOrderNote} from './lp01-order-note.js';
/** Order-scoped reports need a real open process turn, never an assignment. */
export async function mountTrackingAffectations({host,row,target,cause,scope,client,getToken,isCurrent}){
 const token=getToken();let generation=0,dispose,canReport=false,selectedCause=cause==='REGISTER'?'NC_AL':cause,orderDetails=null,tabs;
 const alive=()=>host.isConnected&&getToken()===token&&isCurrent();
 host.innerHTML='<section data-report-context></section><section data-order-affectations></section><section class=lp-order-note data-order-note-section></section>';
 const controls=host.querySelector('[data-report-context]'),panel=host.querySelector('[data-order-affectations]');
 const syncContext=()=>{controls.hidden=!['NC_AL','NC_V','NOVEDAD'].includes(selectedCause);};
 async function mount(period){
  const version=++generation;dispose?.();panel.replaceChildren();
  const transport=affectationsTransport({client,getToken:()=>alive()?getToken():null,contractVersion:2,context:{key:row.key,line:scope.line,stage:scope.stage,date:period?.date,shift:period?.shift,production:row.produccion}});
  const read=transport.read;transport.read=async()=>{let value;try{value=await read();}catch(error){if(error.message==='NO_AUTORIZADO'&&alive()&&version===generation)controls.hidden=true;throw error;}if(!alive()||version!==generation)throw Error('NO_AUTORIZADO');canReport=value.capabilities.includes('REPORT');syncContext();form.querySelectorAll('input,select,button').forEach(el=>el.disabled=!canReport);form.querySelector('button').disabled=!canReport||busy;if(!canReport)status.textContent='Registro no disponible para esta sesión. Consulta con el responsable de permisos o habilitación.';if(!period)value.capabilities=['READ'];return value;};
  tabs=mountAffectationTabs(panel,{transport,cause:selectedCause,details:()=>orderDetails,onSelect:key=>{selectedCause=key;syncContext();}});dispose=()=>tabs.dispose();
 }
 controls.innerHTML='<details data-register-affectation><summary>Registrar afectación</summary><p>Selecciona un turno real abierto de esta etapa y línea para habilitar el registro. No se crean turnos ni asignaciones.</p><form data-affect-context><label>Fecha del registro<input name="date" type="date" required></label><label>Turno del registro<select name="shift" required><option value="">Selecciona turno</option><option value="1">Turno 1</option><option value="2">Turno 2</option></select></label><button>Consultar turno para registrar</button></form><p role="status" data-context-status>Para guardar, consulta un turno abierto y verifica tus permisos.</p></details>';
 controls.hidden=true;
 if(cause==='REGISTER')controls.querySelector('details').open=true;
 const form=controls.querySelector('form'),status=controls.querySelector('[data-context-status]');let busy=false,contextVersion=0;if(target){form.elements.date.value=target.fecha;form.elements.shift.value=String(target.turno);}
 form.onchange=()=>{if(!alive())return;++contextVersion;status.textContent='Contexto cambiado. Consulta el turno para registrar.';void mount(null);};
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||!alive())return;busy=true;form.querySelector('button').disabled=true;
  const version=++contextVersion,date=form.elements.date.value,shift=Number(form.elements.shift.value);await mount(null);
  try{
   const {data,error}=await client.rpc('sgp_lp_operacion_consultar',{p_token:token,p_etapa:scope.stage,p_linea:scope.line,p_fecha:date,p_turno:shift});
   if(!alive()||version!==contextVersion||date!==form.elements.date.value||shift!==Number(form.elements.shift.value))return;
   if(error)throw Error(error.message||'Consulta no disponible');
   const turn=data?.turn;
   if(data?.contract!=='LP-OPERACION-1'||turn?.estado!=='ABIERTO'||turn.etapa!==scope.stage||turn.linea!==scope.line||turn.fecha!==date||Number(turn.turno)!==shift)throw Error('No hay un turno abierto acreditado para esta fecha, turno y etapa. Selecciona otro turno abierto o solicita su apertura al responsable.');
   status.textContent='Registro en '+date+' · Turno '+shift+' · ABIERTO. El servidor verifica permisos y vigencia al guardar.';
   await mount({date,shift});controls.querySelector('details').open=false;controls.querySelector('summary').textContent='Cambiar contexto · '+date+' · Turno '+shift;if(alive()&&version===contextVersion){const entry=panel.querySelector('form:not([hidden]) [name=cause]');if(entry)entry.focus();}
  }catch(error){if(alive()&&version===contextVersion){status.textContent=error.message==='NO_AUTORIZADO'?'No tienes permiso para registrar en este contexto.':error.message;await mount(null);}}
  finally{busy=false;if(alive())form.querySelector('button').disabled=!canReport;}
 };
 mountOrderNote(host.querySelector('[data-order-note-section]'),orderDetailsTransport({client,getToken:()=>alive()?getToken():null,key:row.key,line:scope.line,stage:scope.stage}),{onRead:d=>{orderDetails=d;tabs?.refreshGlass();}});
 await mount(null);
}
