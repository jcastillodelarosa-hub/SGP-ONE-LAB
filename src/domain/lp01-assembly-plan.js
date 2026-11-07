const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const nonblank=v=>typeof v==='string'&&v.trim().length>0;
const text=v=>nonblank(v)&&v.trim()===v;
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const at=v=>typeof v==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(v)&&Number.isFinite(Date.parse(v));
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&v.slice(0,4)!=='0000'&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const scope=c=>object(c)&&c.stage==='ENSAMBLE'&&c.line==='PANELES_2'&&date(c.date)&&[1,2].includes(c.shift);
const key=v=>text(v)&&v.endsWith('|PANELES_2')&&v!=='|PANELES_2';
const fail=()=>{throw Error('Snapshot del plan de Ensamble incompatible');};

function sourceTargets(rows,context){
 if(!Array.isArray(rows))fail();
 const ids=new Set(),targets=new Map();
 for(const row of rows){
  const a=row?.assignment;
  if(!object(row)||row.line!==context.line||typeof row.excluded!=='boolean'||!object(a)||!uuid(a.id)||ids.has(a.id)||!key(a.key_produccion)||a.fecha!==context.date||a.turno!==context.shift||!integer(a.cantidad)||a.cantidad===0||!text(a.estado))fail();
  ids.add(a.id);
  if(row.excluded||a.estado==='CANCELADA')continue;
  const target=targets.get(a.key_produccion)||{key:a.key_produccion,quantity:0,assignmentIds:[]};
  target.quantity+=a.cantidad;if(!integer(target.quantity))fail();
  target.assignmentIds.push(a.id);targets.set(a.key_produccion,target);
 }
 return targets;
}

/** Structural/provenance validation of a server-recorded plan snapshot only.
 * The authenticated caller/SQL writer must establish scope, generation, source
 * locks and freshness. A valid object or browser hash is never write authority.
 * This reader does not turn a historical baseline into an original recovered plan.
 * It does not dispatch commands or enable the contained close path.
 */
export function assemblyPlanSnapshot(snapshot,context){
 if(!scope(context))throw Error('Contexto del plan de Ensamble incompatible');
 const s=snapshot;
 if(!object(s)||s.contract!=='LP-ENSAMBLE-PLAN-1'||s.status!=='ACCREDITED_CURRENT'||s.source!=='PROGRAMACION_LINEA'||!scope(s)||['stage','line','date','shift'].some(k=>s[k]!==context[k])||!integer(s.generation)||!integer(s.version)||!uuid(s.versionId)||!at(s.capturedAt)||!hash(s.fingerprint))fail();
 if(s.historyComplete!==false||s.historySinceEnrollment!=='COMPLETE')fail();
 const b=s.baseline;
 if(!object(b)||b.kind!=='OBSERVED_AT_ENROLLMENT'||b.historyBefore!=='UNKNOWN'||!uuid(b.versionId)||!at(b.capturedAt))fail();
 sourceTargets(b.sourceRows,context);
 const expected=sourceTargets(s.sourceRows,context),targets=[];
 if(!Array.isArray(s.targets)||s.targets.length!==expected.size)fail();
 const seen=new Set();
 for(const t of s.targets){
  if(!object(t)||!key(t.key)||seen.has(t.key)||!integer(t.quantity)||!Array.isArray(t.assignmentIds)||new Set(t.assignmentIds).size!==t.assignmentIds.length)fail();
  const source=expected.get(t.key);
  if(!source||t.quantity!==source.quantity||t.assignmentIds.length!==source.assignmentIds.length||t.assignmentIds.some(id=>!source.assignmentIds.includes(id)))fail();
  seen.add(t.key);targets.push({key:t.key,quantity:t.quantity,assignmentIds:[...t.assignmentIds]});
 }
 if(!Array.isArray(s.changes)||s.changes.length!==s.version+1)fail();
 const versions=new Set(),requests=new Set();let previous=null;
 const changes=s.changes.map((change,index)=>{
  if(!object(change)||change.version!==index||!uuid(change.versionId)||versions.has(change.versionId)||change.previousVersionId!==previous||!at(change.at)||!hash(change.fingerprint))fail();
  if(index===0){
   if(change.operation!=='OBSERVED_AT_ENROLLMENT'||change.actor!==null||change.motive!==null||change.requestId!==null||change.versionId!==b.versionId||change.at!==b.capturedAt)fail();
  }else{
   if(!text(change.operation)||change.operation==='OBSERVED_AT_ENROLLMENT'||!nonblank(change.actor)||!nonblank(change.motive)||Array.from(change.motive).length>2000||!uuid(change.requestId)||requests.has(change.requestId))fail();
   requests.add(change.requestId);
  }
  versions.add(change.versionId);previous=change.versionId;return {...change};
 });
 const current=changes.at(-1);
 if(current.versionId!==s.versionId||current.at!==s.capturedAt||current.fingerprint!==s.fingerprint)fail();
 // Version zero is the observation itself, not a second independently supplied source.
 if(s.version===0&&JSON.stringify(b.sourceRows)!==JSON.stringify(s.sourceRows))fail();
 return {contract:'LP-ENSAMBLE-PLAN-READ-1',status:'VALIDATED_SNAPSHOT',source:s.source,context:{...context},generation:s.generation,versionId:s.versionId,version:s.version,capturedAt:s.capturedAt,fingerprint:s.fingerprint,targets,
  baseline:{versionId:b.versionId,capturedAt:b.capturedAt,kind:b.kind,historyBefore:'UNKNOWN'},historyComplete:false,historySinceEnrollment:'COMPLETE',changes};
}

/** Compare only the persisted server pair. Never pair a historical close with
 * today's plan or infer production eligibility from this browser projection.
 */
export function assemblyPlanComparison(comparison,context){
 const c=comparison;
 if(!object(c)||c.contract!=='LP-ENSAMBLE-PLAN-COMPARISON-1'||c.planComparison!=='ACCREDITED_CURRENT'||typeof c.comparisonComplete!=='boolean'||!Array.isArray(c.rows))fail();
 const plan=assemblyPlanSnapshot(c.planSnapshot,context),targets=new Map(plan.targets.map(t=>[t.key,t.quantity])),seen=new Set();
 const rows=c.rows.map(row=>{
  if(!object(row)||!key(row.key)||seen.has(row.key)||row.planStatus!=='ACCREDITED_CURRENT'||row.plan!==(targets.get(row.key)??0)||(row.realized!==null&&!integer(row.realized)))fail();
  const known=row.realized!==null;
  if(row.difference!==(known?row.realized-row.plan:null)||row.pendingAgainstPlan!==(known?Math.max(row.plan-row.realized,0):null))fail();
  seen.add(row.key);return {key:row.key,plan:row.plan,planStatus:row.planStatus,realized:row.realized,difference:row.difference,pendingAgainstPlan:row.pendingAgainstPlan};
 });
 if([...targets.keys()].some(k=>!seen.has(k))||c.comparisonComplete!==(rows.length>0&&rows.every(row=>row.realized!==null)))fail();
 return {contract:'LP-ENSAMBLE-PLAN-COMPARISON-READ-1',status:'VALIDATED_COMPARISON',planSnapshot:plan,comparisonComplete:c.comparisonComplete,rows};
}
