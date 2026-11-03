/** Public demonstration from synthetic fixture only, never from CLI/private files. */
import {writeFile} from 'node:fs/promises';import {prepareScopeImport} from '../../src/server/lp01-scope-import.js';import {fixture} from './fixtures.mjs';
const x=fixture();x.reference.assignments.pop();x.proposed.assignments[0].validUntil='2026-11-03T00:00:00-05:00';
x.catalog.accounts.push({id:'QA-OBSERVER',role:'CONSULTA',active:true});
const observer={...x.proposed.assignments[0],user:'QA-OBSERVER',duty:'READ',validUntil:'2026-11-04T00:00:00-05:00'};
x.reference.assignments.push(observer);x.proposed.assignments.push({...observer,validUntil:x.asOf,revokedAt:x.asOf});
const r=prepareScopeImport(x);const sample={synthetic:true,apply:r.apply,status:r.status,counts:Object.fromEntries(Object.entries(r.diff).map(([k,v])=>[k,Array.isArray(v)?v.length:v])),examples:{addition:r.diff.additions[0],change:r.diff.changes[0],revocation:r.diff.revocations[0]},conflicts:r.conflicts,periods:r.coverage.map(({period,primaryCovered,backupCovered})=>({period,primaryCovered,backupCovered}))};
await writeFile(new URL('./evidence/demo-synthetic.json',import.meta.url),JSON.stringify(sample,null,2)+'\n');
console.log('Synthetic diff demonstration prepared; apply=false; no real identities');
