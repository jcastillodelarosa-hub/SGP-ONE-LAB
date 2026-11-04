/** Read-only preview. A manifest must eventually come from an accredited server source.
 * This planner neither creates evidence nor changes the budget/SALE/official Export. */
export function prepareExportReconciliation({key,stage,cut,events,manifest}){
 const pending=reason=>({status:'PENDIENTE_EVIDENCIA',reason,apply:false});
 if(!key||!['ENSAMBLE','EMPAQUE'].includes(stage)||cut?.key!==key||cut.stage!==stage||!cut.id||!cut.hash||!Number.isSafeInteger(cut.balance)||cut.balance<0)return pending('official_cut_identity');
 if(!manifest||manifest.key!==key||manifest.stage!==stage||manifest.cut!==cut.id||manifest.hash!==cut.hash||manifest.complete!==true||!manifest.sourceRef||!Array.isArray(manifest.events))return pending('accredited_inclusion_manifest');
 if(!Array.isArray(events)||events.length===0)return pending('complete_local_event_chain');
 const declared=new Map();for(const x of manifest.events){if(!x||typeof x!=='object'||!x.id||!Number.isSafeInteger(x.revision)||typeof x.included!=='boolean'||declared.has(x.id))return pending('ambiguous_manifest');declared.set(x.id,x);}
 if(declared.size!==events.length)return pending('manifest_coverage');
 const seen=new Set(),roots=new Map();let local=0;
 for(const e of events){
  if(!e||typeof e!=='object')return pending('event_identity_revision_or_chain');
  const m=declared.get(e.id),prior=roots.get(e.root)??{after:0,revision:-1,excluded:false};
  if(!e.id||!e.root||seen.has(e.id)||e.key!==key||e.stage!==stage||!Number.isSafeInteger(e.revision)||e.revision<=prior.revision||!Number.isSafeInteger(e.before)||!Number.isSafeInteger(e.after)||e.before<0||e.after<0||e.before!==prior.after||!m||m.root!==e.root||m.revision!==e.revision)return pending('event_identity_revision_or_chain');
  if(m.included&&prior.excluded)return pending('non_prefix_inclusion');
  if(!m.included)local+=e.after-e.before;
  seen.add(e.id);roots.set(e.root,{after:e.after,revision:e.revision,excluded:prior.excluded||!m.included});
 }
 if(local<0||cut.balance-local<0)return pending('correction_requires_reconciliation');
 return {status:'PROPUESTA_CONCILIACION',apply:false,key,stage,cut:cut.id,officialBalance:cut.balance,unincludedDelta:local,proposedAvailable:cut.balance-local,eventCount:seen.size,source:manifest.sourceRef};
}
