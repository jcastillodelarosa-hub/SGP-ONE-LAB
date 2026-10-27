/** Isolated server boundary; never import into browser/runtime.
 * SQL-certified readers are the only source. No request accepts evidence/roles.
 * Inject a least-privilege PostgreSQL pool after separate productive review.
 */
import {createPackingResolver} from './packing-resolver.js';
import {createLineaPostgresRepository} from './linea-postgres-repository.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createLineaSourceBridge({connect}){
 async function execute(operation,session,request){
  const production=operation==='resolve'?request:request?.production;
  if(typeof production!=='string'||!production.trim()||typeof session!=='string'||!session.trim())throw new Error('INVALID_REQUEST');
  if(operation!=='resolve'&&!uuid.test(request?.id??''))throw new Error('INVALID_REQUEST_ID');
  // PostgreSQL UUID textual form is canonical lowercase. Use the same form for
  // advisory locks and idempotency signature, including mixed-case retries.
  if(operation!=='resolve')request={...request,id:request.id.toLowerCase()};
  const client=await connect();
  try{
   await client.query('BEGIN');
   await client.query("SET LOCAL lock_timeout='5s'");
   // Same lock order as B2: UUID -> production -> turn. Resolve has no UUID.
   if(operation!=='resolve')await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,123))',[request.id]);
   const prepared=await client.query('SELECT sgp_linea_c2.preparar($1,$2,$3) AS data',[session,production,operation==='correctAssembly'?'ENSAMBLE':'EMPAQUE']);
   const result=prepared.rows[0]?.data;
   if(result?.status!=='READY'){
    // Commit ONLY the fail-closed invalidation; no operation is attempted.
    await client.query('COMMIT');
    return {status:'SIN_CONCILIAR',available:null,reason:result?.reason??'FUENTE_NO_VERIFICABLE'};
   }
   // B2 remains unchanged. Nested repository transaction is an actual savepoint
   // on the SAME session; locks/evidence remain held until outer commit.
   const nested={query(sql,params=[]){
    if(sql==='BEGIN')return client.query('SAVEPOINT c2_operation');
    if(sql==='COMMIT')return client.query('RELEASE SAVEPOINT c2_operation');
    if(sql==='ROLLBACK')return client.query('ROLLBACK TO SAVEPOINT c2_operation');
    return client.query(sql,params);
   },release(){}};
   const api=createPackingResolver(createLineaPostgresRepository({connect:async()=>nested}));
   const response=await api[operation](session,request);
   await client.query('COMMIT');return response;
  }catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
 }
 return Object.freeze({resolve:(session,production)=>execute('resolve',session,production),consume:(session,request)=>execute('consume',session,request),correctAssembly:(session,request)=>execute('correctAssembly',session,request)});
}
