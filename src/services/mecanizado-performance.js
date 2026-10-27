/** Opt-in measurements: names/count/duration only. Never arguments, rows or session tokens. */
export function createReadMetrics({enabled=false,clock=()=>performance.now()}={}){
 let entries=[];
 const record=(kind,name,start,status='ok')=>{if(enabled)entries.push({kind,name,ms:Math.max(0,clock()-start),status});if(entries.length>500)entries=entries.slice(-500);};
 const measure=async(kind,name,task)=>{const start=clock();try{const result=await task();record(kind,name,start,result?.error?'error':'ok');return result;}catch(error){record(kind,name,start,'error');throw error;}};
 return {enabled,measure,sync(name,task){const start=clock();try{return task();}finally{record('render',name,start);}},snapshot:()=>entries.map(entry=>({...entry})),reset:()=>{entries=[];}};
}
export function observeReadClient(client,metrics){
 if(!metrics.enabled)return client;
 const wrap=(builder,table)=>new Proxy(builder,{get(target,key){if(key==='then')return (resolve,reject)=>metrics.measure('query',table,()=>Promise.resolve(target)).then(resolve,reject);const value=Reflect.get(target,key);return typeof value==='function'?(...args)=>{const next=value.apply(target,args);return next&&typeof next==='object'?wrap(next,table):next;}:value;}});
 return new Proxy(client,{get(target,key){if(key==='rpc')return (name,args)=>metrics.measure('rpc',name,()=>target.rpc(name,args));if(key==='from')return table=>{return wrap(target.from(table),table);};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
}
/** Coalesce only in-flight reads. No cached successful data or relaxed authorization freshness. */
export function createInFlightReads(){
 let scope=null;const active=new Map();
 return async function read(token,key,task){if(scope!==token){scope=token;active.clear();}if(active.has(key))return active.get(key);const promise=Promise.resolve().then(task);active.set(key,promise);try{return await promise;}finally{if(active.get(key)===promise)active.delete(key);}};
}
export function latestTask(task,delay=40){
 let timer=null,pending=[];
 const run=(...args)=>{clearTimeout(timer);return new Promise((resolve,reject)=>{pending.push({resolve,reject});timer=setTimeout(async()=>{const waiters=pending;pending=[];timer=null;try{const result=await task(...args);waiters.forEach(w=>w.resolve(result));}catch(error){waiters.forEach(w=>w.reject(error));}},delay);});};
 run.cancel=()=>{clearTimeout(timer);timer=null;pending.splice(0).forEach(w=>w.resolve());};return run;
}

const READ_RPCS=new Set(['sgp_consultar_programacion_semana','sgp_mecanizado_recepcion_resumen_listar','sgp_mecanizado_disponibles','sgp_mecanizado_programacion_listar','sgp_mecanizado_cobertura_programacion','sgp_mecanizado_cobertura_ordenes','sgp_mecanizado_conciliaciones_listar','sgp_mecanizado_reprogramaciones_listar','sgp_mecanizado_semanas_programacion','sgp_mecanizado_pendientes_turno','sgp_mecanizado_ordenes_programacion','sgp_reservas_asociadas_listar']);
export function scopedReadClient(client,token,metrics,inFlight){
 const observed=observeReadClient(client,metrics);
 return new Proxy(observed,{get(target,key){if(key==='rpc')return (name,args)=>{if(args?.p_token!==token)return Promise.reject(new Error('La sesión cambió durante la consulta'));if(!READ_RPCS.has(name))return target.rpc(name,args);const {p_token,...parameters}=args;return inFlight(token,name+JSON.stringify(parameters),()=>target.rpc(name,args));};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
}
