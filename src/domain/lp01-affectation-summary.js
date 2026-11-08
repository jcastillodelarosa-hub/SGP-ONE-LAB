import {packingNativeEvidence} from './lp01-packing-affectation-scope.js';
export const CAUSE_LABELS={NC_AL:'Aluminio',NC_V:'Vidrio',TECNO:'Tecno',NOVEDAD:'Novedades'};
const valid=n=>Number.isSafeInteger(n)&&n>=0;
/** Recorded windows by cause; never derive windows from PDT pieces or sum the union. */
export function affectationSummary(data){
 data=packingNativeEvidence(data);
 const seen=new Set(),categories=Object.fromEntries(Object.keys(CAUSE_LABELS).map(k=>[k,null]));
 for(const r of data.reports||[]){
  if(!r.id||seen.has(r.id)||r.originStage!==data.stage||!Object.hasOwn(categories,r.cause)||!valid(r.quantity)||!valid(r.confirmed)||r.confirmed>r.quantity)throw Error('RESUMEN_AFECTACIONES_INVALIDO');
  seen.add(r.id);categories[r.cause]=(categories[r.cause]??0)+r.quantity-r.confirmed;
  if(!valid(categories[r.cause]))throw Error('RESUMEN_AFECTACIONES_INVALIDO');
 }
 const pending=data.aluminumPending??data.pickingPending;
 const sources=new Set((data.reports||[]).flatMap(r=>(r.sources||[]).map(s=>s.id)));
 const active=(pending?.status==='AVAILABLE'?pending.rows:[]).filter(p=>p.state==='PENDIENTE');
 const aluminumUnlinked=active.some(p=>!sources.has(p.id));
 const reportedSources=new Set((data.reports||[]).filter(r=>r.cause==='NC_AL'&&r.quantity>r.confirmed).flatMap(r=>(r.sources||[]).map(source=>source.id)));
 const aluminumNeedsIndicator=active.some(p=>!reportedSources.has(p.id));
 const aluminumCoverage=data.aluminumPending?.status==='AVAILABLE'?'COMPLETE':pending?.status==='AVAILABLE'?'PARTIAL':'UNAVAILABLE';
 const aluminumUnknown=aluminumCoverage!=='COMPLETE'||aluminumUnlinked;
 const c=data.consolidated;
 const validated=c&&valid(c.quantity)&&valid(c.balance)&&c.quantity<=c.balance&&c.revision===data.revision&&valid(data.available)&&data.available===c.balance-c.quantity;
 return {categories,aluminumUnknown,aluminumUnlinked,aluminumNeedsIndicator,aluminumCoverage,hasReports:(data.reports||[]).length>0,balance:validated?c.balance:null,total:validated&&!aluminumUnknown?c.quantity:null,available:validated&&!aluminumUnknown?data.available:null,accessories:null};
}
