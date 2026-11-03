/** Local private IPC only: actual shared handler; RPC responses come from real isolated PG. */
import {createInterface} from 'node:readline';import {DOMParser} from '@xmldom/xmldom';
import {createPowerBIHandler} from '../../src/server/lp-powerbi-handler.js';
const input=createInterface({input:process.stdin,crlfDelay:Infinity})[Symbol.asyncIterator]();
const send=x=>process.stdout.write(JSON.stringify(x)+'\n');
const handler=createPowerBIHandler({DOMParser,allowedOrigins:['https://qa.invalid'],rpc:async(name,args)=>{
 send({kind:'rpc',name,args});const next=await input.next();if(next.done)throw Error('QA_RPC_CHANNEL_CLOSED');return JSON.parse(next.value);
}});
for(;;){const next=await input.next();if(next.done)break;const x=JSON.parse(next.value);
 const r=await handler(new Request('https://qa.invalid/lp-powerbi',{method:'POST',headers:{'Content-Type':'application/json',Origin:x.origin??'https://qa.invalid'},body:JSON.stringify(x.body)}));
 send({kind:'response',status:r.status,body:await r.json()});
}
