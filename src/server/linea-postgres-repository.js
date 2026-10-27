/** Node-only isolated adapter. Inject a pg-compatible connect() server pool.
 * No connection strings, browser client, service_role or runtime registration.
 * Server DB role must be reviewed separately before any productive installation.
 */
export function createLineaPostgresRepository({connect}){
 return {async transaction(production,work){
  const client=await connect();let token;
  const data=async(sql,params=[])=>{const r=await client.query(sql,params);return r.rows[0]?.data;};
  try{
   await client.query('BEGIN');
   await client.query("SET LOCAL lock_timeout='5s'");
   // Same order as native RPC: global request lock acquired by RPC; production
   // row is held for entire adapter transaction. request() takes the UUID lock
   // first, matching native RPC lock order and serializing identical retries.
   const result=await work({
    session:async handle=>{token=handle;return data('SELECT sgp_linea_b2.contexto($1,$2) AS data',[handle,production]);},
    request:async id=>{await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,123))',[id]);return data('SELECT jsonb_build_object(\'signature\',signature,\'response\',response) AS data FROM sgp_linea_b2.adaptador_solicitudes WHERE id=$1::uuid',[id]);},
    snapshot:async()=>{
     await client.query('SELECT revision FROM sgp_linea_b2.producciones WHERE key=$1 FOR UPDATE',[production]);
     return data('SELECT sgp_linea_b2.snapshot($1) AS data',[production]);
    },
    commit:async({expectedRevision,event,request})=>{
     if(event.production!==production||event.id!==request.id)throw new Error('IDENTITY_MISMATCH');
     const state=await data('SELECT sgp_linea_b2.snapshot($1) AS data',[production]);
     if(state.revision!==expectedRevision)throw new Error('REVISION_CONFLICT');
     const order=await data("SELECT jsonb_build_object('quantity',ejecutado,'revision',revision) AS data FROM sgp_linea_b2.ordenes WHERE key=$1 AND etapa=$2 AND fecha=$3::date AND turno=$4",[production,event.stage,event.date,event.shift]);
     if(!order)throw new Error('ORDER_NOT_FOUND');
     const quantity=order.quantity+event.delta;
     if(!Number.isSafeInteger(quantity)||quantity<0)throw new Error('CORRECTION_NOT_OWNED_BY_SHIFT');
     const cmd={op:'EJECUTAR',id:event.id,key:production,stage:event.stage,date:event.date,shift:event.shift,quantity,revision:order.revision,observation:event.observation};
     await data('SELECT public.sgp_linea_motor_b2($1,$2::jsonb) AS data',[token,JSON.stringify(cmd)]);
     const after=await data('SELECT sgp_linea_b2.disponible($1) AS data',[production]);
     if(after.status!=='READY'||after.available!==request.response.available||after.revision!==request.response.revision)throw new Error('RESOLVER_SQL_DIVERGENCE');
     await client.query('INSERT INTO sgp_linea_b2.adaptador_solicitudes(id,signature,response) VALUES($1::uuid,$2,$3::jsonb)',[request.id,request.signature,JSON.stringify(request.response)]);
    }
   });await client.query('COMMIT');return result;
  }catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
 }};
}
