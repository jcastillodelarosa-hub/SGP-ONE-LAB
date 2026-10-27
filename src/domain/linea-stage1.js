/** Isolated reference model. No imports, RPC, Export writes or UI integration.
 * Commands are a serial aggregate model, NOT a concurrency/auth server substitute.
 */
const stages=['ENSAMBLE','EMPAQUE'];
const roles=['LIDER','LIDER LINEA','COORDINADOR','ADMINISTRADOR'];
const requireThat=(ok,message)=>{if(!ok)throw new Error(message);};
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const nonblank=s=>typeof s==='string'&&s.trim().length>0;
export function slotKey({stage,date,shift,production}){
 requireThat(stages.includes(stage),'ETAPA_INVALIDA');
 requireThat(/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date+'T00:00:00Z'))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date,'FECHA_INVALIDA');
 requireThat([1,2].includes(shift)&&nonblank(production),'IDENTIDAD_INVALIDA');
 return JSON.stringify([stage,date,shift,production]);
}
export function nextShift(slot){
 slotKey(slot);if(slot.shift===1)return {...slot,shift:2};
 const day=new Date(slot.date+'T12:00:00Z');day.setUTCDate(day.getUTCDate()+1);
 return {...slot,date:day.toISOString().slice(0,10),shift:1};
}
export function newOperationalState(){return {slots:{},turns:{},events:[],requests:{},carries:{},blocks:{},blockRevision:0,reconciliations:{}};}
const turnKey=s=>JSON.stringify([s.stage,s.date,s.shift]);
const initialSlot=slot=>({...slot,sale:null,saleValidated:false,execution:0,revision:0});
const isClosed=(state,slot)=>state.turns[turnKey(slot)]?.closed===true;
function audited(state,event){state.events.push({...event,sequence:state.events.length+1});}
/** Full-state lock + expectedRevision required in persistent implementation.
 * Errors are atomic: input state is never mutated. Actor is authenticated upstream.
 */
export function command(input,cmd,actor){
 requireThat(actor&&nonblank(actor.user)&&roles.includes(actor.role),'PERMISO_DENEGADO');
 requireThat(cmd&&nonblank(cmd.id),'IDEMPOTENCIA_REQUERIDA');
 const signature=JSON.stringify(canonical({actor,cmd}));
 const prior=input.requests[cmd.id];
 if(prior){requireThat(prior.signature===signature,'IDEMPOTENCIA_REUTILIZADA');return {state:structuredClone(input),result:{...prior.result,duplicate:true}};}
 const state=structuredClone(input);let result={ok:true};
 const coordinator=['COORDINADOR','ADMINISTRADOR'].includes(actor.role);
 if(!coordinator)requireThat(Array.isArray(actor.allowedStages)&&actor.allowedStages.includes(cmd.slot?.stage),'ETAPA_NO_AUTORIZADA');
 if(cmd.type==='BLOCK'){
  requireThat(coordinator,'PERMISO_DENEGADO');
  requireThat(stages.includes(cmd.stage)&&nonblank(cmd.production)&&nonblank(cmd.pdt)&&typeof cmd.active==='boolean'&&integer(cmd.quantity),'BLOQUEO_INVALIDO');
  state.blockRevision++;
  state.blocks[JSON.stringify([cmd.stage,cmd.production,cmd.pdt])]={stage:cmd.stage,production:cmd.production,pdt:cmd.pdt,active:cmd.active,quantity:cmd.quantity};
 }else if(cmd.type==='CLOSE'){
  const {slot}=cmd;slotKey(slot);const key=turnKey(slot);
  requireThat(!isClosed(state,slot),'TURNO_CERRADO');requireThat(nonblank(cmd.observation),'OBSERVACION_GENERAL_REQUERIDA');
  const rows=Object.entries(state.slots).filter(([,s])=>turnKey(s)===key);
  requireThat(rows.length>0,'TURNO_SIN_ORDENES');
  for(const [id,s] of rows){requireThat(s.saleValidated,'SALE_PENDIENTE_VALIDACION');if(s.execution<s.sale)requireThat(nonblank(cmd.reasons?.[id]),'JUSTIFICACION_ORDEN_REQUERIDA');}
  state.turns[key]={closed:true,status:'CERRADO',needsReview:false,snapshot:{rows:structuredClone(rows),observation:cmd.observation,reasons:structuredClone(cmd.reasons||{}),actor:{...actor},event:cmd.id}};
 }else if(cmd.type==='REOPEN'){
  requireThat(coordinator&&nonblank(cmd.observation),'REAPERTURA_NO_AUTORIZADA');slotKey(cmd.slot);const key=turnKey(cmd.slot);
  requireThat(isClosed(state,cmd.slot),'TURNO_NO_CERRADO');
  state.turns[key]={...state.turns[key],closed:false,status:'EN_REVISION',needsReview:true,reviewAuthorization:{event:cmd.id,actor:{...actor},observation:cmd.observation}}; // Previous snapshot stays immutable.
 }else{
  const {slot}=cmd;const key=slotKey(slot);const s=state.slots[key]||initialSlot(slot);const closed=isClosed(state,slot);
  requireThat(integer(cmd.expectedRevision)&&cmd.expectedRevision===s.revision,'CONFLICTO_REVISION');
  if(cmd.type==='SALE'){
   requireThat(coordinator,'SALE_REQUIERE_COORDINADOR');requireThat(!closed,'TURNO_CERRADO');requireThat(integer(cmd.quantity),'CANTIDAD_INVALIDA');
   requireThat(nonblank(cmd.observation),'MOTIVO_REQUERIDO');s.sale=cmd.quantity;s.saleValidated=true;
  }else if(cmd.type==='EXECUTION'){
   requireThat(integer(cmd.quantity),'CANTIDAD_INVALIDA');
   requireThat(!closed,'CORRECCION_POSTCIERRE_REQUIERE_REAPERTURA');
   if(state.turns[turnKey(slot)]?.needsReview)requireThat(coordinator&&nonblank(cmd.observation),'CORRECCION_POSTCIERRE_NO_AUTORIZADA');
   if(cmd.quantity<s.execution)requireThat(nonblank(cmd.observation),'MOTIVO_CORRECCION_REQUERIDO');
   // Sale is a commitment, not an implicit cap on physically reported execution.
   if(slot.stage==='EMPAQUE'&&cmd.quantity>s.execution){
    const supply=cmd.supply;requireThat(supply?.verified===true&&nonblank(supply.evidenceId)&&integer(supply.available),'EVIDENCIA_ENSAMBLE_REQUERIDA');
    const consumed=Object.values(state.slots).filter(x=>x.stage==='EMPAQUE'&&x.production===slot.production&&slotKey(x)!==key).reduce((n,x)=>n+x.execution,0);
    const blockers=Object.values(state.blocks).filter(b=>b.stage==='ENSAMBLE'&&b.production===slot.production&&b.active);
    // PDT quantities are pieces, not windows. Never subtract them from units.
    // Upstream resolver must return net eligible assembled units, with proof of
    // blocker reconciliation at the exact read revision (unknown impact blocks).
    if(blockers.length)requireThat(supply.blockersReconciled===true&&supply.blockRevision===state.blockRevision,'IMPACTO_PDT_SIN_CONCILIAR');
    requireThat(consumed+cmd.quantity<=supply.available,'EMPAQUE_SUPERA_DISPONIBLE');
   }
   if(slot.stage==='ENSAMBLE'&&cmd.quantity<s.execution){
    const consumed=Object.values(state.slots).filter(x=>x.stage==='EMPAQUE'&&x.production===slot.production).reduce((n,x)=>n+x.execution,0);
    if(consumed>0){const proof=cmd.correctionProof;requireThat(proof?.verified===true&&nonblank(proof.evidenceId)&&integer(proof.eligibleAfter)&&proof.eligibleAfter>=consumed,'CORRECCION_ENSAMBLE_SIN_SOPORTE_EMPAQUE');}
   }
   s.execution=cmd.quantity;
  }else if(cmd.type==='CARRY'){
   requireThat(s.saleValidated,'SALE_PENDIENTE_VALIDACION');const target=nextShift(slot);const dest=slotKey(target);
   requireThat(!isClosed(state,target),'DESTINO_CERRADO');
   const remaining=Math.max(0,s.sale-s.execution);
   // One mutable proposal per source edge, not an additive copy on every retry.
   state.carries[key]={source:key,target:dest,quantity:remaining,sourceRevision:s.revision,validated:false};
   result={ok:true,target,remaining};
  }else throw new Error('OPERACION_DESCONOCIDA');
  s.revision++;state.slots[key]=s;
  if(['SALE','EXECUTION'].includes(cmd.type)&&state.carries[key])state.carries[key]={...state.carries[key],quantity:Math.max(0,s.sale-s.execution),sourceRevision:s.revision,validated:false};
 }
 audited(state,{id:cmd.id,type:cmd.type,actor:{...actor},command:structuredClone(cmd),before:structuredClone(input.slots),after:structuredClone(state.slots),closedSnapshots:structuredClone(state.turns)});
 state.requests[cmd.id]={signature,result};return {state,result};
}
/** Explicit evidence inclusion, never inferred from equal totals or import time. */
export function reconcileExport({officialBalance,officialAccumulated,cutId,movements,includedIds,completeMapping}){
 requireThat(integer(officialBalance)&&integer(officialAccumulated)&&nonblank(cutId),'CORTE_INVALIDO');
 requireThat(Array.isArray(movements)&&Array.isArray(includedIds),'CONCILIACION_INVALIDA');
 requireThat(new Set(movements.map(x=>x.id)).size===movements.length&&new Set(includedIds).size===includedIds.length,'MOVIMIENTO_DUPLICADO');
 requireThat(movements.every(x=>nonblank(x.id)&&Number.isSafeInteger(x.delta)),'MOVIMIENTO_INVALIDO');
 requireThat(includedIds.every(id=>movements.some(x=>x.id===id)),'INCLUSION_DESCONOCIDA');
 if(!completeMapping)return {officialBalance,officialAccumulated,cutId,projectedBalance:null,status:'SIN_CONCILIAR'};
 const pendingDelta=movements.filter(x=>!includedIds.includes(x.id)).reduce((n,x)=>n+x.delta,0);
 const projectedBalance=officialBalance-pendingDelta;
 return {officialBalance,officialAccumulated,cutId,projectedBalance,status:projectedBalance<0?'DISCREPANCIA_SALDO':'CONCILIADO',pendingDelta};
}
/** Individual report from immutable close event, never current Export or totals. */
export function closureReport(state,slot,eventId=null){
 slotKey(slot);const key=turnKey(slot);
 const closures=state.events.filter(e=>e.type==='CLOSE'&&turnKey(e.command.slot)===key&&(!eventId||e.id===eventId));
 requireThat(closures.length>0,'CIERRE_NO_ENCONTRADO');
 const event=closures.at(-1),snapshot=event.closedSnapshots[key].snapshot;
 return {stage:slot.stage,date:slot.date,shift:slot.shift,closeEvent:event.id,actor:{...snapshot.actor},observation:snapshot.observation,
 rows:snapshot.rows.map(([id,s])=>({production:s.production,sale:s.sale,executed:s.execution,remaining:Math.max(0,s.sale-s.execution),variance:s.execution-s.sale,reason:snapshot.reasons[id]||''}))};
}
