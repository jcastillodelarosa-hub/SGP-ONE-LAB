// Independent quality gate against totals printed by Optima.
// Source summaries are authoritative; no production completion is permitted when mismatched.
export function inchesToThirtySeconds(value) {
  const text=String(value??'').trim().replace(/["″]/g,'');
  const match=text.match(/^(\d+)(?:\s+(\d+)\/(\d+))?$/);
  if (!match) throw new Error('Longitud no interpretable: '+text);
  const whole=Number(match[1]),num=Number(match[2]??0),den=Number(match[3]??1);
  if (!Number.isSafeInteger(whole)||!Number.isSafeInteger(num)||!Number.isSafeInteger(den)||den<1||num>=den||32%den!==0) throw new Error('Fracción incompatible: '+text);
  return whole*32+num*(32/den);
}
export function reconcileOptSummary({patterns,summary,blocks=[]}) {
  if (!Array.isArray(patterns)||!summary) throw new TypeError('Datos inválidos');
  const issues=[],total=(name,actual,expected)=>{
    if(expected==null) {issues.push({code:'RESUMEN_SIN_'+name});return;}
    if(actual!==expected) issues.push({code:'DIFERENCIA_'+name,actual,expected});
  };
  let bars=0,cuts=0,cutLength32=0;
  const byBlock=new Map();
  for(const [i,p] of patterns.entries()){
    const perf=Number(p.perf);
    if(!Number.isSafeInteger(perf)||perf<=0||p.incomplete||p.continues||!Array.isArray(p.cuts)||!p.cuts.length) {
      issues.push({code:'PATRON_INCOMPLETO',row:i+1});continue;
    }
    bars+=perf;
    const block=String(p.blockId??'');
    if(!block) issues.push({code:'PATRON_SIN_BLOQUE',row:i+1});
    const item=byBlock.get(block)??{bars:0,cuts:0};
    item.bars+=perf;
    for(const c of p.cuts) {
      const qty=Number(c.quantity);
      if(!Number.isSafeInteger(qty)||qty<1||!c.reference) {issues.push({code:'CORTE_INVALIDO',row:i+1});continue;}
      cuts+=perf*qty;item.cuts+=perf*qty;
      try {cutLength32+=inchesToThirtySeconds(c.length)*perf*qty;}
      catch {issues.push({code:'LONGITUD_INVALIDA',row:i+1});}
    }
    byBlock.set(block,item);
  }
  total('BARRAS',bars,summary.bars);
  total('CORTES',cuts,summary.cuts);
  if(summary.cutLength!=null) {
    try {total('LONGITUD_CORTADA',cutLength32,inchesToThirtySeconds(summary.cutLength));}
    catch {issues.push({code:'RESUMEN_LONGITUD_INVALIDA'});}
  }
  for(const block of blocks) {
    const actual=byBlock.get(String(block.id))??{bars:0,cuts:0};
    if(actual.bars!==block.bars) issues.push({code:'DIFERENCIA_BARRAS_BLOQUE',block:block.id,actual:actual.bars,expected:block.bars});
    if(block.cuts!=null&&actual.cuts!==block.cuts) issues.push({code:'DIFERENCIA_CORTES_BLOQUE',block:block.id,actual:actual.cuts,expected:block.cuts});
  }
  // Plan count is the number of original PDF plans, not the number of repeated bars.
  if(summary.plans!=null) {
    const ids=patterns.map(p=>p.planId).filter(Boolean);
    if(ids.length!==patterns.length) issues.push({code:'PLANES_NO_IDENTIFICADOS'});
    else total('PLANOS',new Set(ids).size,summary.plans);
  }
  return {verified:issues.length===0,bars,cuts,cutLength32,issues,byBlock:Object.fromEntries(byBlock)};
}
