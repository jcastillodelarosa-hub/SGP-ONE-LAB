// Private server preparation. Documentary identity never grants cut permissions.
import {documentProduction} from '../../opt-digital/individual-reconciliation.js';
const text=x=>typeof x==='string'&&x.length>0&&x.length<=255&&x===x.trim()&&!/[\u0000-\u001f\u007f]/.test(x);
const norm=x=>x.replace(/\s+/g,' ').trim();
const key=x=>JSON.stringify([x.documentProduction,x.produccion,x.reserva,x.sistema]);
const fail=code=>{throw Object.assign(Error(code),{code,status:422});};
export function retailSelectors(entries,rows){
 if(!entries.length||entries.length>20000)fail('OPT_RETAIL_INDEX_INVALID');
 const selectors=new Map();
 for(const entry of entries){
  const label=entry.project;
  const id=documentProduction(label);
  if(!text(label)||!id||!/^[0-9]{1,30}$/.test(entry.reservation)||!text(entry.system)||!text(entry.finish))fail('OPT_RETAIL_SELECTOR_INVALID');
  const selector={documentProduction:id,produccion:label,reserva:entry.reservation,sistema:entry.system};
  selectors.set(key(selector),selector);
 }
 if(selectors.size>1000)fail('OPT_RETAIL_SELECTOR_LIMIT');
 // Only whitespace introduced by PDF line wrapping is normalized here. SQL
 // compares the original full index label literally against the master.
 for(const row of rows){
  const id=documentProduction(row.reference),reference=norm(String(row.reference));
  const labels=[...new Set([...selectors.values()].filter(x=>x.documentProduction===id).map(x=>x.produccion))];
  if(labels.length!==1)fail('OPT_RETAIL_DOCUMENT_LABEL_AMBIGUOUS');
  const label=norm(labels[0]);
  if(reference!==label&&!reference.startsWith(label+' (Line '))fail('OPT_RETAIL_DOCUMENT_LABEL_MISMATCH');
 }
 return [...selectors.values()].sort((a,b)=>key(a).localeCompare(key(b)));
}
export function validateRetailContext(context,{scope,opt,selectors,references}){
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 if(context?.contract!=='OPT-IMPORT-CONTEXT-RETAIL-3'||context.opt!==opt||
 !same(context.scope,scope)&&!same(Object.entries(context.scope||{}).sort(),Object.entries(scope).sort())||
 !Array.isArray(context.selectores)||!same(context.selectores.map(key).sort(),selectors.map(key).sort())||
 !Array.isArray(context.referencias)||!same([...context.referencias].sort(),[...references].sort())||
 !/^[a-f0-9]{32}$/.test(context.revision)||!Array.isArray(context.bindings)||context.bindings.length>20000||
 !Array.isArray(context.profileDestinations))fail('OPT_RETAIL_CONTEXT_INVALID');
 for(const b of context.bindings){
  if(!b||!text(b.sgpProductionId)||!selectors.some(s=>s.documentProduction===b.documentProduction&&s.produccion===b.documentLabel&&s.reserva===b.reserva&&s.sistema===b.sistema))fail('OPT_RETAIL_CONTEXT_IDENTITY_INVALID');
 }
 return context;
}
