import {globalTrackingData} from '../domain/lp01-tracking-global.js';
import {officialBalance} from '../domain/lp01-operation.js';

export const NC_TRACKING_LINES=['PANELES_2','FRAMES_2'];
export const NC_TRACKING_STAGES=['ENSAMBLE','EMPAQUE'];
const allowed=role=>['COORDINADOR','ADMINISTRADOR'].includes(role);
const text=value=>String(value??'').trim();
const normalized=value=>text(value).normalize('NFC').replace(/\s+/g,' ').toLocaleUpperCase('es');
const identity=row=>JSON.stringify([row.key,row.line,row.stage]);
const sourceIdentity=row=>JSON.stringify([text(row.consecutivo),text(row.orden),text(row.sistema),row.semana_maestro??null]);
export function ncTrackingMatches(source,row){
 return Boolean(normalized(source.orden)&&normalized(source.sistema)&&normalized(source.orden)===normalized(row.produccion)&&normalized(source.sistema)===normalized(row.oficial?.sistema));
}
export function requireNcTrackingTarget(data,target){
 const row=data.orders.find(row=>row.key===target.key&&row.linea===target.line&&row.etapa===target.stage);
 if(!row||!ncTrackingMatches({orden:target.production,sistema:target.system},row))throw Error('La coincidencia ya no está disponible en esta línea y etapa. Vuelve a buscar.');
 return row;
}
/** Only existing read RPCs. A candidate is a suggestion, never a stored NC link. */
export function ncGlassTrackingSearch({source,sourceSession,getToken,getRole,getClient,openTarget,isCurrent=()=>true}){
 let generation=0,choices=new Map(),lastSource=null,controller=new AbortController();
 const next=()=>{controller.abort();controller=new AbortController();return ++generation;};
 const session=sourceSession;
 function current(version){return generation===version&&isCurrent()&&Boolean(session)&&getToken()===session&&allowed(getRole());}
 function guard(version){if(!current(version))throw Error('La sesión o la búsqueda cambió. Vuelve a consultar la NC.');}
 async function read(name,args,version){guard(version);const client=await getClient();guard(version);let query=client.rpc(name,{p_token:session,...args});if(typeof query.abortSignal==='function')query=query.abortSignal(controller.signal);const result=await query;guard(version);if(result.error)throw result.error;return result.data;}
 async function readSource(version){
  const week=Number(source.semana_maestro);if(!Number.isInteger(week)||week<1||week>53)throw Error('La NC no informa una semana válida. Actualiza NC Vidrio.');
  const data=await read('sgp_consultar_nc_vidrio',{p_semana:week},version);
  if(!Array.isArray(data?.rows))throw Error('Respuesta de NC Vidrio incompatible.');
  const matches=data.rows.filter(row=>text(row.consecutivo)===text(source.consecutivo));
  if(matches.length!==1||sourceIdentity(matches[0])!==sourceIdentity(source))throw Error('La NC cambió o ya no está disponible. Actualiza NC Vidrio.');
  return matches[0];
 }
 return {
  cancel(){next();choices.clear();lastSource=null;},
  async search({line,stage}){
   const version=next();choices.clear();lastSource=null;guard(version);
   if(!NC_TRACKING_LINES.includes(line)||!NC_TRACKING_STAGES.includes(stage))throw Error('Selecciona una línea y una etapa válidas.');
   const actualSource=await readSource(version);
   if(!text(actualSource.orden)||!text(actualSource.sistema))throw Error('La NC no tiene producción y sistema suficientes para sugerir coincidencias.');
   const payload=await read('sgp_lp_seguimiento_consultar',{p_linea:line,p_etapa:stage},version);
   const data=globalTrackingData(payload,{line,stage});guard(version);
   const candidates=data.orders.filter(row=>ncTrackingMatches(actualSource,row)).map(row=>({key:row.key,line,stage,production:row.produccion,system:row.oficial.sistema,balance:officialBalance(row,stage)}));
   choices=new Map(candidates.map(row=>[identity(row),Object.freeze({...row,id:identity(row)})]));lastSource=actualSource;
   return [...choices.values()];
  },
  async open(id){
   const choice=choices.get(id);if(!choice||!lastSource)throw Error('Selecciona una coincidencia de la búsqueda actual.');
   const version=next();guard(version);choices.clear();
   const actualSource=await readSource(version);guard(version);
   return openTarget({...choice,ncReference:text(actualSource.consecutivo),session,signal:controller.signal,isCurrent:()=>current(version)});
  }
 };
}
