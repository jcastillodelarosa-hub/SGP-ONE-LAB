import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../docs/sql-proposals/lp01-close-refresh-v422/01_visibility_set_based.sql',import.meta.url),'utf8');
const previous=(keys,permissions)=>{for(const key of keys)if(key==null||!permissions.includes(key))return false;return true;};
const setBased=(keys,permissions)=>{const allowed=new Set(permissions);return !keys.some(key=>key==null||!allowed.has(key));};
test('snapshot permission equivalence: allowed, denied, null, empty and duplicates',()=>{
 for(const keys of [[],['A'],['A','B'],['A','A'],[null],[undefined],[''],['C']])
 for(const permissions of [[],['A'],['A','B'],[''],[null]])
 assert.equal(setBased(keys,permissions),previous(keys,permissions));
});
test('one materialized permission set per branch; unchanged visibility guards',()=>{
 assert.equal((sql.match(/WITH allowed AS MATERIALIZED/g)||[]).length,2);
 assert.doesNotMatch(sql,/FOR k IN|SECURITY DEFINER|GRANT |statement_timeout/i);
 for(const guard of ['export_es_historico','LP-HISTORICAL-UNAVAILABLE-1','LP-EXPORT-DUAL-1','LP-EMPAQUE-PLAN-1','LP-ENSAMBLE-PLAN-1'])assert.ok(sql.includes(guard));
 assert.match(sql,/UNION SELECT x->'assignment'->>'key_produccion'/);
});
