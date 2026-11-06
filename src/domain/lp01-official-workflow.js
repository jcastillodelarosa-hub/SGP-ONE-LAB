import {availableFromOfficial} from './lp01-official-close.js';
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const same=(a,b)=>['stage','line','date','shift'].every(k=>a[k]===b[k]);
/** The initial planner snapshot is immutable; leader additions form an explicit overlay. */
export function officialPlan(state,plan){
 const additions=(state.inclusions||[]).filter(r=>same(r,plan));
 const rows=structuredClone(plan.rows);
 for(const a of additions){if(!rows.some(r=>r.key===a.key))rows.push({key:a.key,quantity:a.quantity,priority:a.priority,incorporationId:a.id});}
 return {...plan,revision:plan.revision+additions.map(a=>'|'+a.id).join(''),rows};
}
export function officialAvailability(state){
 const latest=new Map();for(const d of state.definitions||[])latest.set(JSON.stringify([d.key,d.stage,d.line]),d);
 return [...latest.values()].map(d=>({...availableFromOfficial(state,d),key:d.key,stage:d.stage,line:d.line,definition:d}));
}
/** Server supplies role, clock, catalog and baseline entries. Browser supplies no evidence. */
export function changeOfficialWorkflow(state,{command,actor,role,recordedAt,catalog,plan,observation}){
 if(state.revision!==command.revision)throw Error('CONFLICTO_REVISION');
 if(!command.key?.endsWith('|'+command.line)||!catalog.some(r=>r.key_produccion===command.key&&r.id_linea===command.line))throw Error('ORDEN_NO_AUTORIZADA');
 if(!integer(command.quantity)||!observation?.trim()||observation.length>4000||!Number.isFinite(Date.parse(recordedAt)))throw Error('DATOS_WORKFLOW_INVALIDOS');
 const context=Object.fromEntries(['stage','line','date','shift'].map(k=>[k,command[k]]));
 const next=structuredClone(state),base={id:command.id,key:command.key,...context,actor,recordedAt,observation,quantity:command.quantity};let record;
 if(command.action==='DEFINE_AVAILABLE'){
  if(!['COORDINADOR','ADMINISTRADOR'].includes(role))throw Error('DEFINICION_REQUIERE_COORDINADOR');
  // A missing current-period baseline stays missing; summaries cannot prove an invented zero.
  const baselines=state.entries.filter(r=>r.key===command.key&&r.stage===command.stage&&r.line===command.line).map(r=>({key:r.key,stage:r.stage,line:r.line,date:r.date,shift:r.shift,quantity:r.quantity,sha256:r.sha256}));
  record={...base,definedAt:recordedAt,baselines};next.definitions=[...(next.definitions||[]),record];
 }else if(command.action==='INCORPORATE'){
  if(!['LIDER','LIDER LINEA','SUPERVISOR ENSAMBLE','SUPERVISOR EMPAQUE','COORDINADOR','ADMINISTRADOR'].includes(role))throw Error('INCORPORACION_NO_AUTORIZADA');
  if(command.quantity===0||!integer(command.priority)||command.priority<1)throw Error('CANTIDAD_PRIORIDAD_REQUERIDAS');
  if(officialPlan(state,plan).rows.some(r=>r.key===command.key))throw Error('ORDEN_YA_PROGRAMADA');
  const source=catalog.find(r=>r.key_produccion===command.key),balance=source[command.stage==='ENSAMBLE'?'saldo_ensamble':'saldo_empaque'];
  if(source.saldos_inicializados!==true||source.presente_ultimo_export!==true||balance===null||balance===undefined||String(balance).trim()===''||!integer(Number(balance))||command.quantity>Number(balance))throw Error('SALDO_OFICIAL_NO_ACREDITADO');
  record={...base,priority:command.priority,initialPlan:structuredClone(plan),source:structuredClone(source)};next.inclusions=[...(next.inclusions||[]),record];
 }else throw Error('ACCION_WORKFLOW_INVALIDA');
 next.revision++;
 const receipt={contract:'LP-OFFICIAL-WORKFLOW-1',id:command.id,context,type:command.action,revision:next.revision,record};
 next.receipts.push({id:command.id,signature:JSON.stringify({command,actor,observation}),result:receipt});
 return {state:next,receipt};
}
