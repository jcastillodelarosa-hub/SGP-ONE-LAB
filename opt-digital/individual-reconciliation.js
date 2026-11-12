// Documentary coverage only. Never allocate repeated source units by array order.
import {inchesToThirtySeconds} from '../src/domain/opt-summary-reconciliation.js';
const norm=v=>String(v??'').replace(/\s+/g,'');
const length=v=>{try{return inchesToThirtySeconds(v);}catch{return null;}};
export function documentProduction(reference) {
  const text=String(reference??'');const first=text.match(/^\s*(\d+)\s*-\s*\S/);
  const ids=[...new Set([...text.matchAll(/\b(\d{5,})\s*-\s*\S/g)].map(m=>m[1]))];
  return first && ids.length===1 && first[1]===ids[0] ? first[1] : null;
}
export function reconcileIndividuals({plans=[],projectRows=[],profileSummaries=[]}) {
  const source=projectRows.map((r,i)=>({...r,sourceId:r.sourceId||null,index:i,length32:length(r.length),production:documentProduction(r.reference)}));
  const entries=[],bars=[],unresolved=[];
  for(const p of plans){
    const perBar=new Map();
    for(const [index,c] of p.cuts.entries()){
      const cutId=JSON.stringify([p.id,c.profileInstance,c.sourceColumn,c.sourceSlot,c.unitInstance]);
      const production=documentProduction(c.project),cutLength=length(c.length);
      const candidates=source.filter(r=>(!r.grouping||r.grouping==='PRINTED_CELL')&&r.ref===p.ref&&r.finish===p.finish&&r.length32!==null&&r.length32===cutLength&&r.production===production&&production!==null);
      const exact=candidates.filter(r=>norm(r.reference)===norm(c.project));
      const entry={cutId,patternId:p.id,index,profile:p.ref,finish:p.finish,length32:cutLength,documentProduction:production,
        productionStatus:production&&candidates.length?'DOCUMENT_ID_MATCH':'UNRESOLVED',sgpProductionId:null,
        candidateSourceRows:exact.map(r=>r.sourceId),sourceRowId:null,status:'UNRESOLVED_REFERENCE',reason:!production?'MISSING_OR_AMBIGUOUS_DOCUMENT_PRODUCTION':!candidates.length?'NO_SAME_PRODUCTION_LENGTH_ROW':'REFERENCE_GROUP_DIFFERS'};
      if(exact.length===1&&exact[0].sourceId){entry.sourceRowId=exact[0].sourceId;entry.status='CANDIDATE_ROW';}
      else if(exact.length>1){entry.reason='MULTIPLE_SOURCE_ROWS';}
      if(c.uncertain||(p.issues||[]).length){entry.productionStatus='UNRESOLVED';entry.status='UNRESOLVED_REFERENCE';entry.sourceRowId=null;entry.reason='INCOMPLETE_EXTRACTION';}
      entries.push(entry);
      const barNumber=c.profileInstance;
      if(!Number.isSafeInteger(barNumber)||barNumber<1||barNumber>p.barqty||!Number.isSafeInteger(c.sourceColumn)||!Number.isSafeInteger(c.sourceSlot)||!Number.isSafeInteger(c.unitInstance)){
        unresolved.push({cutId,reason:'MISSING_BAR_OR_CELL_PROVENANCE'});continue;
      }
      if(!perBar.has(barNumber))perBar.set(barNumber,[]);perBar.get(barNumber).push({cutId,length32:cutLength,uncertain:c.uncertain});
    }
    for(let n=1;n<=p.barqty;n++){
      const cuts=perBar.get(n)||[],ids=cuts.map(c=>c.cutId),stock=length(p.length),rest=length(p.rest),cutSum=cuts.every(c=>c.length32!==null)?cuts.reduce((v,c)=>v+c.length32,0):null;
      const residual=stock!==null&&rest!==null&&cutSum!==null?stock-rest-cutSum:null;
      const kerf=length(p.sourceSettings?.kerf),leftTrim=length(p.sourceSettings?.leftTrim),rightTrim=length(p.sourceSettings?.rightTrim);
      const arithmeticModels=kerf!==null&&leftTrim!==null&&rightTrim!==null&&residual!==null?[0,1,2].map(extra=>({extraPasses:extra,expectedLoss32:leftTrim+rightTrim+kerf*(cuts.length+extra),delta32:residual-leftTrim-rightTrim-kerf*(cuts.length+extra)})):[];
      const geometry=cuts.length&&new Set(ids).size===ids.length&&!cuts.some(c=>c.uncertain)&&(p.issues||[]).length===0;
      bars.push({barId:JSON.stringify([p.id,n]),patternId:p.id,profile:p.ref,instance:n,sourcePage:p.page,
        cuts:ids,settingsSourcePages:{kerf:p.sourceSettings?.kerfPage,leftTrim:p.sourceSettings?.leftTrimPage,rightTrim:p.sourceSettings?.rightTrimPage},printedMinimumReusable32:length(p.sourceSettings?.minimumReusable),printedDisposition:p.restDisposition||null,printedKerf32:kerf,printedLeftTrim32:leftTrim,printedRightTrim32:rightTrim,arithmeticModels,modelIsCertified:false,stockLength32:stock,cutLength32:cutSum,printedRemainder32:rest,unexplainedLength32:residual,
        distributionStatus:geometry?'PDF_PATTERN_REPETITION':'UNRESOLVED',physicalBarIdentity:null,
        remainderStatus:!geometry||residual===null?'UNRESOLVED':residual<0?'INCONSISTENT':residual===0?'ARITHMETIC_EQUALITY':'KERF_OR_ALLOWANCE_UNVERIFIED',certified:false});
    }
  }
  const assigned=new Map();for(const e of entries)if(e.status==='CANDIDATE_ROW'){if(!assigned.has(e.sourceRowId))assigned.set(e.sourceRowId,[]);assigned.get(e.sourceRowId).push(e);}
  for(const [id,group] of assigned){
    const rows=source.filter(r=>r.sourceId===id),qty=rows.length===1?rows[0].quantity:null;
    for(const e of group){
      if(!Number.isSafeInteger(qty)||qty!==group.length){e.status='UNRESOLVED_QUANTITY';e.sourceRowId=null;e.reason='SOURCE_QUANTITY_DIFFERS';}
      else if(qty===1){e.status='UNIQUE_DOCUMENT_ROW';e.reason=null;}
      else {e.status='ROW_GROUP_MATCH';e.reason='REPEATED_UNITS_NOT_INDIVIDUALLY_IDENTIFIED';}
    }
  }
  const idCounts=new Map();for(const e of entries)idCounts.set(e.cutId,(idCounts.get(e.cutId)||0)+1);for(const e of entries){if(idCounts.get(e.cutId)>1){e.status='UNRESOLVED_REFERENCE';e.sourceRowId=null;e.reason='DUPLICATE_CUT_PROVENANCE';}}
  const validAssigned=new Map();for(const e of entries)if(['UNIQUE_DOCUMENT_ROW','ROW_GROUP_MATCH'].includes(e.status))validAssigned.set(e.sourceRowId,(validAssigned.get(e.sourceRowId)||0)+1);
  const sourceCoverage=source.map(r=>({sourceId:r.sourceId,profile:r.ref,quantity:r.quantity,matchedOccurrences:validAssigned.get(r.sourceId)||0,
    status:validAssigned.get(r.sourceId)===r.quantity?'ROW_QUANTITY_MATCH':'UNRESOLVED'}));
  const profileBalances=profileSummaries.map(summary=>{
    const selected=plans.filter(p=>p.ref===summary.ref&&p.finish===summary.finish),ownBars=bars.filter(b=>selected.some(p=>p.id===b.patternId));
    const sum=key=>ownBars.length&&ownBars.every(b=>b[key]!==null)?ownBars.reduce((v,b)=>v+b[key],0):null;
    const stock32=length(summary.stockLength),cut32=length(summary.cutLength),reused32=length(summary.reusedLength),waste32=length(summary.wasteLength);
    const complete=[stock32,cut32,reused32,waste32].every(v=>v!==null);
    const thresholdComplete=ownBars.length&&ownBars.every(b=>b.printedMinimumReusable32!==null&&b.printedRemainder32!==null);
    const thresholdReuse32=thresholdComplete?ownBars.reduce((v,b)=>v+(b.printedRemainder32>=b.printedMinimumReusable32?b.printedRemainder32:0),0):null;
    return {...summary,stock32,cut32,reused32,waste32,summaryBalanceDelta32:complete?stock32-cut32-reused32-waste32:null,
      patternStockDelta32:sum('stockLength32')!==null&&stock32!==null?sum('stockLength32')-stock32:null,
      patternCutsDelta32:sum('cutLength32')!==null&&cut32!==null?sum('cutLength32')-cut32:null,
      thresholdReuse32,thresholdReuseDelta32:thresholdReuse32!==null&&reused32!==null?thresholdReuse32-reused32:null,
      hypothesis:'Remainder >= printed minimum reusable length; no inventory identity or reuse certification',certified:false};
  });
  return {schema:'sgp.opt.individual-coverage.v1',status:'PROVISIONAL',productionEnabled:false,
    totals:{cuts:entries.length,bars:bars.length,documentProductionMatched:entries.filter(e=>e.productionStatus==='DOCUMENT_ID_MATCH').length,
      uniqueDocumentRows:entries.filter(e=>e.status==='UNIQUE_DOCUMENT_ROW').length,rowGroupMatched:entries.filter(e=>e.status==='ROW_GROUP_MATCH').length,
      unresolvedReferenceOrQuantity:entries.filter(e=>!['UNIQUE_DOCUMENT_ROW','ROW_GROUP_MATCH'].includes(e.status)).length,
      individualUnitUnresolved:entries.filter(e=>e.status!=='UNIQUE_DOCUMENT_ROW').length,sgpPieceLinked:0,sgpProductionLinked:0,physicalBarIdentified:0,patternBarsRepresented:bars.filter(b=>b.distributionStatus==='PDF_PATTERN_REPETITION').length,
      barsWithPrintedCutSettings:bars.filter(b=>b.arithmeticModels.length>0).length,
      barsMatchingAnUncertifiedModel:bars.filter(b=>b.arithmeticModels.some(m=>m.delta32===0)).length,
      remainderArithmeticEqual:bars.filter(b=>b.remainderStatus==='ARITHMETIC_EQUALITY').length,
      remainderUnverified:bars.filter(b=>b.remainderStatus==='KERF_OR_ALLOWANCE_UNVERIFIED').length,
      remainderInconsistent:bars.filter(b=>b.remainderStatus==='INCONSISTENT').length,
      remainderUnresolved:bars.filter(b=>b.remainderStatus==='UNRESOLVED').length},cuts:entries,bars,sourceCoverage,profileBalances,unresolved};
}
