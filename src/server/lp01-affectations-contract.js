/** Executable backend contract for isolated validation; no endpoint or production storage.
 * authority is server-derived on EVERY call. Never accept it from request payload.
 * A production adapter must lock production/stage, reauthorize and commit result+receipt atomically.
 */
const stages=['ENSAMBLE','EMPAQUE'],causes=['NC_AL','NC_V','TECNO','NOVEDAD'];
const clone=x=>structuredClone(x);
const fail=code=>{throw Error(code);};
const quantity=n=>{if(!Number.isSafeInteger(n)||n<0)fail('CANTIDAD_INVALIDA');return n;};
const canonical=x=>JSON.stringify(x,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value);
export function emptyAffectations(key,line,stage){
 if(!key||!line||!stages.includes(stage))fail('AMBITO_INVALIDO');
 return {contract:'LP-AFFECTATIONS-DRAFT/1',key,line,stage,revision:0,reports:[],events:[],receipts:[],consolidated:null};
}
function authorize(state,a,cap){
 if(!a?.active||!a.user||a.key!==state.key||a.line!==state.line||!a.stages?.includes(state.stage)||!a.capabilities?.includes(cap))fail('NO_AUTORIZADO');
 if((a.role==='SUPERVISOR ENSAMBLE'&&state.stage!=='ENSAMBLE')||(a.role==='SUPERVISOR EMPAQUE'&&state.stage!=='EMPAQUE'))fail('NO_AUTORIZADO');
 if(cap==='VALIDATE'&&a.role!=='COORDINADOR')fail('SOLO_COORDINADOR');
 if(cap!=='READ'&&!['LIDER','LIDER LINEA','SUPERVISOR ENSAMBLE','SUPERVISOR EMPAQUE','COORDINADOR','ADMINISTRADOR'].includes(a.role))fail('NO_AUTORIZADO');
}
export function readAffectations(state,authority){
 authorize(state,authority,'READ');
 const out=clone(state);delete out.receipts;
 // A changed official balance also invalidates the consolidated snapshot.
 if(out.consolidated?.balance!==authority.balance)out.consolidated=null;
 out.available=out.consolidated===null?null:authority.balance-out.consolidated.quantity;
 out.capabilities=authority.capabilities.filter(c=>c!=='VALIDATE'||authority.role==='COORDINADOR');
 return out;
}
export function affectationCommand(state,command,authority){
 const cap={CREATE:'REPORT',CORRECT:'REPORT',SOLVE:'SOLVE',CONFIRM:'CONFIRM',VALIDATE:'VALIDATE'}[command?.action];
 if(!cap)fail('ACCION_INVALIDA');authorize(state,authority,cap);
 if(Object.keys(command).some(k=>!['id','action','revision','reportId','quantity','cause','observation'].includes(k)))fail('CAMPO_NO_ADMITIDO');
 if(typeof command.id!=='string'||!command.id.trim()||command.id.length>100)fail('ID_REQUERIDO');
 const payload=canonical(command),old=state.receipts.find(r=>r.id===command.id);
 if(old){if(old.user!==authority.user||old.payload!==payload)fail('IDEMPOTENCIA_REUTILIZADA');return clone(state);}
 if(command.revision!==state.revision)fail('REVISION_DESACTUALIZADA');
 const observation=String(command.observation??'').trim();if(!observation||observation.length>2000)fail('OBSERVACION_REQUERIDA');
 quantity(command.quantity);quantity(authority.balance);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(authority.date)||new Date(authority.date+'T00:00:00Z').toISOString().slice(0,10)!==authority.date||![1,2].includes(authority.shift)||!Number.isFinite(Date.parse(authority.now)))fail('CONTEXTO_NO_ACREDITADO');
 const next=clone(state),report=next.reports.find(r=>r.id===command.reportId);
 if(command.action==='CREATE'){
  if(command.cause==='NC_AL')fail('NC_AL_REQUIERE_PDT');
  if(!causes.includes(command.cause)||command.quantity===0||command.quantity>authority.balance)fail('REPORTE_INVALIDO');
  next.reports.push({id:command.id,cause:command.cause,quantity:command.quantity,solved:0,confirmed:0,originStage:state.stage,originDate:authority.date,originShift:authority.shift,createdAt:authority.now,createdBy:authority.user});
 }else if(command.action==='VALIDATE'){
  // Reports can overlap even within one cause. Bounds are consistency checks, never an automatic union.
  const pending=next.reports.map(r=>r.quantity-r.confirmed),min=Math.max(0,...pending),max=Math.min(authority.balance,pending.reduce((a,b)=>a+b,0));
  if(command.quantity<min||command.quantity>max)fail('CONSOLIDADO_INCONSISTENTE');
  next.consolidated={quantity:command.quantity,balance:authority.balance,revision:state.revision+1,user:authority.user,at:authority.now};
 }else{
  if(!report)fail('REPORTE_NO_ENCONTRADO');
  if(command.action==='CORRECT'){
   if(command.quantity<report.solved||command.quantity<report.confirmed||command.quantity>authority.balance)fail('CORRECCION_INCONSISTENTE');
   report.quantity=command.quantity;
  }
  if(command.action==='SOLVE'){
   if(!command.quantity||report.solved+command.quantity>report.quantity)fail('SOLUCION_SUPERA_REPORTE');
   report.solved+=command.quantity;
  }
  if(command.action==='CONFIRM'){
   if(!command.quantity||report.confirmed+command.quantity>report.solved)fail('CONFIRMACION_SIN_SOLUCION');
   report.confirmed+=command.quantity;
  }
 }
 if(command.action!=='VALIDATE')next.consolidated=null;
 next.revision++;
 next.events.push({id:command.id,reportId:command.action==='CREATE'?command.id:command.reportId??null,action:command.action,quantity:command.quantity,observation,user:authority.user,stage:state.stage,date:authority.date,shift:authority.shift,at:authority.now,revision:next.revision});
 next.receipts.push({id:command.id,user:authority.user,payload});
 return next;
}
