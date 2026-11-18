// Retail V4 eligibility uses reservation only. Proyecto retains its V2 pair contract.
// Explicit origin avoids broadening legacy callers when another source is introduced.
export function programmedEntryMatcher(relations, origin) {
 const norm=value=>String(value??'').trim();
 const reservations=new Set(relations.map(r=>norm(r.reservation)).filter(Boolean));
 const pairs=new Set(relations.filter(r=>norm(r.reservation)&&norm(r.system)).map(r=>JSON.stringify([norm(r.reservation),norm(r.system)])));
 return entry=>{
  const reservation=norm(entry.reservation),system=norm(entry.system);
  if(!reservation)return false;
  if(origin==='RETAIL')return reservations.has(reservation);
  if(origin==='PROYECTO')return Boolean(system)&&pairs.has(JSON.stringify([reservation,system]));
  return false;
 };
}
// Metadata-only preflight. A candidate is not an authorized import or cut.
export function selectProgrammedFiles({files,origin,scope,snapshot,entries,indexReady,pending}){
 const rows=files.filter(f=>/\.pdf$/i.test(f.name));
 const unavailable=!['RETAIL','PROYECTO'].includes(origin)||!indexReady||scope?.linea!=='PANELES_2'||scope?.modo!=='BASE'||snapshot?.status!=='READY'||!Array.isArray(snapshot.relations)||!['linea','anio','semana','modo'].every(k=>scope[k]===snapshot.scope?.[k])||!Array.isArray(pending);
 if(unavailable)return {selected:[],decisions:rows.map(file=>({name:file.name,reason:'CONTEXT_REQUIRED'}))};
 const matchesReservation=programmedEntryMatcher(snapshot.relations,origin);
 const byOpt=new Map(),nameCounts=new Map(),selected=[],decisions=[];
 for(const e of entries)if(e.origin===origin){if(!byOpt.has(e.opt))byOpt.set(e.opt,[]);byOpt.get(e.opt).push(e);}
 for(const f of rows){const name=f.name.replace(/\.pdf$/i,'');nameCounts.set(name,(nameCounts.get(name)||0)+1);}
 for(const file of rows){
  const opt=file.name.replace(/\.pdf$/i,''),matches=byOpt.get(opt)||[];
  const evidence=matches.filter(matchesReservation);
  const uncertain=pending.some(p=>p.pdf?.name===file.name||p.source?.opt===opt);
  const reason=uncertain?'PENDING_OUTCOME':!matches.length?'EXACT_NAME_MISSING':!evidence.length?'OUTSIDE_PROGRAMMING':nameCounts.get(opt)!==1?'DUPLICATE_NAME':'CANDIDATE';
  decisions.push({name:file.name,reason,indexRows:evidence.map(e=>({row:e.sourceRow,reservation:e.reservation,system:e.system}))});
  if(reason==='CANDIDATE')selected.push(file);
 }
 return {selected,decisions};
}
