/** Isolated SERVER reference. No browser imports, Supabase adapter or HTTP route.
 * Repository supplies authenticated sessions and a consistent production snapshot.
 * Transactions/CAS/idempotency must be implemented by PostgreSQL in Etapa2B.
 */
const validQty=n=>Number.isSafeInteger(n)&&n>=0;
const text=x=>typeof x==='string'&&x.trim().length>0;
class ResolverError extends Error{constructor(code){super(code);this.code=code;}}
const fail=code=>{throw new ResolverError(code);};
const assert=(ok,code)=>{if(!ok)fail(code);};
const stable=x=>JSON.stringify(normalize(x));
function normalize(x){return Array.isArray(x)?x.map(normalize):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,normalize(x[k])])):x;}
const unknown=(s,reason,status='UNKNOWN')=>({contractVersion:1,status,available:null,revision:s?.revision??null,cutId:s?.cut?.id??null,reasons:[reason]});
/** Internal only: must never be used with browser-supplied snapshots. */
export function evaluateServerSnapshot(s){
 if(!s||!text(s.production)||!validQty(s.revision)||!['production','cut','events','pdts','turns'].every(k=>s.complete?.[k]===true))return unknown(s,'INCOMPLETE_SERVER_SOURCES');
 const {cut,events,pdts}=s;
 if(s.unit!=='UNIDAD_PRODUCCION'||cut?.unit!==s.unit)return unknown(s,'QUANTITATIVE_UNIT_UNKNOWN');
 if(!cut||!text(cut.id)||!validQty(cut.assembled)||!validQty(cut.packed)||cut.inclusionComplete!==true||!Array.isArray(cut.includedEventIds))return unknown(s,'EXPORT_RECONCILIATION_INCOMPLETE');
 if(!Array.isArray(events)||!Array.isArray(pdts)||!Array.isArray(s.relations)||!Array.isArray(s.turns))return unknown(s,'INVALID_SOURCE_CONTRACT');
 if(s.turns.some(t=>!t||!['ENSAMBLE','EMPAQUE'].includes(t.stage)||!['ABIERTO','CERRADO','EN_REVISION'].includes(t.state)||![1,2].includes(t.shift)||!text(t.date)||(t.production!==undefined&&t.production!==s.production)))return unknown(s,'SHIFT_STATE_UNKNOWN');
 if(new Set(s.turns.map(t=>JSON.stringify([t.stage,t.date,t.shift]))).size!==s.turns.length)return unknown(s,'DUPLICATE_SHIFT_STATE','DISCREPANCY');
 if(new Set(events.map(e=>e.id)).size!==events.length||new Set(cut.includedEventIds).size!==cut.includedEventIds.length)return unknown(s,'DUPLICATE_EVIDENCE','DISCREPANCY');
 if(cut.includedEventIds.some(id=>!events.some(e=>e.id===id)))return unknown(s,'UNKNOWN_EXPORT_INCLUSION');
 let assembled=cut.assembled,packed=cut.packed;
 for(const e of events){
  if(!text(e.id)||e.unit!==s.unit||e.production!==s.production||!['ENSAMBLE','EMPAQUE'].includes(e.stage)||!Number.isSafeInteger(e.delta))return unknown(s,'EVENT_IDENTITY_OR_QUANTITY_INVALID','DISCREPANCY');
  if(e.reserve!==undefined||e.part!==undefined){if(!s.relations.some(r=>r.production===s.production&&r.reserve===e.reserve&&r.part===e.part))return unknown(s,'RESERVE_PART_RELATION_UNPROVEN');}
  if(!cut.includedEventIds.includes(e.id)){if(e.stage==='ENSAMBLE')assembled+=e.delta;else packed+=e.delta;}
 }
 if(!validQty(assembled)||!validQty(packed)||packed>assembled)return unknown(s,'ASSEMBLY_PACKING_QUANTITY_DISCREPANCY','DISCREPANCY');
 if(pdts.some(p=>!text(p.id)||p.production!==s.production||!['ENSAMBLE','EMPAQUE','PICKING','PRODUCCION'].includes(p.origin)||typeof p.active!=='boolean'))return unknown(s,'PDT_STATE_OR_IDENTITY_UNKNOWN');
 if(new Set(pdts.map(p=>p.id)).size!==pdts.length)return unknown(s,'DUPLICATE_PDT','DISCREPANCY');
 const legacyActive=pdts.filter(p=>p.active&&['PICKING','PRODUCCION'].includes(p.origin));
 if(legacyActive.some(p=>!['NONE','BLOCKS'].includes(p.assemblyImpact)))return unknown(s,'LEGACY_PDT_STAGE_IMPACT_UNKNOWN');
 const blocks=pdts.filter(p=>p.active&&(p.origin==='ENSAMBLE'||p.assemblyImpact==='BLOCKS'));
 let blocked=0,eligibleUnitIds=null;
 if(blocks.length){
  const map=s.unitMap;
  if(!map||map.revision!==s.revision||!Array.isArray(map.assembledIds)||!Array.isArray(map.packedIds)||map.production!==s.production||map.unit!==s.unit)return unknown(s,'UNIT_MAPPING_UNAVAILABLE');
  const a=new Set(map.assembledIds),p=new Set(map.packedIds);
  if(a.size!==map.assembledIds.length||p.size!==map.packedIds.length||a.size!==assembled||p.size!==packed||[...a].some(id=>!text(id))||[...p].some(id=>!a.has(id)))return unknown(s,'UNIT_MAPPING_COUNTS_DISAGREE','DISCREPANCY');
  const affected=new Set();
  for(const b of blocks){
   if(b.mappingRevision!==s.revision||!Array.isArray(b.affectedUnitIds)||b.affectedUnitIds.length===0)return unknown(s,'PDT_QUANTITATIVE_IMPACT_UNKNOWN');
   for(const id of b.affectedUnitIds){if(!a.has(id))return unknown(s,'PDT_UNIT_NOT_ASSEMBLED','DISCREPANCY');if(p.has(id))return unknown(s,'BLOCKED_UNIT_ALREADY_PACKED','DISCREPANCY');affected.add(id);}
  }
  blocked=affected.size;eligibleUnitIds=[...a].filter(id=>!p.has(id)&&!affected.has(id)).sort();
 }
 return {contractVersion:1,status:'READY',unit:s.unit,available:assembled-packed-blocked,assembled,packed,blocked,eligibleUnitIds,revision:s.revision,cutId:cut.id,reasons:[]};
}
function authorize(session,production,operation){
 assert(session?.active===true&&text(session.user),'AUTH_REQUIRED');
 const roles=operation==='resolve'?['CONSULTA','LIDER','LIDER LINEA','COORDINADOR','ADMINISTRADOR']:operation==='correctAssembly'?['COORDINADOR','ADMINISTRADOR']:['LIDER','LIDER LINEA','COORDINADOR','ADMINISTRADOR'];
 assert(roles.includes(session.role)&&session.productions?.includes(production),'SCOPE_DENIED');
 assert(session.stages?.includes(operation==='correctAssembly'?'ENSAMBLE':'EMPAQUE'),'STAGE_DENIED');
}
function requestFields(r,kind){
 const allowed=kind==='consume'?['id','production','revision','quantity','date','shift','observation']:['id','production','revision','total','date','shift','observation'];
 assert(r&&Object.keys(r).every(k=>allowed.includes(k))&&text(r.id)&&text(r.production)&&validQty(r.revision),'INVALID_REQUEST');
 assert(/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&!Number.isNaN(Date.parse(r.date+'T00:00:00Z'))&&new Date(r.date+'T00:00:00Z').toISOString().slice(0,10)===r.date&&[1,2].includes(r.shift),'INVALID_SHIFT');
 assert(kind==='consume'?validQty(r.quantity)&&r.quantity>0:validQty(r.total)&&text(r.observation),'INVALID_QUANTITY_OR_REASON');
}
function requiredTurn(snapshot,request,stage){
 assert(snapshot?.complete?.turns===true&&Array.isArray(snapshot.turns),'SHIFT_EVIDENCE_UNAVAILABLE');
 const turn=snapshot.turns.find(t=>t?.stage===stage&&t.date===request.date&&t.shift===request.shift);
 assert(turn,'SHIFT_NOT_FOUND');
 assert(['ABIERTO','CERRADO','EN_REVISION'].includes(turn.state),'SHIFT_STATE_UNKNOWN');
 return turn;
}
/** No API accepts snapshot, actor, available, verified flags or unit selections.
 * sessionId is only a lookup handle; authentication/scope come from repository.
 */
export function createPackingResolver(repository){
 async function transaction(key,work){try{return await repository.transaction(key,work);}catch(error){if(error instanceof ResolverError)throw error;fail('SERVER_TRANSACTION_FAILED');}}
 async function execute(operation,sessionId,r){
  requestFields(r,operation);
  return transaction(r.production,async tx=>{
   const session=await tx.session(sessionId);authorize(session,r.production,operation);
   const signature=stable({operation,request:r,user:session.user});const prior=await tx.request(r.id);
   if(prior)assert(prior.signature===signature,'IDEMPOTENCY_REUSED');
   const s=await tx.snapshot();assert(s?.production===r.production,'SOURCE_IDENTITY_MISMATCH');
   const stage=operation==='correctAssembly'?'ENSAMBLE':'EMPAQUE';
   if(prior){requiredTurn(s,r,stage);return {...prior.response,duplicate:true};}
   assert(s.revision===r.revision,'REVISION_CONFLICT');const evaluated=evaluateServerSnapshot(s);
   assert(evaluated.status==='READY',evaluated.reasons[0]||'EVIDENCE_UNAVAILABLE');
   const turn=requiredTurn(s,r,stage);
   assert(turn.state!=='CERRADO','AUTHORIZED_REOPEN_REQUIRED');
   if(turn.state==='EN_REVISION')assert(['COORDINADOR','ADMINISTRADOR'].includes(session.role)&&text(r.observation),'REVIEW_CORRECTION_DENIED');
   let delta,unitIds=[];
   if(operation==='consume'){
    assert(r.quantity<=evaluated.available,'INSUFFICIENT_ELIGIBLE_UNITS');delta=r.quantity;
    if(evaluated.eligibleUnitIds)unitIds=evaluated.eligibleUnitIds.slice(0,r.quantity);
   }else{
    assert(r.total<=evaluated.assembled,'ASSEMBLY_CORRECTION_NOT_DOWNWARD');
    assert(r.total>=evaluated.packed,'CORRECTION_LEAVES_PACKING_UNBACKED');
    // A count-only correction cannot decide which mapped physical unit is undone.
    assert(!s.pdts.some(p=>p.active&&(p.origin==='ENSAMBLE'||p.assemblyImpact==='BLOCKS')),'CORRECTION_NEEDS_UNIT_RECONCILIATION');
    delta=r.total-evaluated.assembled;
   }
   const event={id:r.id,production:r.production,unit:s.unit,stage,delta,date:r.date,shift:r.shift,user:session.user,observation:r.observation||null,unitIds};
   const response={ok:true,operation,eventId:r.id,revision:s.revision+1,cutId:s.cut.id,available:operation==='consume'?evaluated.available-r.quantity:r.total-evaluated.packed,duplicate:false};
   await tx.commit({expectedRevision:s.revision,event,request:{id:r.id,signature,response}});return response;
  });
 }
 return Object.freeze({
  async resolve(sessionId,production){
   assert(text(production),'INVALID_REQUEST');
   return transaction(production,async tx=>{
    authorize(await tx.session(sessionId),production,'resolve');
    try{const s=await tx.snapshot();if(s?.production!==production)return unknown(null,'SOURCE_IDENTITY_MISMATCH','DISCREPANCY');return evaluateServerSnapshot(s);}catch{return unknown(null,'SERVER_SOURCE_UNAVAILABLE');}
   });
  },
  consume:(sessionId,request)=>execute('consume',sessionId,request),
  correctAssembly:(sessionId,request)=>execute('correctAssembly',sessionId,request)
 });
}
