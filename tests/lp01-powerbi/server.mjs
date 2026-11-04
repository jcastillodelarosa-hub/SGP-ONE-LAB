/** Local transport only: actual shared server handler → Python broker → actual PostgreSQL. */
import http from 'node:http';import {DOMParser} from '@xmldom/xmldom';import {createPowerBIHandler} from '../../src/server/lp-powerbi-handler.js';
const broker=process.argv[2];
const handler=createPowerBIHandler({DOMParser,allowedOrigins:[broker],rpc:async(name,args)=>{
 const r=await fetch(broker+'/server-rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args})});return r.json();
}});
const server=http.createServer(async(req,res)=>{
 try{let chunks=[],size=0;for await(const b of req){size+=b.length;if(size>3*1024*1024){res.writeHead(413).end();return;}chunks.push(b);}
 const request=new Request('http://127.0.0.1'+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
 const out=await handler(request);res.writeHead(out.status,Object.fromEntries(out.headers));res.end(Buffer.from(await out.arrayBuffer()));
 }catch(e){res.writeHead(500,{'Content-Type':'application/json'}).end(JSON.stringify({error:e.message}));}
});
server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({port:server.address().port})));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
