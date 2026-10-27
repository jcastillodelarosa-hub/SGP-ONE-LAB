/** Isolated server adapter; no runtime route/pool or browser import.
 * Validation is a deliberate, authorized human decision, NOT inferred evidence.
 * Requests cannot supply role, snapshot, estimate, identity or accounting basis. */
export function createConsolidatedPdtSource({connect}){
 async function transaction(work){const db=await connect();try{await db.query('BEGIN');await db.query("SET LOCAL lock_timeout='5s'");const result=await work(db);await db.query('COMMIT');return result;}catch{await db.query('ROLLBACK');throw Error('CONSOLIDATED_OPERATION_REJECTED');}finally{db.release();}}
 return Object.freeze({
  async validate(session,r){
   const keys=['id','production','stage','quantity','revision','sourceHash','date','shift','reason'];
   if(typeof session!=='string'||!session.trim()||!r||Object.keys(r).some(k=>!keys.includes(k))||!Number.isSafeInteger(r.quantity)||r.quantity<0||!Number.isSafeInteger(r.revision)||r.revision<0)throw Error('INVALID_REQUEST');
   return transaction(async db=>(await db.query('SELECT sgp_linea_d2q.validar($1,$2,$3,$4::bigint,$5::bigint,$6,$7::uuid,$8::date,$9::int,$10) AS data',[session,r.production,r.stage,r.quantity,r.revision,r.sourceHash,r.id,r.date,r.shift,r.reason])).rows[0]?.data);
  }
 });
}
