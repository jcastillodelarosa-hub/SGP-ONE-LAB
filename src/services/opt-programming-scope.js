import {buildOptProgrammingSnapshot,normalizeOptScopeContext,optScopeContextKey} from '../domain/opt-line-scope.js';

/** Read-only original programming week (BASE) snapshot. UI must invalidate on filter/session changes and use
 * isCurrent before rendering a retained snapshot. getContext optionally checks
 * live filters even before a replacement request starts. Tokens never escape.
 */
export function createOptProgrammingScope(client,getToken,{getContext,now=()=>new Date().toISOString(),timeoutMs=25000}={}) {
  if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw new Error('OPT_ESPERA_INVALIDA');
  let generation=0, current=null;
  const owners=new WeakMap();
  const contextMatches=c=>{try{return !getContext || optScopeContextKey(getContext())===optScopeContextKey(c);}catch{return false;}};
  const invalidate=()=>{generation++;if(current)current.status='STALE';current=null;};
  const isCurrent=s=>Boolean(s && s===current && owners.get(s)===getToken() && contextMatches(s.context));
  async function load(context) {
    invalidate();const id=generation;
    const c=normalizeOptScopeContext(context),token=getToken();
    if(!token)throw new Error('OPT_SESION_REQUERIDA');
    const assertCurrent=()=>{if(id!==generation || token!==getToken() || !contextMatches(c))throw new Error('OPT_PROGRAMACION_OBSOLETA');};
    assertCurrent();
    let timer;
    const reads=Promise.all([
      client.rpc('sgp_consultar_programacion_semana',{p_token:token,p_anio:c.anio,p_semana:c.semana}),
      client.rpc('sgp_reservas_asociadas_listar',{p_token:token,p_semana:c.semana,p_linea:c.linea})
    ]);
    const [base,shared]=await Promise.race([reads,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('OPT_PROGRAMACION_TIMEOUT')),timeoutMs);})]).finally(()=>clearTimeout(timer));
    assertCurrent();
    if(base?.error || shared?.error)throw new Error('OPT_PROGRAMACION_NO_DISPONIBLE');
    if(!base?.data || !Array.isArray(base.data.producciones) || !Array.isArray(shared?.data))throw new Error('OPT_PROGRAMACION_CONTRATO_INVALIDO');
    const snapshot=buildOptProgrammingSnapshot({context:c,productions:base.data.producciones,shared:shared.data,revision:id,loadedAt:now()});
    owners.set(snapshot,token);current=snapshot;
    return snapshot;
  }
  return {load,invalidate,isCurrent};
}
