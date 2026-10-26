import {normalizeCarry,normalizeShift} from '../domain/mecanizado-operational-load.js';
/** Session scoped cache, shared by Production and both calendars; fixed date/shift queries, never per order. */
export function createCarryReader({ttl=30000,concurrency=4,now=()=>Date.now()}={}){
 let session=null;const cache=new Map();let active=0;const queue=[];
 const run=job=>new Promise((resolve,reject)=>{queue.push({job,resolve,reject});pump();});
 function pump(){while(active<concurrency&&queue.length){const {job,resolve,reject}=queue.shift();active++;Promise.resolve().then(job).then(resolve,reject).finally(()=>{active--;pump();});}}
 function clear(){cache.clear();}
 function read(client,token,date,shift){
  if(session!==token){session=token;clear();}
  const canonical=normalizeShift(shift);if(!canonical)return Promise.reject(new Error('Turno no válido'));
  const key=date+'|'+canonical,hit=cache.get(key);if(hit&&(hit.pending||hit.expires>now()))return hit.promise;
  const entry={pending:true};entry.promise=run(async()=>{const result=await client.rpc('sgp_mecanizado_pendientes_turno',{p_token:token,p_fecha:date,p_turno:canonical});if(result.error)throw result.error;return normalizeCarry(result.data,date,canonical);}).then(rows=>{entry.pending=false;entry.expires=now()+ttl;return rows;}).catch(error=>{if(cache.get(key)===entry)cache.delete(key);throw error;});cache.set(key,entry);return entry.promise;
 }
 async function week(client,token,dates){return (await Promise.all(dates.flatMap(date=>['TURNO 1','TURNO 2'].map(shift=>read(client,token,date,shift))))).flat();}
 return {read,week,clear};
}
export const machiningCarry=createCarryReader();

// Partial moves require the existing canonical remaining-order RPC, never subtraction
// from a possibly already adjusted header. Deduplicated per affected reservation/part,
// not per order; queried only for source dates visible in this read model.
let moveSession=null;const moveCache=new Map();
export function clearMoveSources(){moveCache.clear();}
export async function enrichMoveSources(client,token,schedule,moves,dates){
 if(moveSession!==token){moveSession=token;moveCache.clear();}
 const partial=schedule.filter(source=>dates.includes(source.fecha_programacion)&&!source.produccion&&moves.some(move=>String(move.id_origen)===String(source.id_programacion)&&move.produccion));
 const enriched=new Map();
 for(let offset=0;offset<partial.length;offset+=4)await Promise.all(partial.slice(offset,offset+4).map(async source=>{
  const key=JSON.stringify([source.id_programacion,moves.filter(move=>String(move.id_origen)===String(source.id_programacion))]);let hit=moveCache.get(key);
  if(!hit||hit.expires<Date.now()){
   hit={expires:Infinity,promise:client.rpc('sgp_mecanizado_ordenes_programacion',{p_token:token,p_id_programacion:source.id_programacion}).then(result=>{if(result.error)throw result.error;if(!Array.isArray(result.data))throw new Error('Detalle canónico inválido');hit.expires=Date.now()+30000;return result.data;}).catch(error=>{moveCache.delete(key);throw error;})};moveCache.set(key,hit);
  }
  try{enriched.set(String(source.id_programacion),await hit.promise);}catch{ /* Read model reports this source incomplete; never guess remaining quantities. */ }
 }));
 return schedule.map(row=>enriched.has(String(row.id_programacion))?{...row,_ordenes_operativas:enriched.get(String(row.id_programacion))}:row);
}
