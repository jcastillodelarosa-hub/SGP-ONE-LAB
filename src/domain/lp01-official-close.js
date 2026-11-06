/** Pure close contract. No RPC binding and no writes to weekly Export or manual execution.
 * The persistence adapter must authorize, lock and CAS this entire transition atomically.
 */
export const OFFICIAL_CLOSE_CONTRACT='LP-OFFICIAL-CLOSE-1';
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const required=(v,label)=>{if(typeof v!=='string'||!v.trim())throw Error(label);return v;};
const scope=r=>JSON.stringify([r.key,r.stage,r.line]);
const period=r=>JSON.stringify([r.key,r.stage,r.line,r.date,r.shift]);
const sourceIdentity=r=>JSON.stringify([r.stage,r.line,r.date,r.shift,r.production,r.project,r.system]);
const dateValue=s=>{if(typeof s!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(s)||!Number.isFinite(Date.parse(s)))throw Error('FECHA_CON_ZONA_REQUERIDA');return Date.parse(s);};
export const emptyOfficialClose=()=>({contract:OFFICIAL_CLOSE_CONTRACT,revision:0,entries:[],pending:[],history:[],closures:[],receipts:[]});

function validState(state){
 if(state?.contract!==OFFICIAL_CLOSE_CONTRACT||!integer(state.revision)||!Array.isArray(state.entries)||!Array.isArray(state.pending)||!Array.isArray(state.history)||!Array.isArray(state.closures)||!Array.isArray(state.receipts))throw Error('ESTADO_CIERRE_INVALIDO');
 const seen=new Set();for(const r of state.entries){if(!integer(r.quantity)||seen.has(period(r)))throw Error('ESTADO_CIERRE_INVALIDO');seen.add(period(r));}
}
/** One total per order/process/line/day/shift; absent keys are never written. */
export function applyOfficialImport(state,{id,expectedRevision,actor,recordedAt,reconciliation,schedule,plan}){
 validState(state);required(id,'ID_REQUERIDO');required(actor,'ACTOR_REQUERIDO');dateValue(recordedAt);
 const r=reconciliation;
 if(r?.contract!=='LP-OFFICIAL-RECONCILIATION-1'||!Array.isArray(r.rows)||!Array.isArray(r.pending)||!/^[a-f0-9]{64}$/.test(r.sha256??''))throw Error('CONCILIACION_REQUERIDA');
 if(!plan||!required(plan.revision,'PLAN_VERSION_REQUERIDA')||!Array.isArray(plan.rows))throw Error('PLAN_REQUERIDO');
 const c=r.context;
 if(!c||!['ENSAMBLE','EMPAQUE'].includes(c.stage)||!['PANELES_2','FRAMES_2'].includes(c.line)||![1,2].includes(c.shift)||!/^\d{4}-\d{2}-\d{2}$/.test(c.date))throw Error('CONTEXTO_INVALIDO');
 if(plan.stage!==c.stage||plan.line!==c.line||plan.date!==c.date||plan.shift!==c.shift)throw Error('PLAN_OTRO_PERIODO');
 if(schedule?.date!==c.date||schedule.shift!==c.shift||dateValue(schedule.end)<=dateValue(schedule.start))throw Error('HORARIO_REQUERIDO');
 const signature=JSON.stringify({actor,reconciliation:r,schedule,plan});
 const previous=state.receipts.find(x=>x.id===id);
 if(previous){if(previous.signature!==signature)throw Error('IDEMPOTENCIA_REUTILIZADA');return {state:structuredClone(state),receipt:structuredClone(previous.result),duplicate:true};}
 if(expectedRevision!==state.revision)throw Error('CONFLICTO_REVISION');
 const next=structuredClone(state),seen=new Set(),changes=[];
 const plans=new Map();
 for(const p of plan.rows){
  if(typeof p.key!=='string'||!p.key.endsWith('|'+c.line)||!integer(p.quantity)||plans.has(p.key))throw Error('PLAN_IDENTIDAD_INVALIDA');
  plans.set(p.key,p);
 }
 for(const row of r.rows){
  if(!row.key?.endsWith('|'+c.line)||!integer(row.quantity)||['stage','line','date','shift'].some(k=>row[k]!==c[k])||seen.has(row.key))throw Error('TOTAL_OFICIAL_INVALIDO');
  seen.add(row.key);const key=period(row),index=next.entries.findIndex(e=>period(e)===key),old=index<0?null:next.entries[index];
  const delta=row.quantity-(old?.quantity??0);
  const entry={...structuredClone(row),sha256:r.sha256,periodStart:schedule.start,periodEnd:schedule.end};
  if(index<0)next.entries.push(entry);else if(delta!==0)next.entries[index]=entry;
  const planned=plans.get(row.key)?.quantity??null;
  changes.push({key:row.key,previous:old?.quantity??null,quantity:row.quantity,delta,planned,difference:planned===null?null:row.quantity-planned});
  next.pending=next.pending.filter(p=>sourceIdentity(p)!==sourceIdentity(row));
 }
 for(const p of r.pending){
  if(['stage','line','date','shift'].some(k=>p[k]!==c[k])||!p.reason)throw Error('PENDIENTE_OTRO_PERIODO');
  next.pending=next.pending.filter(old=>sourceIdentity(old)!==sourceIdentity(p));next.pending.push(structuredClone(p));
 }
 next.revision++;
 const result={contract:OFFICIAL_CLOSE_CONTRACT,id,revision:next.revision,context:structuredClone(c),changes,pending:structuredClone(r.pending),sha256:r.sha256};
 next.history.push({...structuredClone(result),actor,recordedAt,plan:structuredClone(plan)});
 next.receipts.push({id,signature,result:structuredClone(result)});
 return {state:next,receipt:result,duplicate:false};
}

/** Freeze the plan read at CLOSE, not the plan from the earlier upload.
 * Partial coverage remains explicit; no missing planned order becomes zero.
 */
export function closeOfficialPeriod(state,{id,expectedRevision,actor,recordedAt,plan,observation}){
 validState(state);required(id,'ID_REQUERIDO');required(actor,'ACTOR_REQUERIDO');required(observation,'MOTIVO_REQUERIDO');dateValue(recordedAt);
 if(!plan||!['ENSAMBLE','EMPAQUE'].includes(plan.stage)||!['PANELES_2','FRAMES_2'].includes(plan.line)||![1,2].includes(plan.shift)||!/^\d{4}-\d{2}-\d{2}$/.test(plan.date)||!Array.isArray(plan.rows))throw Error('PLAN_REQUERIDO');
 required(plan.revision,'PLAN_VERSION_REQUERIDA');
 const signature=JSON.stringify({type:'CLOSE',actor,plan,observation});
 const receipt=state.receipts.find(r=>r.id===id);
 if(receipt){if(receipt.signature!==signature)throw Error('IDEMPOTENCIA_REUTILIZADA');return {state:structuredClone(state),receipt:structuredClone(receipt.result),duplicate:true};}
 if(expectedRevision!==state.revision)throw Error('CONFLICTO_REVISION');
 const same=r=>['stage','line','date','shift'].every(k=>r[k]===plan[k]);
 const imports=state.history.filter(h=>same(h.context));
 if(!imports.length)throw Error('IMPORTACION_OFICIAL_REQUERIDA');
 // An ambiguous source cannot be silently dropped by closing a later partial file.
 if(state.pending.some(same))throw Error('CONCILIACION_PENDIENTE');
 const entries=state.entries.filter(same),byKey=new Map(entries.map(e=>[e.key,e])),seen=new Set(),rows=[];
 for(const p of plan.rows){
  if(!p.key?.endsWith('|'+plan.line)||!integer(p.quantity)||seen.has(p.key))throw Error('PLAN_IDENTIDAD_INVALIDA');
  seen.add(p.key);const actual=byKey.get(p.key);
  rows.push({key:p.key,planned:p.quantity,realized:actual?.quantity??null,difference:actual?actual.quantity-p.quantity:null,sha256:actual?.sha256??null});
 }
 for(const e of entries)if(!seen.has(e.key))rows.push({key:e.key,planned:null,realized:e.quantity,difference:null,sha256:e.sha256});
 const context=Object.fromEntries(['stage','line','date','shift'].map(k=>[k,plan[k]]));
 const result={contract:OFFICIAL_CLOSE_CONTRACT,type:'CLOSE',id,context,version:state.closures.filter(c=>same(c.context)).length+1,actor,recordedAt,observation,plan:structuredClone(plan),rows,coverage:rows.some(r=>r.realized===null)?'PARTIAL':'COMPLETE'};
 const next=structuredClone(state);next.revision++;next.closures.push(result);next.receipts.push({id,signature,result:structuredClone(result)});
 return {state:next,receipt:structuredClone(result),duplicate:false};
}

/** This projection is independent of Export balances and never increments their totals.
 * Baselines require server evidence, especially when a definition falls within a shift.
 */
export function availableFromOfficial(state,definition){
 validState(state);
 if(!definition)return {status:'UNDEFINED',quantity:null};
 if(!integer(definition.quantity)||!required(definition.id,'DEFINICION_REQUERIDA')||!Array.isArray(definition.baselines))throw Error('BASE_DISPONIBLE_INVALIDA');
 const definedAt=dateValue(definition.definedAt),baselines=new Map();
 for(const b of definition.baselines){if(!integer(b.quantity)||baselines.has(period(b))||scope(b)!==scope(definition))throw Error('BASE_DISPONIBLE_INVALIDA');baselines.set(period(b),b.quantity);}
 let consumed=0;const evidence=[],pending=[];
 for(const row of state.entries.filter(r=>scope(r)===scope(definition))){
  const start=dateValue(row.periodStart),end=dateValue(row.periodEnd),baseline=baselines.get(period(row));
  // Earlier closed shifts are already reflected in the latest definition.
  if(end<=definedAt)continue;
  if(start<definedAt&&baseline===undefined){pending.push({date:row.date,shift:row.shift,reason:'BASE_INTRATURNO_NO_ACREDITADA'});continue;}
  const delta=Math.max(0,row.quantity-(baseline??0));consumed+=delta;
  if(!Number.isSafeInteger(consumed))throw Error('CANTIDAD_EXCESIVA');
  evidence.push({date:row.date,shift:row.shift,quantity:row.quantity,baseline:baseline??0,consumed:delta,sha256:row.sha256});
 }
 if(pending.length)return {status:'PENDING_BASE',quantity:null,definitionId:definition.id,pending,evidence};
 const remaining=definition.quantity-consumed;
 return {status:remaining<0?'EXCEEDED':'READY',quantity:remaining,definitionId:definition.id,consumed,evidence};
}

export function officialHistory(state,{line,stage,date,shift}){
 validState(state);
 if(!['ENSAMBLE','EMPAQUE'].includes(stage)||!['PANELES_2','FRAMES_2'].includes(line))throw Error('AMBITO_REQUERIDO');
 return structuredClone(state.history.filter(h=>h.context.line===line&&h.context.stage===stage&&(!date||h.context.date===date)&&(shift===undefined||h.context.shift===shift)));
}
