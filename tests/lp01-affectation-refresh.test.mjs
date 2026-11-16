import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../src/modules/'+p,import.meta.url),'utf8');
test('both views use the same order editor and explicit refresh invalidates native PDT data',async()=>{
 const [assembly,tracking,panel,detail]=await Promise.all(['lp01-assembly-workspace.js','lp01-operation.js','lp01-shared-affectations-panel.js','lp01-tracking-affectations.js'].map(read));
 for(const view of [assembly,tracking])assert.match(view,/mountTrackingAffectations\(/);
 assert.match(detail,/transport\.refreshNative=\(\)=>\{nativeRead=null;return transport\.read\(\);\}/);
 assert.match(panel,/\[data-shared-refresh\]'\)\.onclick=async\(\)=>\{try\{if\(transport\.refreshNative\)native=await transport\.refreshNative\(\);await editor\.refresh\(\)/);
 assert.match(panel,/committed=true;if\(!alive\(\)\)return;if\(transport\.refreshNative\)native=await transport\.refreshNative\(\)/);
});
test('assembly and tracking both prevent an older shared revision overwriting newer state',async()=>{
 const [assembly,tracking]=await Promise.all(['lp01-assembly-workspace.js','lp01-operation.js'].map(read));
 for(const view of [assembly,tracking])assert.match(view,/sharedRevision\?\?-1\)>summary\.sharedRevision\)continue/);
 assert.match(assembly,/sharedRevision\?\?-1\)>\(value\?\.sharedRevision\?\?-1\)\)return/);
});
