// Trusted extraction only, after full documentary reconciliation. No operational totals.
export function buildOptDocumentSummary(extraction) {
 const string=v=>typeof v==='string'?v:null;
 return {contract:'OPT-DOCUMENT-SUMMARY-1',scope:'DOCUMENTO',
  cutRows:(extraction.sourceProfileSummaries||[]).map(r=>({reference:r.ref,finish:r.finish,
   bars:r.bars??null,pieces:r.pieces??null,plans:r.plans??null,scrapPrinted:r.wasteLength,sourcePage:r.page,
   scrapPercentagePrinted:r.scrapPercentagePrinted??null,countsPage:r.countsPage??null,countsSourceText:r.countsSourceText??null,
   cutLength:r.cutLength,stockLength:r.stockLength,reusedLength:r.reusedLength})),
  materialRows:(extraction.sourceMaterialRows||[]).map(r=>({reference:r.ref,finish:r.finish,length:r.length,
   quantity:r.quantity,location:string(r.location),code:string(r.code),observation:string(r.observation),sourcePage:r.page}))};
}
export function validOptDocumentSummary(value) {
 const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
 const text=v=>typeof v==='string'&&v.length<=2000&&!/[\u0000-\u001f\u007f]/.test(v);
 const page=v=>Number.isSafeInteger(v)&&v>0&&v<=500;
 return obj(value)&&value.contract==='OPT-DOCUMENT-SUMMARY-1'&&value.scope==='DOCUMENTO'&&
 ['cutRows','materialRows'].every(k=>Array.isArray(value[k])&&value[k].length<=10000)&&
 value.cutRows.every(r=>obj(r)&&['reference','finish','scrapPrinted','cutLength','stockLength','reusedLength'].every(k=>text(r[k]))&&page(r.sourcePage)&&['bars','pieces','plans'].every(k=>r[k]===null||Number.isSafeInteger(r[k])&&r[k]>=0)&&
 (r.countsPage===null||page(r.countsPage))&&(r.countsSourceText===null||text(r.countsSourceText))&&
 (r.scrapPercentagePrinted===null||typeof r.scrapPercentagePrinted==='string'&&/^\d+(?:[.,]\d+)?%$/.test(r.scrapPercentagePrinted))&&
 (['bars','pieces','plans','scrapPercentagePrinted'].every(k=>r[k]===null)||page(r.countsPage)&&text(r.countsSourceText)&&r.countsSourceText.length>0))&&
 value.materialRows.every(r=>obj(r)&&['reference','finish','length'].every(k=>text(r[k]))&&['location','code','observation'].every(k=>r[k]===null||text(r[k]))&&page(r.sourcePage)&&Number.isSafeInteger(r.quantity)&&r.quantity>0);
}
