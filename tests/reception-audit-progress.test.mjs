import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';import {createHash} from 'node:crypto';
import {receptionAuditProgress as p,receptionAuditProgressMarkup as html} from '../src/domain/reception-audit-progress.js';
const a=(v=null,z=null)=>[{id:'VERTICALES',nombre:'Verticales',revision:v},{id:'ZOCALERO',nombre:'Zocalero (top y bottom)',revision:z}];
test('neither reviewed',()=>assert.equal(p(a()).completed,0));
test('only Verticales reviewed',()=>{assert.match(html(a({resultado:'SIN_FALTANTES'})),/Verticales: Auditado/);assert.match(html(a({})),/Zócalos: Pendiente/);assert.equal(p(a({})).completed,1)});
test('only Zocalero reviewed',()=>{assert.match(html(a(null,{})),/Verticales: Pendiente/);assert.match(html(a(null,{})),/Zócalos: Auditado/)});
test('reviewed with shortages is not material complete',()=>{assert.equal(p(a({resultado:'CON_FALTANTES'},{})).completed,2);assert.doesNotMatch(html(a({},{})),/sin faltantes|completa/i)});
test('single-area line',()=>assert.equal(p([{id:'GENERAL',nombre:'Recepción',revision:null}]).total,1));
test('custom Zocalero label respected',()=>assert.match(html([{id:'ZOCALERO',nombre:'Especial',revision:null}]),/Especial: Pendiente/));
test('invalid contract unknown, not zero audited',()=>{for(const x of [null,undefined,[],{},[null],[{id:'A'},{id:'A'}]]){assert.equal(p(x),null);assert.doesNotMatch(html(x),/0\/2/)}});
test('labels escaped',()=>assert.match(html([{id:'X',nombre:'<img>',revision:null}]),/&lt;img&gt;/));
test('actual renderer keeps partial row and Auditar action',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');const start=app.indexOf('function renderPickingReception(){'),end=app.indexOf('\nasync function openPickingAuditPieces',start);assert.ok(start>0&&end>start);
 const board={innerHTML:'',querySelectorAll:()=>[]},status={};const row={id_entrega:'synthetic',produccion:'DEMO',semana:47,reserva:'DEMO',sistema:'DEMO',completa:true,areas:a({resultado:'CON_FALTANTES'})};
 vm.runInNewContext(app.slice(start,end)+'\nrenderPickingReception();',{document:{querySelector:id=>id==='#pickReceptionBoard'?board:id==='#pickReceptionFilterStatus'?status:null},pickingReceptionRows:[row],filterReceptionRows:r=>r,normalizeReceptionWeek:x=>x,receptionGroupKey:x=>x.reserva,escapeHtml:s=>String(s),sharedReserveNoticeHtml:()=>'',sharedMetaFromEmbedded:()=>null,isSharedMeta:()=>false,receptionAuditProgressMarkup:html});
 assert.match(board.innerHTML,/Auditoría 1\/2/);assert.match(board.innerHTML,/Zócalos: Pendiente/);assert.match(board.innerHTML,/data-audit="synthetic"/);assert.match(status.textContent,/1 órdenes pendientes/);
});
test('exact reversible SQL additive change and mutually valid guards',()=>{
 const read=n=>readFileSync(new URL('../docs/sql-proposals/reception-progress/'+n+'.sql',import.meta.url),'utf8');const install=read('install'),rollback=read('rollback');
 const body=s=>s.slice(s.indexOf('CREATE OR REPLACE FUNCTION'),s.lastIndexOf(';\nCOMMIT;'));
 const old=body(rollback),next=body(install);assert.equal(next.replace("'areas',sgp_picking_audit_areas.resumen(pe.id_entrega),\n  ",''),old);
 for(const [migration,source]of [[install,old],[rollback,next]]){const hash=createHash('md5').update(source).digest('hex');assert.ok(migration.includes("<> '"+hash+"'"));assert.match(migration,/BEGIN;/);assert.match(migration,/RAISE EXCEPTION/);assert.match(migration,/COMMIT;/)}
});
