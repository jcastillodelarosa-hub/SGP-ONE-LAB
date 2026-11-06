// Local PostgreSQL harness only. The server service receives no test RPC stubs.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {DOMParser} from '@xmldom/xmldom';
import {officialCloseService} from '../../src/server/lp-official-close-service.js';
const input=JSON.parse(readFileSync(0,'utf8'));
const lit=value=>value===null?'NULL':"'"+String(typeof value==='object'?JSON.stringify(value):value).replaceAll("'","''")+"'";
const parameters={sgp_lp_official_read_v1:['p_token','p_context'],sgp_lp_official_context_v1:['p_token','p_context','p_id','p_request_hash'],sgp_lp_official_commit_v1:['p_token','p_context','p_id','p_request_hash','p_source_fingerprint','p_expected_revision','p_state','p_result','p_file']};
const env={...process.env};for(const k of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete env[k];
const service=officialCloseService({DOMParser,rpc:async(name,args)=>{
 if(!parameters[name])throw Error('Unexpected RPC');
 try{
  const sql=`SELECT public.${name}(${parameters[name].map(k=>lit(args[k])).join(',')});`;
  const value=execFileSync('docker',['--host=unix:///var/run/docker.sock','exec','-i',input.container,'psql','-d',input.database||'postgres','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',env,stdio:['pipe','pipe','pipe']});
  return {data:JSON.parse(value)};
 }catch(e){return {error:{message:e.stderr?.toString()||e.message}};}
}});
try{process.stdout.write(JSON.stringify(await service.run({...input.request,bytes:input.file?new Uint8Array(readFileSync(input.file)):undefined})));}
catch(e){process.stdout.write(JSON.stringify({error:e.message}));process.exitCode=1;}
