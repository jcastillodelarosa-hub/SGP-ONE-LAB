import {affectationsTransport} from '../services/lp01-affectations.js';
import {mountAffectationsPanel} from './lp01-affectations-panel.js';
/** Order-scoped reports need a real open process turn, never an assignment. */
export async function mountTrackingAffectations({host,row,target,scope,client,getToken,isCurrent}){
 const token=getToken();let generation=0,dispose;
 const alive=()=>host.isConnected&&getToken()===token&&isCurrent();
 host.innerHTML='<section data-report-context></section><section data-order-affectations></section>';
 const controls=host.querySelector('[data-report-context]'),panel=host.querySelector('[data-order-affectations]');
 async function mount(period){
  const version=++generation;dispose?.();panel.replaceChildren();
  const transport=affectationsTransport({client,getToken:()=>alive()?getToken():null,contractVersion:2,context:{key:row.key,line:scope.line,stage:scope.stage,date:period?.date,shift:period?.shift,production:row.produccion}});
  const read=transport.read;transport.read=async()=>{const value=await read();if(!alive()||version!==generation)throw Error('NO_AUTORIZADO');if(!period)value.capabilities=['READ'];return value;};
  const cleanup=await mountAffectationsPanel(panel,transport);if(version===generation)dispose=cleanup;else cleanup();
 }
 if(target){await mount({date:target.fecha,shift:Number(target.turno)});return;}
 controls.innerHTML='<p>Los pendientes se consultan por orden. Para registrar afectaciones o PDT, selecciona la fecha y el turno real de esta etapa; no se requiere una asignación.</p><form data-affect-context><label>Fecha del registro<input name="date" type="date" required></label><label>Turno del registro<select name="shift" required><option value="">Selecciona turno</option><option value="1">Turno 1</option><option value="2">Turno 2</option></select></label><button>Consultar turno para registrar</button></form><p role="status" data-context-status>Solo consulta hasta verificar un turno abierto. Esta acción no abre turnos ni incorpora órdenes.</p>';
 const form=controls.querySelector('form'),status=controls.querySelector('[data-context-status]');let busy=false;
 form.onchange=()=>{if(!alive())return;status.textContent='Contexto cambiado. Consulta el turno para registrar.';void mount(null);};
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||!alive())return;busy=true;form.querySelector('button').disabled=true;
  const date=form.elements.date.value,shift=Number(form.elements.shift.value);await mount(null);
  try{
   const {data,error}=await client.rpc('sgp_lp_operacion_consultar',{p_token:token,p_etapa:scope.stage,p_linea:scope.line,p_fecha:date,p_turno:shift});
   if(!alive()||date!==form.elements.date.value||shift!==Number(form.elements.shift.value))return;
   if(error)throw Error(error.message||'Consulta no disponible');
   const turn=data?.turn;
   if(data?.contract!=='LP-OPERACION-1'||turn?.estado!=='ABIERTO'||turn.etapa!==scope.stage||turn.linea!==scope.line||turn.fecha!==date||Number(turn.turno)!==shift)throw Error('No hay un turno abierto acreditado para esta fecha y etapa.');
   status.textContent='Registro en '+date+' · Turno '+shift+'. El servidor verifica permisos y vigencia al guardar.';
   await mount({date,shift});
  }catch(error){if(alive()){status.textContent=error.message;await mount(null);}}
  finally{busy=false;if(alive())form.querySelector('button').disabled=false;}
 };
 await mount(null);
}
