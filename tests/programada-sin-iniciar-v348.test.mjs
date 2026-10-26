import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SGP} from '../src/config/domain.js';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/migrations/20261024154000_programada_independiente_v348.sql',import.meta.url),'utf8');

test('v348: programación Sí/No es distinta del flujo de mecanizado y Picking',()=>{
 assert.deepEqual(SGP.programmingStates,['NO','SI']);
 assert.deepEqual(SGP.processFlow,['SIN INICIAR','CORTE','MECANIZADO','PROCESADO']);
 assert.equal(SGP.pickingIsDelivery,true);
 assert.match(app,/const PROD_STATES=\['SIN INICIAR','CORTE','MECANIZADO','PROCESADO'\]/);
 assert.match(app,/function prodDisplayState\(value\).*'PROGRAMADA'.*'SIN INICIAR'/);
});

test('v348: programación parcial permanece programable, completada abajo',()=>{
 assert.match(app,/const unprogrammed=pending\.filter\(r=>r\._done<=0\),partial=pending\.filter\(r=>r\._done>0\)/);
 assert.match(app,/Reservas no programadas · Programada: NO/);
 assert.match(app,/Reservas con programación parcial · Programada: SÍ/);
 assert.match(app,/Reservas completamente programadas · Programada: SÍ/);
 assert.match(app,/r\._done\?'Continuar':'Programar'/);
 assert.match(app,/programmedFor\(r\.reserva,o\.produccion\)/);
 assert.match(app,/r\._left>0&&!r\._confirmation/);
});

test('v348: la cobertura PROGRAMADA no se confunde con estado operativo',()=>{
 assert.match(app,/estado_orden==='PROGRAMADA'/);
 assert.match(sql,/--.*cobertura siguen interpretando PROGRAMADA como cobertura/);
 assert.match(app,/function prodDisplayState\(value\)/);
});

test('v348: migración conserva canceladas, no altera historial, es atómica',()=>{
 assert.match(sql,/\bBEGIN;/);
 assert.match(sql,/\bCOMMIT;/);
 assert.match(sql,/SET programada = \(estado IS DISTINCT FROM 'CANCELADA'\)/);
 assert.match(sql,/WHERE estado = 'PROGRAMADA'/);
 assert.doesNotMatch(sql,/UPDATE public\.sgp_mecanizado_historial_orden/i);
 assert.doesNotMatch(sql,/DELETE FROM public\.sgp_mecanizado_historial_orden/i);
});

test('v348: las dos tablas de ejecución admiten SIN INICIAR antes del primer guardado',()=>{
 for(const t of ['sgp_mecanizado_ejecucion','sgp_mecanizado_ejecucion_orden']){
  assert.match(sql,new RegExp('ALTER TABLE public\\.'+t+'\\s+[\\s\\S]*?ADD CONSTRAINT '+t+'_estado_check'));
  assert.match(sql,new RegExp("ALTER TABLE public[.]"+t+"\\s+ALTER COLUMN estado SET DEFAULT 'SIN INICIAR'"));
 }
 assert.match(sql,/CHECK \(estado IN \('SIN INICIAR','PICKING','CORTE','MECANIZADO','PROCESADO','REPROGRAMADO'\)\)/);
 assert.match(sql,/CHECK \(estado IN \('SIN INICIAR','PROGRAMADA','PICKING','CORTE','MECANIZADO','PROCESADO','REPROGRAMADO'\)\)/);
});

test('v348: bandera programada sigue INSERT y UPDATE de cancelaciones',()=>{
 assert.match(sql,/CREATE TRIGGER trg_sgp_mecanizado_programada_insert/);
 assert.match(sql,/CREATE TRIGGER trg_sgp_mecanizado_programada_update/);
 assert.match(sql,/BEFORE UPDATE OF estado/);
 assert.equal((sql.match(/NEW\.programada := \(NEW\.estado IS DISTINCT FROM 'CANCELADA'\)/g)||[]).length,2);
});

test('v348: RPC preserva sesión, roles, historial y bloquea REPROGRAMADO sin vínculo',()=>{
 assert.match(sql,/sgp_validar_sesion_rol\(p_token/);
 assert.match(sql,/'ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA'/);
 assert.match(sql,/new_state NOT IN \('SIN INICIAR','CORTE','MECANIZADO','PROCESADO','REPROGRAMADO'\)/);
 assert.match(sql,/new_state='REPROGRAMADO' AND NOT EXISTS/);
 assert.match(sql,/id_origen=p_id_programacion AND produccion=p_produccion/);
 assert.match(sql,/INSERT INTO sgp_mecanizado_historial_orden/);
 assert.match(sql,/old_state IS DISTINCT FROM new_state/);
 assert.match(app,/if\(!prodCanWriteState\(state\)\)return alert/);
});

test('v348: arrastre conserva función y exige contrato auditado',()=>{
 assert.match(sql,/pg_get_functiondef\(p\.oid\)/);
 assert.match(sql,/La RPC de arrastre cambió: revisar contrato antes de migrar/);
 assert.match(sql,/coalesce\(eo.estado,me.estado,''SIN INICIAR''\)/);
 assert.doesNotMatch(sql,/DELETE FROM public\.sgp_mecanizado_reprogramaciones/i);
});

test('v348: Picking y reportes normalizan etiquetas, sin cambiar cobertura',()=>{
 assert.match(app,/function shiftReportState\(row\)\{return prodDisplayState/);
 assert.match(app,/const eo=\{PROCESADO:0,MECANIZADO:1,CORTE:2,'SIN INICIAR':3,PROGRAMADA:3\}/);
 assert.match(app,/prodDisplayState\(o\.estado_mecanizado\|\|x\.estado\)/);
 assert.match(app,/for\(const x of \['PROCESADO','MECANIZADO','CORTE','SIN INICIAR','PROGRAMADA'\]\)/);
});

test('v348: interfaz y recursos reportan versión coincidente',()=>{
 assert.match(css,/\.state-sin-iniciar\{background:#f3e81b!important;color:#202020!important\}/);
 assert.match(html,/LAB v358/);
 for(const asset of ['styles.css','app.js']){
  assert.ok(html.includes(asset+'?v=358'));
 }
 assert.ok(html.includes('picking-delivery-report.css?v=348'));
});
