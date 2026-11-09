const qty=v=>Number.isSafeInteger(v)&&v>=0;
const same=(a,b)=>['stage','line','date','shift'].every(k=>a?.[k]===b?.[k]);
const datedSource=s=>s&&typeof s.loadId==='string'&&s.loadId&&typeof s.file==='string'&&s.file.trim()&&Number.isFinite(Date.parse(s.at));
function chainedClassification(payload,context,closureId,rows){
 if(payload.status!=='ESTIMATED_REFERENCE'||payload.method!=='CHAINED_CLOSURES_RECONCILED'||payload.closureId!==closureId||!same(payload.context,context)||context.stage!=='ENSAMBLE'||context.line!=='PANELES_2'||payload.exactCut!==false||payload.historyComplete!==false||!datedSource(payload.source)||!datedSource(payload.verificationSource)||Date.parse(payload.verificationSource.at)<=Date.parse(payload.source.at)||!Array.isArray(payload.priorClosures)||!Array.isArray(payload.rows)||payload.rows.length!==rows.length)return null;
 const prior=new Map();
 for(const c of payload.priorClosures){
  if(!c||typeof c.closureId!=='string'||!c.closureId||c.closureId===closureId||prior.has(c.closureId)||!qty(c.closureVersion)||c.closureVersion<1||typeof c.snapshotHash!=='string'||!/^[a-f0-9]{32}$/i.test(c.snapshotHash)||c.context?.stage!==context.stage||c.context.line!==context.line||c.context.date!==context.date||!Number.isInteger(c.context.shift)||c.context.shift<1||c.context.shift>=context.shift)return null;
  prior.set(c.closureId,c);
 }
 const source=new Map(payload.rows.map(r=>[r?.key,r]));if(source.size!==rows.length)return null;
 let known=0;
 for(const r of rows){
  const s=source.get(r.key);if(!s||!qty(s.realized)||s.realized!==r.realized)return null;
  if(s.status==='UNAVAILABLE'){
   if(s.initialBalance!==null||s.finalBalance!==null||typeof s.reason!=='string'||!s.reason.trim())return null;
   continue;
  }
  if(s.status!=='ESTIMATED_REFERENCE'||!qty(s.quantity)||s.quantity===0||!qty(s.baseBalance)||s.baseBalance>s.quantity||!qty(s.initialBalance)||s.initialBalance>s.quantity||!qty(s.finalBalance)||!qty(s.verificationBalance)||s.verificationBalance!==s.finalBalance||s.finalBalance!==s.initialBalance-s.realized||!qty(s.referenceRowId)||s.referenceRowId<1||!qty(s.verificationRowId)||s.verificationRowId<1||!Array.isArray(s.priorMovements))return null;
  let previous=0;const seen=new Set();
  for(const movement of s.priorMovements){if(!prior.has(movement?.closureId)||seen.has(movement.closureId)||!qty(movement.quantity))return null;seen.add(movement.closureId);previous+=movement.quantity;}
  if(!qty(previous)||s.initialBalance!==s.baseBalance-previous)return null;
  known++;
 }
 if(!known)return null;
 return {source:structuredClone(payload.source),verificationSource:structuredClone(payload.verificationSource),priorClosures:structuredClone(payload.priorClosures),method:payload.method,rows:rows.map(r=>{
  const s=source.get(r.key);
  if(s.status==='UNAVAILABLE')return {...r,initialBalance:null,finalBalance:null,classificationKnown:false,classificationEstimated:false,closed:false,opened:false,advanced:false,classificationReason:s.reason};
  return classified(r,s,{classificationProvenance:{method:payload.method,referenceRowId:s.referenceRowId,verificationRowId:s.verificationRowId,baseBalance:s.baseBalance,priorMovements:structuredClone(s.priorMovements),verificationBalance:s.verificationBalance}});
 })};
}
function classified(r,s,extra={}){const closed=s.initialBalance>0&&s.finalBalance===0;return {...r,initialBalance:s.initialBalance,finalBalance:s.finalBalance,classificationKnown:true,classificationEstimated:true,closed,opened:s.initialBalance===s.quantity&&s.realized>0,advanced:s.initialBalance>0&&s.initialBalance<s.quantity&&!closed&&s.realized>0&&s.finalBalance>0,...extra};}
export function estimatedClassification(payload,context,closureId,rows){
 if(payload?.contract==='LP-REPORT-CLASSIFICATION-2')return chainedClassification(payload,context,closureId,rows);
 if(payload?.contract!=='LP-REPORT-CLASSIFICATION-1'||payload.status!=='ESTIMATED_REFERENCE'||payload.closureId!==closureId||!['stage','line','date','shift'].every(k=>payload.context?.[k]===context[k])||context.stage!=='ENSAMBLE'||!Array.isArray(payload.rows)||payload.rows.length!==rows.length||!payload.source?.loadId||!payload.source?.file||!Number.isFinite(Date.parse(payload.source?.at)))return null;
 const source=new Map(payload.rows.map(r=>[r.key,r]));if(source.size!==rows.length)return null;
 const valid=rows.every(r=>{const s=source.get(r.key);return s&&qty(s.quantity)&&s.quantity>0&&qty(s.initialBalance)&&s.initialBalance<=s.quantity&&qty(s.finalBalance)&&qty(s.realized)&&s.realized===r.realized&&s.finalBalance===s.initialBalance-s.realized;});if(!valid)return null;
 return {source:{...payload.source},rows:rows.map(r=>classified(r,source.get(r.key)))};
}
