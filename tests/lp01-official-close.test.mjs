import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser} from '@xmldom/xmldom';
import {parsePowerBI,normalizePowerBI,OFFICIAL_POWERBI_VERSION} from '../src/domain/powerbi/adapter.js';
import {readExportGrid} from '../src/domain/powerbi/xlsx-reader.js';
import {reconcileOfficialPowerBI} from '../src/domain/powerbi/official-reconciliation.js';
import {emptyOfficialClose,applyOfficialImport,availableFromOfficial,officialHistory,closeOfficialPeriod} from '../src/domain/lp01-official-close.js';
import {operationOrders,operationProcessState} from '../src/domain/lp01-operation-orders.js';

const bytes=readFileSync('tests/lp01-powerbi/fixtures/ensamble.xlsx');
const parsed=await parsePowerBI(bytes,{DOMParser,stage:'ENSAMBLE'});
const context={stage:'ENSAMBLE',line:'PANELES_2',date:'2026-10-31',shift:1};
const schedule={date:context.date,shift:1,timezone:'America/Bogota',start:'2026-10-31T07:00:00-05:00',end:'2026-10-31T19:00:00-05:00'};
const catalog=parsed.records.filter(r=>r.shift===1).map((r,i)=>({key_produccion:i+'|PANELES_2',id_linea:'PANELES_2',produccion:r.production,proyecto:r.project,sistema:r.system}));
const reconcile=(p=parsed,cat=catalog,s=schedule)=>reconcileOfficialPowerBI(p,{...context,catalog:cat,schedule:s});
const plan={...context,revision:'plan-r1',rows:catalog.map(p=>({key:p.key_produccion,quantity:10}))};
const command=(reconciliation,id='upload-1',expectedRevision=0)=>({id,expectedRevision,actor:'QA',recordedAt:'2026-10-31T19:10:00-05:00',reconciliation,schedule,plan});
const saved=(state,reconciliation,id)=>applyOfficialImport(state,command(reconciliation,id,state.revision));
const altered=(quantity)=>{const r=structuredClone(reconcile());r.rows=r.rows.slice(0,1);r.rows[0].quantity=quantity;r.sha256='b'.repeat(64);return r;};
const definition={id:'definition-1',key:catalog[0].key_produccion,stage:context.stage,line:context.line,quantity:50,definedAt:'2026-10-31T06:59:00-05:00',baselines:[]};

test('explicit stage uses the same XLSX reader and original parser safeguards',async()=>{
 assert.equal(parsed.adapter,OFFICIAL_POWERBI_VERSION);assert.equal(parsed.records.length,33);
 await assert.rejects(()=>parsePowerBI(bytes,{DOMParser,stage:'EMPAQUE'}),/otra etapa/);
 const grid=await readExportGrid(bytes,{DOMParser});grid.rows[0].values[0]='Año Prog';
 assert.equal(normalizePowerBI(grid,{stage:'ENSAMBLE'}).records.length,33);
 const packing=await parsePowerBI(readFileSync('tests/lp01-powerbi/fixtures/empaque.xlsx'),{DOMParser,stage:'EMPAQUE'});
 assert.equal(packing.stage,'EMPAQUE');assert.equal(packing.records.length,37);
});
test('exact production/project/system resolves independently; ambiguities remain pending',()=>{
 const result=reconcile();assert.equal(result.pending.length,0);assert.equal(result.rows.length,catalog.length);
 const homonym={...catalog[0],key_produccion:'another|PANELES_2',sistema:'DIFFERENT'};
 assert.equal(reconcile(parsed,[...catalog,homonym]).pending.length,0);
 homonym.sistema=catalog[0].sistema;
 assert.equal(reconcile(parsed,[...catalog,homonym]).pending[0].reason,'IDENTIDAD_AMBIGUA');
 const partial=reconcile(parsed,catalog.slice(1));assert.equal(partial.pending[0].reason,'IDENTIDAD_SIN_CORRESPONDENCIA');
 const changed=structuredClone(parsed);changed.records[0].project='Unrelated project';assert.equal(reconcile(changed).pending[0].reason,'IDENTIDAD_SIN_CORRESPONDENCIA');
});
test('duplicate summary across programming dimensions is not added twice',()=>{
 const changed=structuredClone(parsed);changed.records.push({...changed.records[0],week:1,row:999});
 const r=reconcile(changed);assert.equal(r.pending[0].reason,'TOTAL_OFICIAL_REPETIDO');assert.ok(!r.rows.some(x=>x.key===catalog[0].key_produccion));
});
test('all confirmed systems including PIEZA DE ALUMINIO CUERPOS have window quantities',()=>{
 const changed=structuredClone(parsed),cat=structuredClone(catalog);changed.records[0].system=cat[0].sistema='PIEZA DE ALUMINIO CUERPOS';
 assert.equal(reconcile(changed,cat).rows[0].unit,'VENTANAS');assert.equal(reconcile(changed,cat).pending.length,0);
});
test('schedule required from configuration; no fixed weekday or Sunday fallback',()=>{
 assert.throws(()=>reconcile(parsed,catalog,{}),/HORARIO_CONFIGURADO/);
 assert.throws(()=>reconcile(parsed,catalog,{...schedule,end:'2026-10-31T18:00:00-05:00'}),/HORARIO_ARCHIVO/);
 const changed=structuredClone(parsed);changed.records.forEach(r=>{if(r.shift===1)r.shiftLabel='1. 07:00 am - 06:00 pm';});
 assert.ok(reconcile(changed,catalog,{...schedule,end:'2026-10-31T18:00:00-05:00'}).rows.length);
});
test('persistable snapshot reload: identical reload delta zero, downward correction reverses consumption',()=>{
 const first=saved(emptyOfficialClose(),altered(12),'1'),snapshot=JSON.parse(JSON.stringify(first.state));
 assert.equal(availableFromOfficial(snapshot,definition).quantity,38);
 const same=saved(snapshot,altered(12),'2');assert.equal(same.receipt.changes[0].delta,0);assert.deepEqual(same.state.entries,snapshot.entries);
 const corrected=saved(same.state,altered(8),'3');assert.equal(corrected.receipt.changes[0].delta,-4);assert.equal(availableFromOfficial(corrected.state,definition).quantity,42);
 assert.equal(officialHistory(corrected.state,context).length,3);
 assert.equal(corrected.state.history[0].changes[0].quantity,12);
 assert.equal(corrected.state.history[2].changes[0].difference,-2);
 assert.equal(emptyOfficialClose().entries.length,0);
});
test('partial uploads preserve absent rows and the immutable plan at the time of close',()=>{
 const first=saved(emptyOfficialClose(),reconcile(),'1'),old=JSON.stringify(first.state.entries.slice(1));
 const second=saved(first.state,altered(1),'2');assert.equal(JSON.stringify(second.state.entries.slice(1)),old);
 const changedPlan={...plan,revision:'plan-r2',rows:plan.rows.map(p=>({...p,quantity:15}))};
 const next=applyOfficialImport(second.state,{...command(altered(1),'3',2),plan:changedPlan});
 assert.equal(next.state.history[0].plan.revision,'plan-r1');assert.equal(next.receipt.changes[0].planned,15);
 assert.equal(next.receipt.changes[0].difference,-14);
});
test('command receipt idempotency, stale revision, and cross-scope totals rejected',()=>{
 const c=command(altered(12)),first=applyOfficialImport(emptyOfficialClose(),c);
 assert.deepEqual(applyOfficialImport(first.state,c).state,first.state);
 assert.throws(()=>applyOfficialImport(first.state,{...c,actor:'OTHER'}),/IDEMPOTENCIA/);
 assert.throws(()=>applyOfficialImport(first.state,{...c,id:'new'}),/REVISION/);
 const bad=altered(12);bad.rows[0].stage='EMPAQUE';assert.throws(()=>saved(emptyOfficialClose(),bad,'new'),/TOTAL_OFICIAL/);
});
test('close freezes current plan, preserves unknown coverage and prior versions after corrections',()=>{
 const first=saved(emptyOfficialClose(),altered(12),'1');
 const currentPlan={...plan,revision:'plan-at-close',rows:plan.rows.map(p=>({...p,quantity:15}))};
 const close={id:'close-1',expectedRevision:1,actor:'QA',recordedAt:'2026-10-31T20:00:00-05:00',plan:currentPlan,observation:'Partial source'};
 const closed=closeOfficialPeriod(first.state,close);
 assert.equal(closed.receipt.plan.revision,'plan-at-close');assert.equal(closed.receipt.rows[0].difference,-3);
 assert.equal(closed.receipt.rows[1].realized,null);assert.equal(closed.receipt.coverage,'PARTIAL');
 assert.deepEqual(closeOfficialPeriod(closed.state,close).state,closed.state);
 const corrected=saved(closed.state,altered(8),'2');
 const closed2=closeOfficialPeriod(corrected.state,{...close,id:'close-2',expectedRevision:3});
 assert.equal(closed2.receipt.version,2);assert.equal(closed2.receipt.rows[0].realized,8);
 assert.equal(closed2.state.closures[0].rows[0].realized,12);
 const pending=altered(12);pending.pending=[{...pending.rows[0],reason:'IDENTIDAD_AMBIGUA'}];
 const unresolved=saved(emptyOfficialClose(),pending,'x').state;
 assert.throws(()=>closeOfficialPeriod(unresolved,close),/CONCILIACION_PENDIENTE/);
 const resolved=saved(unresolved,altered(12),'resolved').state;assert.equal(resolved.pending.length,0);
 assert.ok(closeOfficialPeriod(resolved,{...close,expectedRevision:2}).receipt);
});
test('Disponible ignores historical summaries, requires evidence within a shift, and never writes Export',()=>{
 const snapshot=saved(emptyOfficialClose(),altered(12),'1').state,before=structuredClone(snapshot);
 assert.equal(availableFromOfficial(snapshot,{...definition,definedAt:'2026-11-01T07:00:00-05:00'}).quantity,50);
 const mid={...definition,definedAt:'2026-10-31T12:00:00-05:00'};
 assert.equal(availableFromOfficial(snapshot,mid).status,'PENDING_BASE');
 mid.baselines=[{...snapshot.entries[0],quantity:10}];assert.equal(availableFromOfficial(snapshot,mid).quantity,48);
 const corrected=saved(snapshot,altered(8),'2').state;assert.equal(availableFromOfficial(corrected,mid).quantity,50);
 assert.equal(availableFromOfficial(snapshot,{...definition,stage:'EMPAQUE'}).quantity,50);
 assert.equal(availableFromOfficial(snapshot,{...definition,quantity:5}).quantity,-7);
 assert.deepEqual(snapshot,before);assert.equal(availableFromOfficial(snapshot,null).quantity,null);
});
test('both process states follow only valid Export balances, with partial packing allowed',()=>{
 const r={etapa:'EMPAQUE',oficial:{cantidad:100,saldo_ensamble:50,saldo_empaque:70,saldos_inicializados:true,presente_ultimo_export:true}};
 assert.equal(operationProcessState(r),'ABIERTAS');r.oficial.saldo_empaque=0;assert.equal(operationProcessState(r),'COMPLETADAS');
 r.oficial.saldo_empaque=100;assert.equal(operationProcessState(r),'PROGRAMADAS');assert.equal(operationProcessState(r,{scheduled:false}),'OTRAS');
 for(const saldo of [null,undefined,'',-1,101])assert.equal(operationProcessState({...r,oficial:{...r.oficial,saldo_empaque:saldo}}),'POR_REVISAR');
});
test('open rows sort by original week, priority and key without duplicating scheduled assignments',()=>{
 const row=(key,part,week,priority)=>({linea:'PANELES_2',etapa:'EMPAQUE',fecha:context.date,turno:1,key,parte:part,prioridad:priority,oficial:{id_linea:'PANELES_2',cantidad:100,saldo_empaque:50,saldos_inicializados:true,presente_ultimo_export:true,semana_base:week,anio:2026}});
 const groups=operationOrders({contract:'LP-OPERACION-1',orders:[row('new','1',44,1),row('old','2',40,9),row('old','3',40,1)]});
 assert.deepEqual(groups.map(g=>g.key),['old','new']);assert.equal(groups[0].rows.length,2);
});
