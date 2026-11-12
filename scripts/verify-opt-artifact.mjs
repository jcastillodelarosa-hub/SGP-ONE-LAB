// Read-only post-build check against the exact positive list, not the source tree alone.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(new URL('..',import.meta.url).pathname),artifact=path.resolve(process.argv[2]||'');
if(!process.argv[2]||artifact===root)throw Error('Indique artefacto separado del checkout');
const list=JSON.parse(await fs.readFile(path.join(root,'scripts/opt-artifact-files.json'),'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
for(const rel of list){if(hash(await fs.readFile(path.join(root,rel)))!==hash(await fs.readFile(path.join(artifact,rel))))throw Error('Archivo OPT diferente: '+rel);}
async function files(dir){const output=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isSymbolicLink())throw Error('Symlink en artefacto OPT');output.push(...(e.isDirectory()?await files(p):[p]));}return output;}
for(const dir of ['opt-digital','vendor/opt-pdf'])for(const f of await files(path.join(artifact,dir))){const rel=path.relative(artifact,f).split(path.sep).join('/');if(!list.includes(rel))throw Error('Archivo OPT fuera de lista positiva: '+rel);}
const dependencies=list.filter(rel=>rel.startsWith('src/'));
console.log(JSON.stringify({status:'PASS',files:list.length,dependencies:dependencies.length,sourceBytesMatch:true,productionEnabled:false}));
