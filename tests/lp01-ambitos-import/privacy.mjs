import {mkdtemp,mkdir,writeFile,readFile,stat,chmod,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {fixture} from './fixtures.mjs';
const script=resolve('scripts/lp01-import-scopes.mjs'),hash=x=>createHash('sha256').update(x).digest('hex');
const dir=await mkdtemp(join(tmpdir(),'lp-import-')),root=join(dir,'private/lp01-scopes');
const sentinel='QA_PRIVATE_SENTINEL_3C';let pin,manifest;
const encode=x=>JSON.stringify(x,null,2)+'\n';
async function setup(change=()=>{}){
 await rm(join(dir,'private'),{recursive:true,force:true});await mkdir(root,{recursive:true,mode:0o700});await chmod(root,0o700);
 const x=fixture();x.catalog.accounts[0].id=sentinel;for(const state of [x.reference,x.proposed])for(const a of state.assignments)if(a.user==='QA-PRIMARY')a.user=sentinel;change(x);
 manifest={contract:'LP-AMBITO-IMPORTACION/1',asOf:x.asOf,referenceRevision:'QA-approved-reference',entries:{}};
 for(const kind of ['reference','proposed','catalog','periods']){const bytes=encode(x[kind]);const file=kind+'.json';await writeFile(join(root,file),bytes,{mode:0o600});manifest.entries[kind]={file,sha256:hash(bytes),approvalRef:'QA-synthetic-approval'};}
 const bytes=encode(manifest);await writeFile(join(root,'manifest.json'),bytes,{mode:0o600});pin=hash(bytes);return x;
}
async function repin(kind,bytes){await writeFile(join(root,kind+'.json'),bytes,{mode:0o600});manifest.entries[kind].sha256=hash(bytes);const m=encode(manifest);await writeFile(join(root,'manifest.json'),m);pin=hash(m);}
function run(expected){const r=spawnSync(process.execPath,[script,'manifest.json',pin],{cwd:dir,encoding:'utf8'});assert.equal(r.status,expected,r.stderr);assert.ok(![sentinel,dir,pin].some(x=>(r.stdout+r.stderr).includes(x)));return r;}
const checks=[];
try{
 await setup();run(0);const target=join(root,'import-'+pin),before=await readFile(join(target,'report.json'),'utf8');run(0);assert.equal(await readFile(join(target,'report.json'),'utf8'),before);assert.equal(JSON.parse(before).apply,false);
 for(const file of ['manifest.json','source-reference.json','source-proposed.json','source-catalog.json','source-periods.json','report.json','review.md','diff.txt'])assert.equal((await stat(join(target,file))).mode&0o777,0o600);
 assert.equal((await stat(target)).mode&0o777,0o700);assert.ok((await readFile(join(target,'source-catalog.json'),'utf8')).includes(sentinel));checks.push('Real CLI repeat preserves exact private report/source copies; files0600 directories0700; no identities, hashes or paths in stdout/stderr');
 await writeFile(join(root,'proposed.json'),'{}');run(1);assert.equal(await readFile(join(target,'report.json'),'utf8'),before);checks.push('Altered source rejected by pinned hash without modifying previous artifact');
 await setup();await writeFile(join(root,'manifest.json'),encode({...manifest,asOf:'2026-11-01T00:00:00Z'}));run(1);checks.push('Altered manifest rejected by externally supplied pin');
 await setup();await repin('proposed','{"contract":"LP-AMBITO-TEMPORAL/1","assignments":[],"assignments":[]}');run(1);checks.push('Duplicate JSON keys rejected even with matching hashes');
 await setup();await chmod(join(root,'catalog.json'),0o644);run(1);await chmod(join(root,'catalog.json'),0o600);await rm(join(root,'catalog.json'));await symlink(join(root,'reference.json'),join(root,'catalog.json'));run(1);checks.push('Broad file mode and symlink inputs rejected');
 await setup();run(0);await writeFile(join(root,'import-'+pin,'report.json'),'{}');run(1);checks.push('Altered prior output is not overwritten or accepted as an idempotent retry');
 await setup(x=>{x.reference.assignments=[];x.proposed.assignments=[];});run(2);const missing=JSON.parse(await readFile(join(root,'import-'+pin,'report.json')));assert.ok(missing.coverage.every(c=>!c.primaryCovered&&!c.backupCovered));checks.push('Missing responsibilities produce private pending artifact with exit2 and zero application');
 // Publish only a synthetic test summary, never the private artifacts or input manifest.
 await mkdir(resolve('tests/lp01-ambitos-import/evidence'),{recursive:true});await writeFile(resolve('tests/lp01-ambitos-import/evidence/privacy.json'),encode({status:'PASS',synthetic:true,checks}));console.log('PASS private importer: 7 groups; synthetic data only; no private artifact published');
}finally{await rm(dir,{recursive:true,force:true});}
