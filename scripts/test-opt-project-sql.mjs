// Isolated, synthetic-only SQL contract checks. No Supabase or live credentials.
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
const work=await mkdtemp(join(tmpdir(),'sgp-opt-project-sql-'));
const root=fileURLToPath(new URL('../',import.meta.url));
const run=(command,args,env)=>new Promise((resolve,reject)=>{
 const child=spawn(command,args,{cwd:root,env,stdio:'inherit'});
 child.once('error',reject);child.once('exit',(code,signal)=>code===0?resolve():reject(new Error(`${command} failed: ${code??signal}`)));
});
try{
 const env={...process.env,npm_config_cache:join(work,'npm-cache')};
 // Never let an inherited developer setting bring private fixture files into CI.
 delete env.OPT_REAL_FIXTURES;delete env.OPT_PGLITE_MODULE;
 await run(process.platform==='win32'?'npm.cmd':'npm',[
  'install','--prefix',work,'--registry=https://registry.npmjs.org',
  '--ignore-scripts','--no-audit','--no-fund','--save-exact','@electric-sql/pglite@0.5.16'
 ],env);
 env.OPT_PGLITE_MODULE=pathToFileURL(join(work,'node_modules','@electric-sql','pglite','dist','index.js')).href;
 await run(process.execPath,['docs/sql-proposals/opt-shared/test-project-pglite.mjs'],env);
}finally{await rm(work,{recursive:true,force:true});}
