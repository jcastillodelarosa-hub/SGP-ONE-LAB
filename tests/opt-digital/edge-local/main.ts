// Local Docker main worker only. /work/inputA.json and inputB.json are private, never committed.
const secret=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
Deno.serve(async req=>{
 try{
 const worker=await EdgeRuntime.userWorkers.create({servicePath:'/work/worker',memoryLimitMb:256,workerTimeoutMs:10000,cpuTimeSoftLimitMs:1900,cpuTimeHardLimitMs:2000,noModuleCache:false,forceCreate:true,envVars:[['OPT_PROBE_SECRET',secret]]});
 return await worker.fetch(req);
 }catch(e){return Response.json({error:String(e)},{status:500});}
});
const run=async()=>{
 console.log(JSON.stringify({runtime:Deno.version,limits:{memoryMb:256,cpuHardMs:2000,cpuSoftMs:1900,policy:'oneshot'},network:'none'}));
 for(const doc of ['A','B'])for(let run=1;run<=3;run++){
  try{
   const response=await fetch('http://127.0.0.1:9000',{method:'POST',headers:{'x-opt-probe-secret':secret},body:await Deno.readTextFile('/work/input'+doc+'.json')});
   console.log(JSON.stringify({doc,run,status:response.status,result:await response.json()}));
  }catch(e){console.log(JSON.stringify({doc,run,error:String(e)}));}
 }
 console.log('PROBE_SUITE_COMPLETE');
};
setTimeout(()=>run().catch(e=>console.log(JSON.stringify({fatal:String(e)}))),100);
