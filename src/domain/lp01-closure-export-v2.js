import {POWERBI_VERSION} from './powerbi/adapter.js';
import {closureExportRealized} from './lp01-closure-export.js';

const CONTRACT='LP-EXPORT-CLOSE-3',AUTHORITY='EXPORT_PRODUCTION_V2';
const PLAN='PLAN_SOURCE_REQUIRED',RECONCILIATION='RECONCILIATION_REQUIRED';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const own=(v,key)=>object(v)&&Object.prototype.hasOwnProperty.call(v,key);
const quantity=v=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const id=v=>typeof v==='string'&&v.length>0&&v.trim()===v;
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/i.test(v);
const date=v=>{
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number(v.slice(0,4))<1)return false;
 const ms=Date.parse(v+'T00:00:00Z');
 return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===v;
};
const contextValid=c=>object(c)&&['ENSAMBLE','EMPAQUE'].includes(c.stage)&&['PANELES_2','FRAMES_2'].includes(c.line)&&date(c.date)&&[1,2].includes(c.shift);
const exact=(v,c)=>object(v)&&v.stage===c.stage&&v.line===c.line&&v.date===c.date&&v.shift===c.shift;
const reportScope=(v,c)=>object(v)&&v.etapa===c.stage&&v.linea===c.line&&v.fecha===c.date&&v.turno===c.shift;
const keyInLine=(key,line)=>id(key)&&key.endsWith('|'+line)&&key.slice(0,-line.length-1).trim().length>0;
const pending=status=>({contract:'LP-REALIZADO-CIERRE-3',status,rows:[]});

/** Select only a unique current close. In particular an archive cannot become
 * current merely because it contains the latest available number of a version.
 * Callers validate the authenticated LP-OPERACION-1 envelope/session; no network,
 * token, capability, opening, import or close command lives in this module.
 */
function currentReport(data,context){
 if(!contextValid(context))throw Error('Contexto de cierre incompatible');
 if(data?.contract!=='LP-OPERACION-1'||data.turn?.estado!=='CERRADO')return {status:'NO_CONFIRMED_CLOSE'};
 const source=data.reports??[];
 if(!Array.isArray(source)||source.some(r=>!object(r)))return {status:'INCOMPATIBLE_CLOSE'};
 const reports=source.filter(r=>reportScope(r,context));
 if(!reports.length)return {status:'NO_CONFIRMED_CLOSE'};
 if(!quantity(data.turn.revision)||reports.some(r=>!quantity(r.version)))return {status:'INCOMPATIBLE_CLOSE'};
 const turn=data.turn;
 if(['etapa','linea','fecha','turno'].some(k=>own(turn,k))&&!reportScope(turn,context))return {status:'INCOMPATIBLE_CLOSE'};
 const version=reports.reduce((max,r)=>Math.max(max,r.version),0),latest=reports.filter(r=>r.version===version);
 if(latest.length!==1||version!==turn.revision)return {status:'INCOMPATIBLE_CLOSE'};
 const report=latest[0];
 if(!id(report.id)||reports.some(r=>r!==report&&r.id===report.id))return {status:'INCOMPATIBLE_CLOSE'};
 return {status:'CURRENT',report};
}

function historicalReferences(row,context,assignmentIds,scheduledIds){
 const refs=row.assignmentRefs,manual=row.manualHistory,scheduled=row.scheduledReference;
 if(!Array.isArray(refs)||!refs.length||refs.some(ref=>!id(ref))||new Set(refs).size!==refs.length||refs.some(ref=>assignmentIds.has(ref)))return false;
 if(!object(manual)||manual.authority!=='HISTORICAL_ONLY'||!Array.isArray(manual.assignments)||manual.assignments.length!==refs.length)return false;
 const present=new Set();
 for(const a of manual.assignments){
  if(!reportScope(a,context)||a.key!==row.key||!id(a.parte)||!refs.includes(a.parte)||present.has(a.parte))return false;
  present.add(a.parte);
 }
 if(!object(scheduled)||scheduled.authority!=='HISTORICAL_REFERENCE_ONLY'||scheduled.quantity!==null||!Array.isArray(scheduled.assignments))return false;
 for(const a of scheduled.assignments){
  if(!object(a)||!id(a.id)||a.key_produccion!==row.key||a.fecha!==context.date||a.turno!==context.shift||a.estado==='CANCELADA'||scheduledIds.has(a.id))return false;
  scheduledIds.add(a.id);
 }
 refs.forEach(ref=>assignmentIds.add(ref));
 return true;
}
function snapshotIdentity(row,context){
 if(!own(row,'identity'))return null; // Missing historical names cannot be recovered from today's catalog.
 const v=row.identity;
 if(!object(v)||v.key!==row.key||v.line!==context.line||typeof v.production!=='string'||!v.production.trim()||(v.system!==null&&(typeof v.system!=='string'||!v.system.trim())))return false;
 return {key:v.key,line:v.line,production:v.production,system:v.system};
}

function valueSource(row,s,context,files,imports,usedRows){
 const source=row.valueSource;
 if(row.valueStatus==='NEVER_REPORTED')return source===null?null:false;
 if(!object(source)||!id(source.importId)||!quantity(source.importVersion)||source.importVersion<1||!hash(source.universeRevision)||!exact(source.context,context))return false;
 const f=source.file;
 if(!object(f)||!id(f.id)||typeof f.name!=='string'||!f.name.trim()||!hash(f.sha256)||f.adapter!==POWERBI_VERSION||!Array.isArray(source.sourceRows)||!source.sourceRows.length)return false;
 const file={id:f.id,name:f.name,sha256:f.sha256,adapter:f.adapter},fileSignature=JSON.stringify(file);
 if(files.has(f.id)&&files.get(f.id)!==fileSignature)return false;
 files.set(f.id,fileSignature);
 const importSignature=JSON.stringify([source.importVersion,source.universeRevision,file]);
 if(imports.has(source.importId)&&imports.get(source.importId)!==importSignature)return false;
 imports.set(source.importId,importSignature);
 if(row.valueStatus==='CURRENT_FILE'){
  if(source.importId!==s.importId||source.importVersion!==s.version-1||source.universeRevision!==s.universeRevision||f.id!==s.file.id||fileSignature!==files.get(s.file.id)||JSON.stringify(source.sourceRows)!==JSON.stringify(row.sourceRows))return false;
 }else if(row.valueStatus!=='PRESERVED'||source.importVersion>=s.version-1||source.importId===s.importId)return false;
 for(const n of source.sourceRows){
  const key=JSON.stringify([f.id,n]);
  if(!Number.isSafeInteger(n)||n<1||usedRows.has(key))return false;
  usedRows.add(key);
 }
 return {importId:source.importId,importVersion:source.importVersion,universeRevision:source.universeRevision,
  context:{stage:context.stage,line:context.line,date:context.date,shift:context.shift},file,sourceRows:[...source.sourceRows]};
}

function projectV2(report,context){
 const s=report.snapshot,invalid=()=>pending('INCOMPATIBLE_CLOSE');
 // V2 writer's contained pilot. Supporting another stage/line needs its own
 // accredited writer contract; a matching label alone cannot extend the pilot.
 if(context.stage!=='ENSAMBLE'||context.line!=='PANELES_2')return invalid();
 if(!object(s)||s.contract!==CONTRACT||s.authority!==AUTHORITY||s.ok!==true||!exact(s,context)||!id(s.id)||s.id!==report.id||s.version!==report.version||s.version<2||s.type!=='CON_ACTIVIDAD'||report.tipo!=='CON_ACTIVIDAD')return invalid();
 if(!id(s.importId)||!hash(s.universeRevision)||s.canContinue!==false||s.comparisonComplete!==false||s.planComparison!==PLAN||s.reconciliation!==RECONCILIATION)return invalid();
 const file=s.file;
 if(!object(file)||!id(file.id)||!id(report.archivo)||file.id!==report.archivo||file.adapter!==POWERBI_VERSION||!hash(file.sha256)||typeof file.name!=='string'||!file.name.trim())return invalid();
 if(!Array.isArray(s.rows)||!s.rows.length||!object(s.reasons))return invalid();
 const keys=new Set(),usedRows=new Set(),files=new Map([[file.id,JSON.stringify({id:file.id,name:file.name,sha256:file.sha256,adapter:file.adapter})]]),imports=new Map(),assignmentIds=new Set(),scheduledIds=new Set(),rows=[];
 for(const row of s.rows){
  if(!object(row)||!keyInLine(row.key,context.line)||keys.has(row.key))return invalid();
  keys.add(row.key);
  if(['power_bi','ejecutado','sale','assignments','diferencia'].some(k=>own(row,k)))return invalid();
  if(row.plan!==null||row.planStatus!==PLAN||row.difference!==null||row.pendingAgainstPlan!==null)return invalid();
  if(!object(row.budget)||row.budget.status!==RECONCILIATION||row.budget.available!==null||!object(row.continuity)||row.continuity.status!==RECONCILIATION||row.continuity.quantity!==null||row.continuity.allocation!=='NONE')return invalid();
  if(!Array.isArray(row.sourceRows))return invalid();
  if(row.coverage==='PRESENT'){
   if(row.valueStatus!=='CURRENT_FILE'||!quantity(row.realized)||row.preserve!==false||!row.sourceRows.length)return invalid();
  }else if(row.coverage==='ABSENT'){
   if(row.preserve!==true||row.sourceRows.length)return invalid();
   if(row.valueStatus==='PRESERVED'){if(!quantity(row.realized))return invalid();}
   else if(row.valueStatus!=='NEVER_REPORTED'||row.realized!==null)return invalid();
  }else return invalid();
  const origin=valueSource(row,s,context,files,imports,usedRows);if(origin===false)return invalid();
  const rawReason=own(s.reasons,row.key)?s.reasons[row.key]:null;
  if(rawReason!==null&&(typeof rawReason!=='string'||rawReason.length>2000))return invalid();
  // PostgreSQL btrim(text) removes spaces, not newlines/tabs inside a recorded reason.
  const reason=rawReason===null?null:rawReason.replace(/^ +| +$/g,'')||null;
  if(row.reason!==reason||(row.coverage==='ABSENT'&&!reason?.trim()))return invalid();
  if(!historicalReferences(row,context,assignmentIds,scheduledIds))return invalid();
  const identity=snapshotIdentity(row,context);if(identity===false)return invalid();
  rows.push({key:row.key,quantity:row.realized,coverage:row.coverage,preserve:row.preserve,reason,sourceRows:[...row.sourceRows],identity,valueStatus:row.valueStatus,valueSource:origin,
   source:'EXPORT_CIERRE_V2',closureId:report.id,version:report.version,fileId:origin?.file.id??null,sha256:origin?.file.sha256??null,importId:origin?.importId??null,universeRevision:origin?.universeRevision??null,
   plan:null,planStatus:PLAN,difference:null,pendingAgainstPlan:null,budget:{status:RECONCILIATION,available:null},continuity:{status:RECONCILIATION,quantity:null,allocation:'NONE'}});
 }
 if(Object.entries(s.reasons).some(([key,value])=>!keys.has(key)||typeof value!=='string'||value.length>2000))return invalid();
 return {contract:'LP-REALIZADO-CIERRE-3',status:'CONFIRMED',authority:AUTHORITY,closureId:report.id,version:report.version,
  importId:s.importId,universeRevision:s.universeRevision,file:{id:file.id,name:file.name,sha256:file.sha256,adapter:file.adapter},rows,
  canContinue:false,comparisonComplete:false,planComparison:PLAN,reconciliation:RECONCILIATION};
}

/** Strict read-only V2 projection. Hashes/import IDs are immutable provenance
 * recorded by the server, not browser-generated proof or a recalculated universe.
 * Coverage describes only the latest file. ABSENT preserves an accredited earlier
 * value or remains null if never reported. It never adds imports or invents zero.
 * Contract 2 is intentionally incompatible; its whole-projection rule was never
 * deployed. Names of exported functions stay stable for the existing integration.
 * Reopened turns have no current projection. Only the reports UI may validate an
 * archive using a synthetic closed envelope, separately labeling it historical.
 */
export function closureExportRealizedV2(data,context){
 const selected=currentReport(data,context);
 return selected.status==='CURRENT'?projectV2(selected.report,context):pending(selected.status);
}

/** The current snapshot selects its reader. Unknown/missing V2 discriminators
 * fail closed and never fall back to an earlier/legacy report with a quantity.
 * Native legacy snapshots have no contract/authority markers; their pinned
 * validator remains untouched and remains the only authority for that shape.
 */
export function currentClosureExportRealized(data,context){
 const selected=currentReport(data,context);
 if(selected.status!=='CURRENT')return pending(selected.status);
 const s=selected.report.snapshot;
 if(s?.contract===CONTRACT&&s?.authority===AUTHORITY)return projectV2(selected.report,context);
 if(!object(s)||own(s,'contract')||own(s,'authority')||['importId','universeRevision','planComparison','reconciliation'].some(k=>own(s,k))||(Array.isArray(s.rows)&&s.rows.some(r=>['realized','coverage','manualHistory'].some(k=>own(r,k)))))return pending('INCOMPATIBLE_CLOSE');
 return closureExportRealized(data,context);
}
