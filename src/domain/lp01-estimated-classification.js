const qty=v=>Number.isSafeInteger(v)&&v>=0;
export function estimatedClassification(payload,context,closureId,rows){
 if(payload?.contract!=='LP-REPORT-CLASSIFICATION-1'||payload.status!=='ESTIMATED_REFERENCE'||payload.closureId!==closureId||!['stage','line','date','shift'].every(k=>payload.context?.[k]===context[k])||context.stage!=='ENSAMBLE'||!Array.isArray(payload.rows)||payload.rows.length!==rows.length||!payload.source?.loadId||!payload.source?.file||!Number.isFinite(Date.parse(payload.source?.at)))return null;
 const source=new Map(payload.rows.map(r=>[r.key,r]));if(source.size!==rows.length)return null;
 const valid=rows.every(r=>{const s=source.get(r.key);return s&&qty(s.quantity)&&s.quantity>0&&qty(s.initialBalance)&&s.initialBalance<=s.quantity&&qty(s.finalBalance)&&qty(s.realized)&&s.realized===r.realized&&s.finalBalance===s.initialBalance-s.realized;});if(!valid)return null;
 return {source:{...payload.source},rows:rows.map(r=>{const s=source.get(r.key),closed=s.initialBalance>0&&s.finalBalance===0;return {...r,initialBalance:s.initialBalance,finalBalance:s.finalBalance,classificationKnown:true,classificationEstimated:true,closed,opened:s.initialBalance===s.quantity&&s.realized>0,advanced:s.initialBalance>0&&s.initialBalance<s.quantity&&!closed&&s.realized>0&&s.finalBalance>0};})};
}
