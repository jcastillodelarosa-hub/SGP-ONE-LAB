/** Synthetic transaction emulator. This is NOT a PostgreSQL concurrency proof. */
export function memoryRepository(seed,sessions){
 let snapshot=structuredClone(seed),requests=new Map(),queue=Promise.resolve();
 return {inspect:()=>structuredClone(snapshot),
 transaction(production,work){
  const run=queue.then(async()=>{
   let next=structuredClone(snapshot),pending=new Map(requests);
   const response=await work({
    session:async id=>structuredClone(sessions[id]||null),
    request:async id=>structuredClone(pending.get(id)||null),
    snapshot:async()=>structuredClone(next),
    commit:async({expectedRevision,event,request})=>{
     if(production!==next.production||expectedRevision!==next.revision)throw new Error('REVISION_CONFLICT');
     if(pending.has(request.id))throw new Error('DUPLICATE_REQUEST');
     next.events.push(structuredClone(event));next.revision++;
     if(next.unitMap){next.unitMap.revision=next.revision;next.unitMap.packedIds.push(...event.unitIds);}
     for(const p of next.pdts)if(p.mappingRevision!==undefined)p.mappingRevision=next.revision;
     pending.set(request.id,structuredClone(request));
    }
   });snapshot=next;requests=pending;return response;
  });queue=run.catch(()=>{});return run;
 }};
}
