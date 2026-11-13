// Read-only, local original XLSX differential profile. No server or credentials.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const [path,sheet='ARCHIVOS',origin='RETAIL',mode]=process.argv.slice(2);
if(!path)throw Error('Usage: node scripts/profile-opt-index-equivalence.mjs INDEX.xlsx [ARCHIVOS] [RETAIL]');
if(mode){
 if(!['DOM','STREAM'].includes(mode))throw Error('Unknown mode');
 const {DOMParser}=await import('@xmldom/xmldom');
 const {parseIndexWorkbook}=await import('../src/domain/opt-index-file.js');
 const {SaxesParser}=await import('saxes');
 const {createWorksheetXMLReader}=await import('../src/server/opt-worksheet-stream.js');
 const bytes=new Uint8Array(readFileSync(path)),cpu=process.cpuUsage(),start=performance.now();
 const parsed=await parseIndexWorkbook(bytes,origin,{sheetName:sheet,DOMParser,...(mode==='STREAM'?{readWorksheetXML:createWorksheetXMLReader(SaxesParser)}:{})});
 const used=process.cpuUsage(cpu),wallMs=performance.now()-start;
 const hash=data=>createHash('sha256').update(data).digest('hex');
 console.log(JSON.stringify({mode,sourceSha256:hash(bytes),sourceBytes:bytes.length,resultSha256:hash(JSON.stringify(parsed)),entries:parsed.entries.length,missingRelation:parsed.entries.filter(e=>!e.reservation||!e.system).length,cpuMs:(used.user+used.system)/1000,wallMs,heapBytes:process.memoryUsage().heapUsed,runtime:process.version,writes:0}));
}else{
 const runs=[];
 for(let trial=0;trial<3;trial++)for(const mode of ['DOM','STREAM']){
  const r=spawnSync(process.execPath,[fileURLToPath(import.meta.url),path,sheet,origin,mode],{encoding:'utf8',timeout:60000});
  if(r.status!==0)throw Error(r.stderr||String(r.error)||r.stdout);
  runs.push(JSON.parse(r.stdout));
 }
 assert.equal(new Set(runs.map(r=>r.sourceSha256)).size,1,'Original changed');
 assert.equal(new Set(runs.map(r=>r.resultSha256)).size,1,'Non-equivalent parsed index');
 console.log(JSON.stringify({equivalent:true,runs,limits:'Local Node CPU only. No hosted CPU guarantee. Complete original index parsed each time; no SGP writes.'},null,2));
}
