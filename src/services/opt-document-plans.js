// A documentary cut identity is never a registration capability.
export function createOptDocumentPlans(client,getToken,{catalog,documentApi=null,timeoutMs=25000}={}) {
 let epoch=0;
 const invalidate=()=>{epoch++;};
 async function load(group,reference){
  const documentary=!!reference.documentReference;
  const owned=()=>documentary?documentApi?.ownsReference(group,reference.documentReference)&&['id_documento','sha256','referencia','sistema'].every(k=>reference[k]===reference.documentReference[k]):catalog?.ownsGroup(group)&&group.references.some(r=>r.id_documento===reference.id_documento&&r.sha256===reference.sha256&&r.referencia===reference.referencia&&r.sistema===reference.sistema);
  if(!owned())throw Error('OPT_ESQUEMA_GRUPO_INVALIDO');
  const token=getToken(),operation=++epoch;if(!token)throw Error('OPT_SESION_REQUERIDA');let timer;
  const response=await Promise.race([client.rpc(documentary?'sgp_opt_esquema_documental_v2':'sgp_opt_esquema_documental_v1',{p_token:token,p_scope:group.scope,p_reserva:group.reservation,p_sistema:group.system,p_id_documento:reference.id_documento,p_referencia:reference.referencia}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('OPT_ESQUEMA_TIMEOUT')),timeoutMs);})]).finally(()=>clearTimeout(timer));
  if(epoch!==operation||getToken()!==token||!owned())throw Error('OPT_ESQUEMA_OBSOLETO');
  if(response?.error)throw Error('OPT_ESQUEMA_NO_DISPONIBLE');
  const data=structuredClone(response?.data),invalid=()=>{throw Error('OPT_ESQUEMA_CONTRATO_INVALIDO');};
  if(data?.contract!==(documentary?'OPT-DOCUMENT-PLANS-2':'OPT-DOCUMENT-PLANS-1')||data.reservation!==group.reservation||data.system!==group.system||data.id_documento!==reference.id_documento||data.sha256!==reference.sha256||data.reference!==reference.referencia||!['linea','anio','semana','modo'].every(k=>data.scope?.[k]===group.scope[k])||!['AVAILABLE','NOT_PERSISTED'].includes(data.status)||!Array.isArray(data.plans)||data.plans.length>10000||(data.status==='NOT_PERSISTED'&&data.plans.length)||(data.status==='AVAILABLE'&&!data.plans.length))invalid();
  const text=v=>typeof v==='string'&&v.length<=4000&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v),positive=v=>Number.isSafeInteger(v)&&v>0,uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v),ids=new Set(),plans=new Set();
  for(const p of data.plans){if(!p||!text(p.id)||plans.has(p.id)||p.ref!==reference.referencia||!['finish','length'].every(k=>text(p[k]))||!positive(p.page)||!positive(p.barqty)||!Array.isArray(p.cuts)||!p.cuts.length||p.cuts.length>10000)invalid();plans.add(p.id);for(const c of p.cuts){if(!c||!text(c.length)||!text(c.project)||!positive(c.profileInstance)||c.profileInstance>p.barqty||typeof c.selectedReservation!=='boolean'||(c.selectedReservation?!uuid(c.id_pieza):c.id_pieza!==null||c.project!==''))invalid();if(c.id_pieza){if(ids.has(c.id_pieza))invalid();ids.add(c.id_pieza);}}}
  return data;
 }
 return {load,invalidate};
}
