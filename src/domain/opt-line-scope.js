// Documentary candidates only. No unit ownership, quantities or write authorization.
export const OPT_SCOPE_STATUS = Object.freeze({ IN_SCOPE:'IN_SCOPE', MIXED:'MIXED', OUT_OF_SCOPE:'OUT_OF_SCOPE', UNRESOLVED_SCOPE:'UNRESOLVED_SCOPE', UNASSOCIATED:'UNASSOCIATED', AMBIGUOUS:'AMBIGUOUS', UNAVAILABLE:'UNAVAILABLE' });
const value = v => v == null ? '' : String(v).trim();
const hash = v => /^[a-f0-9]{64}$/i.test(value(v)) ? value(v).toLowerCase() : null;
const pair = (a,b) => JSON.stringify([a,b]);
export function normalizeOptScopeContext(context = {}) {
  const line = value(context.linea ?? context.line), year = Number(context.anio ?? context.year), week = Number(context.semana ?? context.week);
  if (!line || !Number.isSafeInteger(year) || year < 1900 || year > 9999 || !Number.isSafeInteger(week) || week < 1 || week > 53 || ((context.modo ?? context.mode) && (context.modo ?? context.mode) !== 'BASE')) throw new Error('OPT_AMBITO_INVALIDO');
  return {linea:line,anio:year,semana:week,modo:'BASE'};
}
export function optScopeContextKey(context) { const c=normalizeOptScopeContext(context); return JSON.stringify([c.linea,c.anio,c.semana,c.modo]); }

// Inputs are the verified read RPC responses. The yearless shared source is
// intersected with exact production keys, never reserve/name matches.
export function buildOptProgrammingSnapshot({context,productions,shared,revision=null,loadedAt=null}) {
  const c=normalizeOptScopeContext(context);
  if (!Array.isArray(productions) || !Array.isArray(shared)) throw new Error('OPT_PROGRAMACION_CONTRATO_INVALIDO');
  const selected=productions.filter(p=>p?.id_linea===c.linea);
  const relations=[]; const keys=new Map();
  for (const p of selected) {
    if (!value(p.key_produccion) || !value(p.sistema) || (p.anio != null && Number(p.anio)!==c.anio) || (p.semana_base != null && Number(p.semana_base)!==c.semana) || keys.has(value(p.key_produccion))) throw new Error('OPT_PROGRAMACION_CONTRATO_INVALIDO');
    keys.set(value(p.key_produccion),p);
  }
  const add=(p,r,source)=>{
    if (!value(r?.reserva)) throw new Error('OPT_PROGRAMACION_CONTRATO_INVALIDO');
    relations.push({key_produccion:value(p.key_produccion),reservation:value(r.reserva),system:value(p.sistema),type:r.tipo==='PRINCIPAL'?'PRINCIPAL':'ASOCIADA',source,raw:r});
  };
  for (const p of selected) {
    if(value(p.reserva_principal)) add(p,{reserva:p.reserva_principal,tipo:'PRINCIPAL'},'BASE_PRINCIPAL');
    if(p.reservas_compartidas != null && !Array.isArray(p.reservas_compartidas)) throw new Error('OPT_PROGRAMACION_CONTRATO_INVALIDO');
    for(const r of p.reservas_compartidas || []) add(p,r,'BASE_COMPARTIDAS');
  }
  const ignoredShared=[];
  for(const row of shared) {
    const p=keys.get(value(row?.key_produccion));
    if(!p){ ignoredShared.push(row); continue; }
    if ((row.id_linea != null && row.id_linea!==c.linea) || !Array.isArray(row.reservas)) throw new Error('OPT_PROGRAMACION_CONTRATO_INVALIDO');
    for(const r of row.reservas) add(p,r,'ASOCIADAS_RPC');
  }
  // A production with no reservation evidence cannot establish complete scope.
  if(selected.some(p=>!relations.some(r=>r.key_produccion===value(p.key_produccion)))) throw new Error('OPT_PROGRAMACION_CONTRATO_INVALIDO');
  // The approved scope is the original programming week (BASE), independent
  // of execution dates and semana_actual. These reads still do not bind PDF units.
  // A missing documentary match stays unresolved, rather than inventing its owner.
  return {status:'READY',scope:c,context:c,revision,loadedAt,productions:selected,relations,ignoredShared,coverage:{sourceMode:'BASE',weekCriterion:'ORIGINAL_WEEK',operationalComplete:true,reason:'ORIGINAL_WEEK_CONFIRMED'},carryStatus:'KEEP_ORIGINAL_WEEK',canRegister:false};
}
function aggregate(rows) {
  if(!rows.length) return 'UNASSOCIATED';
  const states=new Set(rows.map(r=>r.status));
  if(states.has('UNAVAILABLE')) return 'UNAVAILABLE';
  if(states.has('AMBIGUOUS')) return 'AMBIGUOUS';
  if(states.size===1) return rows[0].status;
  if(states.has('IN_SCOPE')) return 'MIXED';
  return 'UNASSOCIATED';
}
/** entries: every original index row, including blanks. documents: each uploaded
 * file {sha256,sourceKey,origin,opt,...}; sha256 must come from actual PDF bytes.
 * sourceKey identifies a source batch, not a filename or consecutive. Missing
 * sourceKey never joins rows/files by name. Same SHA merges bytes, not provenance.
 * Rows may carry explicit key_produccion to disambiguate documentary candidates.
 */
export function classifyOptLineScope({snapshot,entries=[],documents=[]}={}) {
  if(!Array.isArray(entries)||!Array.isArray(documents)) throw new TypeError('OPT_FILAS_INVALIDAS');
  const ready=snapshot?.status==='READY';
  const index=new Map();
  for(const r of ready ? snapshot.relations : []) {
    const k=pair(r.reservation,r.system); if(!index.has(k))index.set(k,new Map());
    index.get(k).set(r.key_produccion,r);
  }
  const associations=entries.map((entry,rowIndex)=>{
    const reservation=value(entry.reservation),system=value(entry.system);
    let candidates=[...(index.get(pair(reservation,system))?.values() || [])];
    const contradictoryKey=Boolean(value(entry.key_produccion)&&candidates.length&&!candidates.some(r=>r.key_produccion===value(entry.key_produccion)));
    if(value(entry.key_produccion)) candidates=candidates.filter(r=>r.key_produccion===value(entry.key_produccion));
    let status=!ready?'UNAVAILABLE':!reservation||!system?'UNASSOCIATED':contradictoryKey?'AMBIGUOUS':candidates.length?'IN_SCOPE':'UNRESOLVED_SCOPE';
    return {rowIndex,entry,reservation,system,status,candidates,unitBindingRequired:true,canRegister:false};
  });
  const sourceId=x=>value(x.sourceKey)&&value(x.origin)&&value(x.opt)?JSON.stringify([x.sourceKey,x.origin,x.opt]):null;
  const sourceVersions=new Map();
  for(const document of documents) {
    const id=sourceId(document),sha=hash(document.sha256);
    if(id&&sha){if(!sourceVersions.has(id))sourceVersions.set(id,new Set());sourceVersions.get(id).add(sha);}
  }
  const documentGroups=new Map();
  documents.forEach((document,i)=>{
    const sha=hash(document.sha256), key=sha || `unverified:${i}`;
    if(!documentGroups.has(key))documentGroups.set(key,{id:key,sha256:sha,files:[],sources:[],associations:[],canRegister:false});
    const group=documentGroups.get(key);group.files.push(document);group.sources.push({sourceKey:document.sourceKey??null,origin:document.origin??null,opt:document.opt??null});
    const id=sourceId(document);
    const linked=associations.filter(a=>hash(a.entry.sha256)?hash(a.entry.sha256)===sha:(id&&sourceId(a.entry)===id));
    for(const a of linked)if(!group.associations.includes(a))group.associations.push(a);
  });
  const result=[...documentGroups.values()].map(d=>({...d,status:!ready||!d.sha256?'UNAVAILABLE':d.files.some(f=>(sourceVersions.get(sourceId(f))?.size || 0)>1)?'AMBIGUOUS':aggregate(d.associations),pdfStatus:d.sha256?'AVAILABLE':'UNVERIFIED_BYTES'}));
  // Keep index-only documents visible; no deduplication across sources.
  const missing=new Map();
  for(const a of associations) {
    if(result.some(d=>d.associations.includes(a)))continue;
    const key=sourceId(a.entry)||`row:${a.rowIndex}`;
    if(!missing.has(key))missing.set(key,{id:`missing:${key}`,sha256:null,files:[],sources:[{sourceKey:a.entry.sourceKey??null,origin:a.entry.origin??null,opt:a.entry.opt??null}],associations:[],status:'UNAVAILABLE',pdfStatus:'MISSING',canRegister:false});
    missing.get(key).associations.push(a);
  }
  const groups=new Map();
  for(const a of associations.filter(a=>a.status==='IN_SCOPE')) {
    const k=JSON.stringify([a.reservation,a.system,a.entry.origin??null]);
    if(!groups.has(k))groups.set(k,{reservation:a.reservation,system:a.system,origin:a.entry.origin??null,opts:[],associations:[],candidates:[],canRegister:false});
    const g=groups.get(k);g.associations.push(a);
    if(value(a.entry.opt)&&!g.opts.includes(value(a.entry.opt)))g.opts.push(value(a.entry.opt));
    for(const candidate of a.candidates)if(!g.candidates.some(c=>c.key_produccion===candidate.key_produccion))g.candidates.push(candidate);
  }
  return {scope:snapshot?.scope??null,context:snapshot?.context??null,status:ready?'READY':'UNAVAILABLE',coverage:snapshot?.coverage??null,associations,groups:[...groups.values()],documents:[...result,...missing.values()],carryStatus:ready?'KEEP_ORIGINAL_WEEK':'UNAVAILABLE',canRegister:false};
}
