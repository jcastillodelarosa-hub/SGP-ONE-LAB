/** Private isolated reader. DB validates session + both scopes; no HTTP route,
 * pool credentials, productive source registration or availability certificate. */
export function createLineaExportManifestReader({connect}){
 return Object.freeze({async read(session,production,load){
  if([session,production,load].some(x=>typeof x!=='string'||!x.trim()))throw Error('INVALID_REQUEST');
  let db;
  try{
   db=await connect();
   await db.query('BEGIN TRANSACTION READ ONLY');
   await db.query("SET LOCAL statement_timeout='10s'");
   const result=(await db.query('SELECT sgp_linea_e2.leer($1,$2,$3) AS data',[session,production,load])).rows[0]?.data;
   if(!result||!['SIN_CONCILIAR','PENDIENTE_CERTIFICACION_EXPORT'].includes(result.status)||result.available!==null)throw Error('UNTRUSTED_SOURCE');
   await db.query('COMMIT');return result;
  }catch{
   // A failed connection/rollback must not leak driver diagnostics or credentials.
   try{if(db)await db.query('ROLLBACK');}catch{/* preserve bounded public error */}
   throw Error('EXPORT_SOURCE_NOT_VERIFIED');
  }finally{
   if(db){try{await db.release();}catch{throw Error('EXPORT_SOURCE_NOT_VERIFIED');}}
  }
 }});
}
