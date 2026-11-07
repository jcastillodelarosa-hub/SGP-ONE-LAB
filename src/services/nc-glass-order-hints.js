import {ncTrackingMatches} from './nc-glass-tracking.js';

export const isActiveGlassNc=source=>source?.activo===true&&String(source.estado_nc??'').trim().toUpperCase()==='ABIERTA';
const allowed=role=>['COORDINADOR','ADMINISTRADOR'].includes(role);
const text=value=>String(value??'').trim();
const normalized=value=>text(value).normalize('NFC').replace(/\s+/g,' ').toLocaleUpperCase('es');
const lineIdentity=value=>normalized(value).replace(/[\s_]+/g,'_');
const matchIdentity=(production,system)=>JSON.stringify([normalized(production),normalized(system)]);
const empty=Object.freeze([]);
const snapshot=(status,reason,error)=>Object.freeze({status,reason,...(error?{error}:{} )});
const unavailable=reason=>snapshot('UNAVAILABLE',reason);
const denied=error=>['42501','PGRST301','PGRST302'].includes(String(error?.code))||[401,403].includes(Number(error?.status))||/NO[_ ]AUTORIZADO|ACCESO[_ ]DENEGADO|SESION[_ ]INVALIDA|TOKEN[_ ]INVALIDO|permission denied|jwt expired|unauthorized|forbidden/i.test(String(error?.message??error??''));

/**
 * Read-only hints for one Seguimiento list scope. No link, key or quantity is inferred.
 * read({force=false}) coalesces pending work and caches successes AND failures. A force
 * refresh replaces a completed read; it never duplicates an in-flight request.
 * state/status and candidatesFor() recheck the exact token, role and isCurrent().
 * clear() aborts/invalidate results and starts a fresh scope/session on the next read;
 * dispose() or the optional AbortSignal permanently closes this instance.
 *
 * candidatesFor(row, savedReferences=[]) returns {status,reason,count,candidates}.
 * count is null unless READY; a READY count of zero is a successful scope result.
 * savedReferences contains reference strings already recorded by the caller. Missing
 * saved references do not establish that a candidate is unlinked or may be assigned.
 * Each distinct consecutivo has {reference,source,sources,sameResponsibleLine}.
 * sources preserves matching source records, including their original estado_nc.
 * The RPC, not an invented status enum, defines the open-week source population.
 * Optional selectSource(source) may restrict that population only when the caller has
 * a verified active-NC rule. It is disabled by default: READY never means "active".
 * Responsible-line agreement is only evidence, never a link or an authorization.
 * This reader does not grant leaders access to global Seguimiento; a future operation
 * hint for leaders needs its own authorized scope, not a broader allowed-role list.
 */
export function ncGlassOrderHints({getToken,getRole,getClient,isCurrent=()=>true,signal,selectSource}={}){
 let version=0,access=null,controller=null,pending=null,loaded=false,disposed=false;
 let state=unavailable('NOT_LOADED'),index=new Map();

 function invalidate(next,{forgetAccess=false}={}){
  ++version;controller?.abort();controller=null;pending=null;loaded=false;index=new Map();state=next;
  if(forgetAccess)access=null;
  return state;
 }
 function contextFailure(){
  if(disposed||signal?.aborted)return unavailable('DISPOSED');
  if(!isCurrent())return unavailable('STALE_SCOPE');
  const token=getToken(),role=getRole();
  if(!token||!allowed(role))return snapshot('UNAUTHORIZED','ACCESS_DENIED');
  if(access&&token!==access.token)return snapshot('UNAUTHORIZED','SESSION_CHANGED');
  if(access&&role!==access.role)return snapshot('UNAUTHORIZED','ROLE_CHANGED');
  return null;
 }
 function currentState(){
  const failure=contextFailure();
  if(failure&&(state.status!==failure.status||state.reason!==failure.reason||pending||index.size))invalidate(failure);
  return state;
 }
 function operationFailure(request){
  // An old continuation must never read or overwrite a newer request's state.
  if(request!==version)return unavailable('CANCELLED');
  const failure=contextFailure();
  return failure?invalidate(failure):null;
 }
 function dispose(){
  disposed=true;signal?.removeEventListener('abort',dispose);invalidate(unavailable('DISPOSED'),{forgetAccess:true});
 }
 signal?.addEventListener('abort',dispose,{once:true});

 return {
  get state(){return currentState();},
  get status(){return currentState().status;},
  clear(){return invalidate(unavailable(disposed||signal?.aborted?'DISPOSED':'NOT_LOADED'),{forgetAccess:true});},
  dispose,
  read({force=false}={}){
   const failure=contextFailure();
   if(failure){currentState();return Promise.resolve(state);}
   if(pending)return pending;
   if(loaded&&!force)return Promise.resolve(state);
   invalidate(unavailable('LOADING'));
   access={token:getToken(),role:getRole()};
   const request=version,abort=new AbortController();controller=abort;
   pending=(async()=>{
    try{
     const client=await getClient();
     let stale=operationFailure(request);if(stale)return stale;
     let query=client.rpc('sgp_consultar_nc_vidrio',{p_token:access.token,p_semana:null});
     if(typeof query?.abortSignal==='function')query=query.abortSignal(abort.signal);
     const result=await query;
     stale=operationFailure(request);if(stale)return stale;
     if([401,403].includes(Number(result?.status)))throw {status:result.status};
     if(result?.error)throw result.error;
     if(!Array.isArray(result?.data?.rows)||result.data.rows.some(row=>!row||typeof row!=='object'||Array.isArray(row)))throw Error('INVALID_RESPONSE');
     const next=new Map();
     for(const value of result.data.rows){
      if(!text(value.consecutivo)||!normalized(value.orden)||!normalized(value.sistema))continue;
      const source=Object.freeze({...value});
      if(selectSource&&!selectSource(source))continue;
      const key=matchIdentity(value.orden,value.sistema),rows=next.get(key)||[];
      rows.push(source);next.set(key,rows);
     }
     index=next;loaded=true;state=snapshot('READY','LOADED');return state;
    }catch(error){
     const stale=operationFailure(request);if(stale)return stale;
     loaded=true;index=new Map();state=denied(error)?snapshot('UNAUTHORIZED','ACCESS_DENIED'):snapshot('UNAVAILABLE','READ_FAILED','No se pudo consultar NC Vidrio.');return state;
    }
   })().finally(()=>{if(request===version){pending=null;controller=null;}});
   return pending;
  },
  candidatesFor(row,savedReferences=[]){
   const current=currentState();
   if(current.status!=='READY')return Object.freeze({...current,count:null,candidates:empty});
   const saved=new Set(savedReferences.map(normalized)),byReference=new Map();
   const rowLine=lineIdentity(row?.linea??row?.line);
   for(const source of index.get(matchIdentity(row?.produccion,row?.oficial?.sistema))||[]){
    const reference=normalized(source.consecutivo);
    if(saved.has(reference)||!ncTrackingMatches(source,row))continue;
    const candidate=byReference.get(reference)||{reference:text(source.consecutivo),source,sources:[],sameResponsibleLine:false};
    candidate.sources.push(source);
    if(rowLine&&rowLine===lineIdentity(source.linea_responsable)){candidate.sameResponsibleLine=true;candidate.source=source;}
    byReference.set(reference,candidate);
   }
   const candidates=Object.freeze([...byReference.values()].sort((a,b)=>Number(b.sameResponsibleLine)-Number(a.sameResponsibleLine)).map(candidate=>Object.freeze({...candidate,sources:Object.freeze(candidate.sources)})));
   return Object.freeze({...current,count:candidates.length,candidates});
  }
 };
}
