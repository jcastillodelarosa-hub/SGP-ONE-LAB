// Printed Project data rows only. No reconstruction from cuts, material or totals.
const text=(v,max=8000)=>typeof v==='string'&&v.length>0&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
const positive=v=>Number.isSafeInteger(v)&&v>0;
const length=v=>{if(!text(v,100))return false;const m=v.match(/^(\d+)(?:\s+(\d+)\/(\d+))?"$/);if(!m)return false;const whole=Number(m[1]),num=Number(m[2]||0),den=Number(m[3]||1);return Number.isSafeInteger(whole)&&Number.isSafeInteger(num)&&Number.isSafeInteger(den)&&den>0&&num<den&&(whole>0||num>0);};
export function validOptProjectData(value){
 if(!value||value.contract!=='OPT-PROJECT-DATA-1'||value.scope!=='DOCUMENTO'||!Array.isArray(value.rows)||value.rows.length<1||value.rows.length>10000)return false;
 const seen=new Set(),items=new Set();let quantity=0;
 for(const r of value.rows){
  if(!r||!positive(r.item)||!positive(r.sourcePage)||r.sourcePage>500||!text(r.sourceId,200)||seen.has(r.sourceId)||items.has(r.item)||r.sourceId!==`project-p${r.sourcePage}-item${r.item}`||!text(r.profile,255)||!text(r.code,2000)||!length(r.length)||!text(r.reference)||!positive(r.quantity))return false;
  seen.add(r.sourceId);items.add(r.item);quantity+=r.quantity;if(!Number.isSafeInteger(quantity))return false;
 }
 return value.totalQuantity===quantity;
}
export function buildOptProjectData(sourceProjectRows){
 if(!Array.isArray(sourceProjectRows)||!sourceProjectRows.length)return null;
 const rows=sourceProjectRows.map(r=>{
  // Original item number comes from explicit printed provenance, never array order.
  const match=typeof r.sourceId==='string'?r.sourceId.match(/^project-p(\d+)-item(\d+)$/):null;
  if(!match||Number(match[1])!==r.page)throw Error('OPT_PROJECT_DATA_PROVENANCE');
  return {item:Number(match[2]),profile:r.ref,code:r.finish,length:r.length,reference:r.reference,quantity:r.quantity,sourcePage:r.page,sourceId:r.sourceId};
 });
 const result={contract:'OPT-PROJECT-DATA-1',scope:'DOCUMENTO',rows,totalQuantity:rows.reduce((n,r)=>n+r.quantity,0)};
 if(!validOptProjectData(result))throw Error('OPT_PROJECT_DATA_INVALID');
 return result;
}
