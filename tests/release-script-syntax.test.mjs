import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=new URL('../',import.meta.url);
const html=readFileSync(new URL('index.html',root),'utf8');
const paths=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)]
 .map(m=>m[1].split('?')[0]).filter(path=>!/^https?:\/\//.test(path));
test('scripts shipped by index.html parse before deployment',()=>{
 assert.ok(paths.length>0);
 for(const path of paths){
  const result=spawnSync(process.execPath,['--check',fileURLToPath(new URL(path,root))],{encoding:'utf8'});
  assert.equal(result.status,0,`${path}: ${result.stderr}`);
 }
});
