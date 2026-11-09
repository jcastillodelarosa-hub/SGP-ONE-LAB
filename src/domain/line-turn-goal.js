const qty=v=>Number.isSafeInteger(v)&&v>0;
export function reportLineGoal(e,context,closureId,current){
 const matching=e?.contract==='LP-TURN-REPORT-EVIDENCE-1'&&e.closureId===closureId&&['stage','line','date','shift'].every(k=>e[k]===context[k]);
 const g=matching?e.lineGoal:null;
 if(g?.status==='CURRENT_REFERENCE_AT_CLOSE'&&qty(g.quantity)&&Number.isFinite(Date.parse(g.capturedAt)))return {quantity:g.quantity,source:'CLOSURE_CURRENT_REFERENCE',label:'Meta vigente al emitir el cierre · referencia, no meta histórica'};
 if(g?.status==='CAPTURED_AT_CLOSE'&&qty(g.quantity)&&Number.isFinite(Date.parse(g.capturedAt)))return {quantity:g.quantity,source:'CLOSURE',label:'Meta de línea guardada en el cierre'};
 if(qty(current?.quantity))return {quantity:current.quantity,source:'CURRENT_REFERENCE',label:'Meta actual de línea · referencia, no meta histórica'};
 return {quantity:null,source:'UNAVAILABLE',label:'Meta de línea no configurada o sin evidencia'};
}
export function goalCompliance(rows,goal){
 if(!goal||!qty(goal.quantity)||rows.some(r=>!Number.isSafeInteger(r.realized)||r.realized<0))return null;
 const total=rows.reduce((s,r)=>s+r.realized,0);return Number.isSafeInteger(total)?total/goal.quantity*100:null;
}

export function availableNotDefined(e,context,closureId){return e?.contract==='LP-TURN-REPORT-EVIDENCE-1'&&e.closureId===closureId&&['stage','line','date','shift'].every(k=>e[k]===context[k])&&e.availableScope?.status==='NOT_DEFINED'&&e.availableScope?.mechanism==='CLOSURE_BINDING_CHECK'&&Number.isFinite(Date.parse(e.availableScope?.capturedAt));}
