// Read-only discovery of imported manifests. This is identity evidence, never a write grant.
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const keys=(value,expected)=>object(value)&&Object.keys(value).sort().join()===expected.split(',').sort().join();
const text=value=>typeof value==='string'&&value.trim().length>0;
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const scopeValid=value=>keys(value,'linea,anio,semana,modo')&&value.linea==='PANELES_2'&&value.modo==='BASE'&&Number.isInteger(value.anio)&&value.anio>=2020&&value.anio<=2100&&Number.isInteger(value.semana)&&value.semana>=1&&value.semana<=53;
const sameScope=(a,b)=>scopeValid(a)&&scopeValid(b)&&['linea','anio','semana','modo'].every(key=>a[key]===b[key]);
const invalid=()=>{throw Error('OPT_CATALOGO_CONTRATO_INVALIDO');};
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const sourcesKey=sources=>JSON.stringify(sources.map(s=>[s.origen,s.source_key,s.consecutivo,s.modo_carga]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
const piecesKey=pieces=>JSON.stringify(pieces.map(p=>[p.id_pieza.toLowerCase(),p.pagina,p.patron,p.barra,p.corte,p.longitud_mm]).sort((a,b)=>a[0].localeCompare(b[0])));
function validate(data,scope){
 if(!keys(data,'contract_version,scope,grupos,totales')||data.contract_version!==2||!sameScope(data.scope,scope)||!Array.isArray(data.grupos)||!keys(data.totales,'grupos,documentos,piezas'))invalid();
 const groups=new Set(),pieces=new Set(),positions=new Set(),documents=new Map(),hashes=new Map(),sources=new Map();
 for(const group of data.grupos){
  if(!keys(group,'reserva,sistema,referencias')||!text(group.reserva)||!text(group.sistema)||!Array.isArray(group.referencias)||!group.referencias.length)invalid();
  const key=JSON.stringify([group.reserva,group.sistema]);if(groups.has(key))invalid();groups.add(key);const refs=new Set();
  for(const ref of group.referencias){
   if(!keys(ref,'id_documento,sha256,referencia,sistema,fuentes,piezas')||!uuid(ref.id_documento)||typeof ref.sha256!=='string'||!/^[a-f0-9]{64}$/.test(ref.sha256)||!text(ref.referencia)||ref.sistema!==group.sistema||!Array.isArray(ref.fuentes)||!ref.fuentes.length||!Array.isArray(ref.piezas)||!ref.piezas.length)invalid();
   const doc=ref.id_documento.toLowerCase(),refKey=JSON.stringify([doc,ref.referencia]);if(refs.has(refKey))invalid();refs.add(refKey);
   if(hashes.has(ref.sha256)&&hashes.get(ref.sha256)!==doc)invalid();hashes.set(ref.sha256,doc);const sourceIds=new Set();
   for(const source of ref.fuentes){
    if(!keys(source,'origen,source_key,consecutivo,modo_carga')||!['RETAIL','PROYECTO','DESCONOCIDO'].includes(source.origen)||!['INDICE','INDIVIDUAL'].includes(source.modo_carga)||!text(source.source_key)||!text(source.consecutivo))invalid();
    const id=JSON.stringify([source.origen,source.source_key]);if(sourceIds.has(id)||sources.has(id)&&sources.get(id)!==doc)invalid();sourceIds.add(id);sources.set(id,doc);
   }
   const meta=JSON.stringify([ref.sha256,sourcesKey(ref.fuentes)]);if(documents.has(doc)&&documents.get(doc)!==meta)invalid();documents.set(doc,meta);
   for(const piece of ref.piezas){
    if(!keys(piece,'id_pieza,pagina,patron,barra,corte,longitud_mm')||!uuid(piece.id_pieza)||!['pagina','patron','barra','corte'].every(k=>Number.isSafeInteger(piece[k])&&piece[k]>0)||typeof piece.longitud_mm!=='number'||!(piece.longitud_mm>0&&piece.longitud_mm<100000))invalid();
    const id=piece.id_pieza.toLowerCase(),position=JSON.stringify([doc,piece.pagina,piece.patron,piece.barra,piece.corte]);if(pieces.has(id)||positions.has(position))invalid();pieces.add(id);positions.add(position);
   }
  }
 }
 if(data.totales.grupos!==groups.size||data.totales.documentos!==documents.size||data.totales.piezas!==pieces.size)invalid();
}
export function createOptSharedCatalog(client,getToken,{getContext,timeoutMs=25000}={}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<=0||timeoutMs>2147483647)throw Error('OPT_ESPERA_INVALIDA');
 let generation=0,current=null;const snapshots=new WeakMap(),owners=new WeakMap();
 const contextMatches=scope=>{try{return !getContext||sameScope(getContext(),scope);}catch{return false;}};
 const invalidate=()=>{generation++;current=null;};
 const isCurrent=snapshot=>{
  if(current&&(snapshots.get(current)!==getToken()||!contextMatches(current.scope)))invalidate();
  return Boolean(snapshot&&snapshot===current);
 };
 const ownsGroup=group=>Boolean(object(group)&&isCurrent(current)&&owners.get(group)===current);
 const matchesReference=(group,ref)=>{
  if(!ownsGroup(group)||!object(ref)||ref.sistema!==group.system||!uuid(ref.id_documento)||!Array.isArray(ref.fuentes)||!Array.isArray(ref.piezas))return false;
  try{return group.references.some(known=>known.id_documento.toLowerCase()===ref.id_documento.toLowerCase()&&known.sha256===ref.sha256&&known.referencia===ref.referencia&&sourcesKey(known.fuentes)===sourcesKey(ref.fuentes)&&piecesKey(known.piezas)===piecesKey(ref.piezas));}catch{return false;}
 };
 async function load(scope){
  invalidate();const operation=generation;
  if(!scopeValid(scope))throw Error('OPT_SCOPE_INVALIDO');const requested={...scope},token=getToken();
  if(!token)throw Error('OPT_SESION_REQUERIDA');
  const assertCurrent=()=>{if(operation!==generation||getToken()!==token||!contextMatches(requested))throw Error('OPT_CATALOGO_OBSOLETO');};
  assertCurrent();let timer;
  const result=await Promise.race([Promise.resolve().then(()=>client.rpc('sgp_opt_catalogo_v2',{p_token:token,p_scope:requested})),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('OPT_CATALOGO_TIMEOUT')),timeoutMs);})]).finally(()=>clearTimeout(timer));
  assertCurrent();if(result?.error)throw Error(result.error.message||'OPT_CATALOGO_NO_DISPONIBLE');
  const data=structuredClone(result?.data);validate(data,requested);
  const snapshot={scope:requested,groups:data.grupos.map(g=>({key:JSON.stringify(['SERVIDOR',g.reserva,g.sistema]),origin:'SERVIDOR',reservation:g.reserva,system:g.sistema,scope:requested,canRegister:false,opts:[...new Set(g.referencias.flatMap(r=>r.fuentes.map(f=>f.consecutivo)))],documentHashes:[...new Set(g.referencias.map(r=>r.sha256))],references:g.referencias}))};
  freeze(snapshot);snapshots.set(snapshot,token);for(const group of snapshot.groups)owners.set(group,snapshot);current=snapshot;return snapshot;
 }
 return {load,invalidate,isCurrent,ownsGroup,matchesReference};
}
