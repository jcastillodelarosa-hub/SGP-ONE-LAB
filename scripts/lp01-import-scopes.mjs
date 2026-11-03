/** Private CLI. Only local prevalidation/proposal. No database/network/endpoint. */
import {constants} from 'node:fs';
import {open,lstat,realpath,mkdtemp,rename,rm,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {prepareScopeImport,SCOPE_IMPORT_CONTRACT} from '../src/server/lp01-scope-import.js';
const hash=b=>createHash('sha256').update(b).digest('hex');
const fail=()=>{throw Error('PRIVATE_IMPORT_INVALID');};
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const keys=(x,list)=>plain(x)&&Object.keys(x).length===list.length&&list.every(k=>Object.hasOwn(x,k));
const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const filename=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,64}\.json$/.test(x);
// Reject repeated JSON property names instead of accepting JSON.parse last-wins.
function parse(bytes){
 const s=new TextDecoder('utf-8',{fatal:true}).decode(bytes),value=JSON.parse(s),stack=[];
 for(const token of s.match(/"(?:\\[\s\S]|[^"\\])*"|[{}\[\]:,]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g)??[]){
  const top=stack.at(-1);
  if(token==='{')stack.push({keys:new Set(),key:true});
  else if(token==='[')stack.push({array:true});
  else if(token==='}'||token===']')stack.pop();
  else if(token===','&&top&&!top.array)top.key=true;
  else if(token===':'&&top&&!top.array)top.key=false;
  else if(token.startsWith('"')&&top?.key){const k=JSON.parse(token);if(top.keys.has(k))fail();top.keys.add(k);}
 }
 return value;
}
async function privateStat(path,directory=false){
 const st=await lstat(path);
 if(st.isSymbolicLink()||(directory?!st.isDirectory():!st.isFile())||(st.mode&0o777)!==(directory?0o700:0o600)||(!directory&&st.nlink!==1)||(process.getuid&&st.uid!==process.getuid()))fail();
 return st;
}
async function read(path){
 await privateStat(path);const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{const st=await f.stat();if(!st.isFile()||st.size>8*1024*1024||(st.mode&0o777)!==0o600||st.nlink!==1)fail();return await f.readFile();}finally{await f.close();}
}
async function write(path,data){const f=await open(path,'wx',0o600);try{await f.writeFile(data);}finally{await f.close();}}
let staging;
try{
 const [name,pin,...rest]=process.argv.slice(2);if(!filename(name)||!digest(pin)||rest.length)fail();
 const parent=resolve('private'),root=resolve('private/lp01-scopes');
 if((await lstat(parent)).isSymbolicLink())fail();await privateStat(root,true);if(await realpath(root)!==root)fail();
 const manifest=await read(join(root,name));if(hash(manifest)!==pin)fail();const m=parse(manifest);
 if(!keys(m,['contract','asOf','referenceRevision','entries'])||m.contract!==SCOPE_IMPORT_CONTRACT||typeof m.referenceRevision!=='string'||!m.referenceRevision.trim()||!keys(m.entries,['reference','proposed','catalog','periods']))fail();
 const documents={},copies={'manifest.json':manifest};const names=new Set([name]);
 for(const kind of ['reference','proposed','catalog','periods']){
  const e=m.entries[kind];if(!keys(e,['file','sha256','approvalRef'])||!filename(e.file)||names.has(e.file)||!digest(e.sha256)||typeof e.approvalRef!=='string'||!e.approvalRef.trim())fail();names.add(e.file);
  const data=await read(join(root,e.file));if(hash(data)!==e.sha256)fail();documents[kind]=parse(data);copies['source-'+kind+'.json']=data;
 }
 const result=prepareScopeImport({...documents,asOf:m.asOf});
 result.provenance={manifestSha256:pin,referenceRevision:m.referenceRevision,entries:m.entries,approval:'DECLARED_PRIVATE_REFERENCE_REQUIRES_FUNCTIONAL_REVIEW'};
 const markdown=['# Revisión privada LP (sin aplicación)',`Estado: ${result.status}. apply=false.`,
 'Las declaraciones de aprobación y las huellas verifican la referencia recibida, no certifican su autoridad funcional.',
 ...Object.entries(result.diff).filter(([,v])=>Array.isArray(v)).map(([kind,rows])=>`${kind}: ${rows.length}`),
 `Sin cambios: ${result.diff.unchanged}. Conflictos: ${result.conflicts.length}.`,
 'Identidad y valores antes/después, motivos y cobertura por período: report.json. Las bajas ausentes requieren revocación explícita.',
 'No usar estos archivos en Git, CI, logs ni canales públicos.'].join('\n')+'\n';
 const detail=['DIFF PRIVADO LP — PROPUESTA, apply=false. Categorías pueden solaparse.'];
 for(const [kind,rows] of Object.entries(result.diff))if(Array.isArray(rows))for(const row of rows){
  detail.push('\n'+kind+' '+JSON.stringify(row.identity));
  for(const field of ['duty','validFrom','validUntil','revokedAt','role'])if(row.before?.[field]!==row.after?.[field])detail.push(field+': '+JSON.stringify(row.before?.[field]??null)+' -> '+JSON.stringify(row.after?.[field]??null));
 }
 for(const conflict of result.conflicts)detail.push('CONFLICTO '+JSON.stringify(conflict));
 copies['diff.txt']=Buffer.from(detail.join('\n')+'\n');
 copies['report.json']=Buffer.from(JSON.stringify(result,null,2)+'\n');copies['review.md']=Buffer.from(markdown);
 const target=join(root,'import-'+pin);
 async function verifyExisting(){await privateStat(target,true);const actual=(await readdir(target)).sort();if(JSON.stringify(actual)!==JSON.stringify(Object.keys(copies).sort()))fail();for(const [n,b] of Object.entries(copies))if(!(await read(join(target,n))).equals(b))fail();}
 try{await lstat(target);await verifyExisting();}catch(e){
  if(e.code!=='ENOENT')throw e;
  staging=await mkdtemp(join(root,'.import-'));await privateStat(staging,true);
  for(const [n,b] of Object.entries(copies))await write(join(staging,n),b);
  try{await rename(staging,target);staging=undefined;}catch(error){if(!['EEXIST','ENOTEMPTY'].includes(error.code))throw error;await verifyExisting();}
 }
 process.stdout.write(result.readyForFunctionalReview?'Propuesta privada preparada; apply=false.\n':'Revisión privada pendiente de corrección; apply=false.\n');
 if(!result.readyForFunctionalReview)process.exitCode=2;
}catch{process.stderr.write('Importación privada rechazada. Revisa los archivos y la referencia por el canal privado.\n');process.exitCode=1;}
finally{if(staging)try{await rm(staging,{recursive:true,force:true});}catch{process.stderr.write('Limpieza privada pendiente; revisar por el canal privado.\n');process.exitCode=1;}}
