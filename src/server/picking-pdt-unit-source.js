/** Isolated server-only reader. SQL supplies all evidence/identities; no browser
 * flags, quantities or unit IDs are accepted. No production route/pool installed.
 */
export function createPickingPdtUnitSource({connect}){
 return Object.freeze({async read(production){
  if(typeof production!=='string'||!production.trim())throw new Error('INVALID_PRODUCTION');
  const db=await connect();
  try{
   await db.query('BEGIN');await db.query("SET LOCAL lock_timeout='5s'");
   await db.query('SELECT revision FROM sgp_linea_b2.producciones WHERE key=$1 FOR UPDATE',[production]);
   await db.query('SAVEPOINT d2_source');
   let source;
   try{source=(await db.query('SELECT sgp_linea_d2.impacto($1) AS data',[production])).rows[0]?.data;}
   catch{
    // Roll back only the failed read; retain the production lock.
    await db.query('ROLLBACK TO SAVEPOINT d2_source');
    await db.query('SELECT sgp_linea_c2.notificar($1,$2) AS data',[production,'PDT']);
    await db.query('COMMIT');return {status:'SIN_CONCILIAR',available:null,reason:'PICKING_UNIT_EVIDENCE_UNAVAILABLE'};
   }
   if(!source||source.production!==production||source.complete!==true)throw new Error('INVALID_SERVER_SOURCE');
   await db.query('COMMIT');return {status:'READY',source};
  }catch(error){await db.query('ROLLBACK');throw error;}
  finally{db.release();}
 }});
}
