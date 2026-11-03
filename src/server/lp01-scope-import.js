/** Private proposal only. No SQL, credentials, endpoint, role changes or access application. */
import {reviewOperationalScopes,scopeInstant,LP_LINES,LP_STAGES} from './lp01-scope-review.js';
export const SCOPE_IMPORT_CONTRACT='LP-AMBITO-IMPORTACION/1';
const fail=()=>{throw Error('PRIVATE_IMPORT_INVALID');};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const text=x=>typeof x==='string'&&x.length>0&&x.trim()===x&&x.length<=512;
const exact=(x,keys)=>object(x)&&Object.keys(x).every(k=>keys.includes(k));
const id=a=>JSON.stringify([a.user,a.stage,a.key]);
const normalized=a=>({...a,validFrom:new Date(scopeInstant(a.validFrom)).toISOString(),validUntil:new Date(scopeInstant(a.validUntil)).toISOString(),revokedAt:a.revokedAt==null?null:new Date(scopeInstant(a.revokedAt)).toISOString()});
const ordered=x=>Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]]));
const same=(a,b)=>JSON.stringify(ordered(a))===JSON.stringify(ordered(b));
const isoDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const localDate=s=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(scopeInstant(s)));
function state(x){
 if(!exact(x,['contract','assignments'])||x.contract!=='LP-AMBITO-TEMPORAL/1'||!Array.isArray(x.assignments)||x.assignments.length>20000)fail();
 for(const a of x.assignments){
  if(!exact(a,['user','key','line','stage','duty','validFrom','validUntil','revokedAt','role'])||!['user','key','line','stage','duty'].every(k=>text(a[k]))||!Number.isFinite(scopeInstant(a.validFrom))||!Number.isFinite(scopeInstant(a.validUntil))||scopeInstant(a.validFrom)>=scopeInstant(a.validUntil)||(a.revokedAt!=null&&!Number.isFinite(scopeInstant(a.revokedAt))))fail();
 }
 return x.assignments.map(normalized);
}
export function prepareScopeImport({reference,proposed,catalog,periods,asOf}){
 if(!Number.isFinite(scopeInstant(asOf))||!exact(catalog,['accounts','productions'])||!Array.isArray(catalog.accounts)||!Array.isArray(catalog.productions))fail();
 for(const a of catalog.accounts)if(!exact(a,['id','role','active'])||!text(a.id)||!text(a.role)||typeof a.active!=='boolean')fail();
 for(const p of catalog.productions)if(!exact(p,['key','line','active'])||!text(p.key)||!text(p.line)||(p.active!==undefined&&typeof p.active!=='boolean'))fail();
 if(!exact(periods,['contract','source','zone','records'])||periods.contract!=='LP-AMBITO-PERIODOS/1'||periods.source!=='sgp_lp_operacion.periodo(date,integer)'||periods.zone!=='America/Bogota'||!Array.isArray(periods.records)||!periods.records.length||periods.records.length>1000)fail();
 const seen=new Set();
 for(const p of periods.records){
  if(!exact(p,['line','stage','date','shift','start','end'])||!LP_LINES.includes(p.line)||!LP_STAGES.includes(p.stage)||!isoDate(p.date)||![1,2].includes(p.shift)||!Number.isFinite(scopeInstant(p.start))||!Number.isFinite(scopeInstant(p.end))||scopeInstant(p.end)<=scopeInstant(p.start)||scopeInstant(p.end)-scopeInstant(p.start)>=86400000||localDate(p.start)!==p.date)fail();
  const key=JSON.stringify([p.line,p.stage,p.date,p.shift]);if(seen.has(key))fail();seen.add(key);
 }
 const before=state(reference),after=state(proposed);
 const review=a=>reviewOperationalScopes({...catalog,assignments:a,at:asOf});
 const baseline=review(before),candidate=review(after),conflicts=[];
 // Invalid/duplicate reference rows cannot be silently resolved by ordering.
 for(const r of baseline.rows)if(r.reasons.some(x=>!['scope_not_current','scope_revoked','existing_active_account_required','canonical_production_line_required'].includes(x)))conflicts.push({kind:'reference_conflict',row:r.index,reasons:r.reasons});
 for(const r of candidate.rows)if(r.reasons.some(x=>!['scope_not_current','scope_revoked'].includes(x)))conflicts.push({kind:'proposed_conflict',row:r.index,reasons:r.reasons});
 const prev=new Map(before.map(a=>[id(a),a])),next=new Map(after.map(a=>[id(a),a]));
 const diff={additions:[],changes:[],expirations:[],revocations:[],unchanged:0};
 for(const [key,a] of next){
  const old=prev.get(key),entry={identity:{user:a.user,key:a.key,line:a.line,stage:a.stage},before:old??null,after:a};
  if(a.revokedAt!==null&&scopeInstant(a.revokedAt)>scopeInstant(asOf))conflicts.push({kind:'future_revocation_not_supported',identity:entry.identity});
  if(old?.revokedAt&&a.revokedAt===null)conflicts.push({kind:'revocation_reversal_requires_separate_review',identity:entry.identity});
  if(!old)diff.additions.push(entry);else if(!same(a,old))diff.changes.push(entry);else diff.unchanged++;
  if(a.revokedAt!==null&&(!old||old.revokedAt!==a.revokedAt))diff.revocations.push(entry);
  if(scopeInstant(a.validUntil)<=scopeInstant(asOf))diff.expirations.push({...entry,kind:'EXPIRED_AT_REVIEW'});
  else if(old&&scopeInstant(a.validUntil)<scopeInstant(old.validUntil))diff.expirations.push({...entry,kind:'VALIDITY_SHORTENED'});
 }
 for(const [key,a] of prev)if(!next.has(key))conflicts.push({kind:'missing_requires_explicit_revocation',identity:{user:a.user,key:a.key,line:a.line,stage:a.stage}});
 const coverage=periods.records.map(p=>{
  const r=reviewOperationalScopes({...catalog,assignments:after,at:asOf,period:{start:p.start,end:p.end}});
  return {period:p,...r.coverage.find(c=>c.line===p.line&&c.stage===p.stage),rows:r.rows.filter(row=>after[row.index-1].line===p.line&&after[row.index-1].stage===p.stage)};
 });
 for(const line of LP_LINES)for(const stage of LP_STAGES)if(!coverage.some(p=>p.period.line===line&&p.period.stage===stage))conflicts.push({kind:'period_scope_missing',line,stage});
 const ready=conflicts.length===0&&coverage.every(c=>c.primaryCovered&&c.backupCovered);
 return {contract:SCOPE_IMPORT_CONTRACT,apply:false,asOf,authorization:'NONE',status:ready?'PROPUESTA_REVISION_FUNCIONAL':'PENDIENTE_CORRECCION',readyForFunctionalReview:ready,baseline,candidate,coverage,diff,conflicts};
}
