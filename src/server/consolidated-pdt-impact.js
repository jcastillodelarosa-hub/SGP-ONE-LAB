/** Isolated SERVER contract. Inputs must come from persisted/certified readers,
 * not request JSON. Global counts, no fabricated physical identities. */
export function evaluateConsolidatedImpact(impact,{production,assembled,packed}){
 const qty=n=>Number.isSafeInteger(n)&&n>=0;
 const missing=reason=>({status:'UNKNOWN',available:null,reason});
 if(!impact||impact.production!==production||impact.stage!=='ENSAMBLE'||impact.state!=='VALIDACION_VIGENTE'||!impact.sourceRef||!impact.sourceRevision||!impact.validationId)return missing('CONSOLIDATED_VALIDATION_REQUIRED');
 const n=impact.validated,p=impact.productionUnits;
 if(!qty(n)||!qty(p)||n>p||assembled>p)return missing('CONSOLIDATED_COUNTS_DISAGREE');
 let deduction;
 if(impact.assemblyBasis==='GROSS_REQUIRES_DEDUCTION')deduction=n;
 else if(impact.assemblyBasis==='NET_EXCLUDES_BLOCKED'){
  if(assembled>p-n)return missing('ASSEMBLY_EXCEEDS_UNBLOCKED_PRODUCTION');
  deduction=0;
 }else return missing('ASSEMBLY_ACCOUNTING_UNKNOWN');
 if(assembled-packed-deduction<0)return missing('PACKING_WITHOUT_QUANTITATIVE_BACKING');
 return {status:'READY',available:assembled-packed-deduction,blocked:n,deduction,assemblyCeiling:impact.assemblyBasis==='NET_EXCLUDES_BLOCKED'?p-n:p,eligibleAssembled:assembled-deduction};
}
