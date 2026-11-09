const qty=v=>Number.isSafeInteger(v)&&v>=0;
const text=v=>typeof v==='string'&&v.trim().length>0;
const at=v=>text(v)&&Number.isFinite(Date.parse(v));
const same=(a,b)=>['stage','line','date','shift'].every(k=>a?.[k]===b?.[k]);
const cut=c=>c&&text(c.id)&&at(c.at);
/** Frozen turn-scoped evidence only. Never today's Disponible, plan, or catalog. */
export function turnReportEvidence(e,context,closureId,rows){
 const found=new Map();
 if(e?.contract==='LP-TURN-REPORT-EVIDENCE-1'&&e.closureId===closureId&&same(e,context)&&Array.isArray(e.rows)){
  const known=new Set(rows.map(r=>r.key)),seen=new Set();
  for(const r of e.rows){if(!known.has(r?.key)||seen.has(r.key)){found.clear();break;}seen.add(r.key);found.set(r.key,r);}
 }
 return rows.map(row=>{
  const e=found.get(row.key),a=e?.available,i=e?.initial,f=e?.final;
  const authority=a?.mechanism==='AUTOMATIC_TURN_BINDING'&&a.capturedRole==='SYSTEM'&&a.capturedBy==='SYSTEM';
  const available=a?.status==='ACCREDITED_TURN'&&authority&&qty(a.quantity)&&text(a.sourceEventId)&&text(a.referenceId)&&Number.isSafeInteger(a.revision)&&a.revision>0&&text(a.sourceAuthor)&&at(a.capturedAt)&&cut(a.cut)&&a.cut.id===a.referenceId&&a.cut.at===a.capturedAt?a.quantity:null;
  const initial=i?.status==='ACCREDITED_CUT'&&text(i.evidenceId)&&qty(i.quantity)&&i.quantity>0&&qty(i.balance)&&i.balance<=i.quantity&&cut(i.cut)?i:null;
  const final=f?.status==='ACCREDITED_CUT'&&text(f.evidenceId)&&qty(f.balance)&&initial&&f.balance<=initial.quantity&&cut(f.cut)?f:null;
  const known=initial&&final&&qty(row.realized),closed=Boolean(known&&initial.balance>0&&final.balance===0),opened=Boolean(known&&initial.balance===initial.quantity&&row.realized>0),advanced=Boolean(known&&!closed&&row.realized>0&&final.balance>0);
  const comparable=available!==null&&available>0&&qty(row.realized),compliance=comparable?row.realized/available*100:null;
  return {...row,available,compliance,comparable,complianceState:comparable?(row.realized>=available?'Cumplido':'No cumplido'):available===0?'No calculable · Disponible 0':'Por validar',initialBalance:initial?.balance??null,finalBalance:final?.balance??null,classificationKnown:Boolean(known),closed,opened,advanced,evidence:e?structuredClone(e):null};
 });
}
export function turnReportTotals(rows){
 const included=rows.filter(r=>r.comparable),available=included.reduce((s,r)=>s+r.available,0),realized=included.reduce((s,r)=>s+r.realized,0),safe=Number.isSafeInteger(available)&&Number.isSafeInteger(realized);
 return {available:included.length&&safe?available:null,comparableRealized:included.length&&safe?realized:null,compliance:included.length&&safe&&available>0?realized/available*100:null,included:included.length,excluded:rows.length-included.length,closed:rows.filter(r=>r.closed).length,opened:rows.filter(r=>r.opened).length,advanced:rows.filter(r=>r.advanced).length,classificationPending:rows.filter(r=>!r.classificationKnown).length};
}
