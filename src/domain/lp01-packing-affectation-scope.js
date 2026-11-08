/** Empaque only displays evidence explicitly recorded/linked to that process. */
export function packingSharedEvidence(snapshot){
 if(snapshot?.stage!=='EMPAQUE')return snapshot;
 const reports=(snapshot.reports||[]).filter(r=>r.origin_stage==='EMPAQUE'&&r.cause!=='TECNO');
 const ids=new Set(reports.map(r=>r.id));
 return {...snapshot,reports,legacyReports:(snapshot.legacyReports||[]).filter(r=>r.etapa==='EMPAQUE'&&r.causa!=='TECNO'),history:(snapshot.history||[]).filter(e=>ids.has(e.reportId)),accessories:[],displayStage:'EMPAQUE'};
}
export function packingNativeEvidence(snapshot){
 if(snapshot?.stage!=='EMPAQUE')return snapshot;
 const reports=(snapshot.reports||[]).filter(r=>r.originStage==='EMPAQUE'&&r.cause!=='TECNO'),ids=new Set(reports.map(r=>r.id));
 const linked=new Set(reports.flatMap(r=>(r.sources||[]).map(s=>s.id)));
 const pending=value=>value?{...value,rows:value.rows.filter(p=>p.origin==='EMPAQUE'||linked.has(p.id))}:value;
 return {...snapshot,...((snapshot.reports||[]).some(r=>r.cause==='TECNO')?{consolidated:null,available:null}:{}),reports,events:(snapshot.events||[]).filter(e=>e.stage==='EMPAQUE'||ids.has(e.reportId)),aluminumPending:pending(snapshot.aluminumPending),pickingPending:pending(snapshot.pickingPending)};
}
