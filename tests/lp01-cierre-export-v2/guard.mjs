import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {EXPORT_V2_VERSION,EXPORT_V2_ENABLED} from '../../src/server/lp-export-production-v2.js';
const root=new URL('../../',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('docs/sql-proposals/lp01-cierre-export-v2/manifest.json',root),'utf8'));
assert.equal(manifest.version,EXPORT_V2_VERSION);assert.equal(EXPORT_V2_ENABLED,false);
for(const [kind,files] of Object.entries({sources:manifest.source_sha256,package:manifest.package_sha256})){
 for(const [path,expected] of Object.entries(files)){
  const bytes=await readFile(new URL(path,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),expected,`${kind} changed: ${path}`);
 }
}
// No import/route can accidentally turn the isolated reference into an endpoint.
async function scan(path) {
 for(const entry of await readdir(new URL(path,root),{withFileTypes:true})){
  const child=path+'/'+entry.name;
  if(entry.isDirectory())await scan(child);
  else if(/\.(js|ts|html)$/.test(child)&&child!=='src/server/lp-export-production-v2.js'){
   const text=await readFile(new URL(child,root),'utf8');assert(!text.includes('lp-export-production-v2.js'),`Unexpected production wiring: ${child}`);
  }
 }
}
await scan('src');await scan('supabase/functions');
console.log(`PASS ${Object.keys(manifest.source_sha256).length} source pins; ${Object.keys(manifest.package_sha256).length} package pins; disabled and unwired.`);
