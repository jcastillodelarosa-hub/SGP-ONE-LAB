// Metadata-only preflight. A candidate is not an authorized import or cut.
export function selectProgrammedFiles({files,origin,scope,snapshot,entries,indexReady,pending}){
 const rows=files.filter(f=>/\.pdf$/i.test(f.name));
 const unavailable=!['RETAIL','PROYECTO'].includes(origin)||!indexReady||scope?.linea!=='PANELES_2'||scope?.modo!=='BASE'||snapshot?.status!=='READY'||!Array.isArray(snapshot.relations)||!['linea','anio','semana','modo'].every(k=>scope[k]===snapshot.scope?.[k])||!Array.isArray(pending);
 if(unavailable)return {selected:[],decisions:rows.map(file=>({name:file.name,reason:'CONTEXT_REQUIRED'}))};
 const pair=(r,s)=>JSON.stringify([String(r??'').trim(),String(s??'').trim()]);
 const pairs=new Set(snapshot.relations.filter(r=>r.reservation&&r.system).map(r=>pair(r.reservation,r.system)));
 const byOpt=new Map(),nameCounts=new Map(),selected=[],decisions=[];
 for(const e of entries)if(e.origin===origin){if(!byOpt.has(e.opt))byOpt.set(e.opt,[]);byOpt.get(e.opt).push(e);}
 for(const f of rows){const name=f.name.replace(/\.pdf$/i,'');nameCounts.set(name,(nameCounts.get(name)||0)+1);}
 for(const file of rows){
  const opt=file.name.replace(/\.pdf$/i,''),matches=byOpt.get(opt)||[];
  const evidence=matches.filter(e=>e.reservation&&e.system&&pairs.has(pair(e.reservation,e.system)));
  const uncertain=pending.some(p=>p.pdf?.name===file.name||p.source?.opt===opt);
  const reason=uncertain?'PENDING_OUTCOME':!matches.length?'EXACT_NAME_MISSING':!evidence.length?'OUTSIDE_PROGRAMMING':nameCounts.get(opt)!==1?'DUPLICATE_NAME':'CANDIDATE';
  decisions.push({name:file.name,reason,indexRows:evidence.map(e=>({row:e.sourceRow,reservation:e.reservation,system:e.system}))});
  if(reason==='CANDIDATE')selected.push(file);
 }
 return {selected,decisions};
}
