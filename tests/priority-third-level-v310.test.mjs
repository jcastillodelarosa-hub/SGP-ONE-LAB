import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 prioritySegments,priorityDepth,priorityParent,priorityChildren,
 comparePriority,groupPriorityRows,splitPriorityPart,
 validatePriorityAssignments,hasScheduledPriority
} from '../src/domain/priority-hierarchy.js';

const rows=[
 {key_produccion:'a',cantidad:5,produccion:'A'},
 {key_produccion:'b',cantidad:9,produccion:'B'},
 {key_produccion:'c',cantidad:4,produccion:'C'},
 {key_produccion:'d',cantidad:7,produccion:'D'}
];
const assigned={a:'3.1',b:'3.1',c:'3.2',d:'3.2'};

test('prioridades con tercer nivel son identificadores jerárquicos, no decimales',()=>{
 assert.deepEqual(prioritySegments('3.1.12'),[3,1,12]);
 assert.equal(priorityDepth('3.1.1'),3);
 assert.equal(priorityDepth('3.1'),2);
 assert.equal(priorityDepth('3'),1);
 assert.equal(priorityParent('3.1.12'),'3.1');
 for(const invalid of ['3.1.1.2','3..1','3.0.1','3.1x','',null])assert.equal(priorityDepth(invalid),0);
 assert.deepEqual(['3.1.10','3.1.2','3.2','3.1.1','4','3.1'].sort(comparePriority),
 ['3.1','3.1.1','3.1.2','3.1.10','3.2','4']);
});

test('subdividir solo la parte seleccionada conserva otras órdenes, cantidades e identidad',()=>{
 const original=structuredClone(assigned),source=structuredClone(rows);
 const plan=splitPriorityPart(rows,assigned,'3.1',2);
 assert.deepEqual(plan.children,['3.1.1','3.1.2']);
 assert.deepEqual(plan.affected,['a','b']);
 assert.deepEqual(plan.assignments,{a:'3.1.1',b:'3.1.1',c:'3.2',d:'3.2'});
 plan.assignments.b='3.1.2';
 assert.deepEqual(groupPriorityRows(rows,plan.assignments).map(x=>[x.priority,x.cantidad,x.rows.length]),
 [['3.1.1',5,1],['3.1.2',9,1],['3.2',11,2]]);
 assert.equal(validatePriorityAssignments(rows,plan.assignments,{root:3,requireNonempty:plan.children}),null);
 assert.deepEqual(assigned,original);
 assert.deepEqual(rows,source);
});

test('validaciones impiden subpartes vacías, cambios de reserva y división de Proyecto',()=>{
 const plan=splitPriorityPart(rows,assigned,'3.1',2);
 assert.match(validatePriorityAssignments(rows,plan.assignments,{root:3,requireNonempty:plan.children}),/subparte/);
 assert.match(validatePriorityAssignments(rows,{...plan.assignments,b:'4.1.2'},{root:3}),/principal/);
 assert.match(validatePriorityAssignments(rows,{...plan.assignments,d:undefined},{root:3}),/válida/);
 assert.match(validatePriorityAssignments(rows,plan.assignments,{project:true,root:3}),/Proyecto/);
 assert.throws(()=>priorityChildren('3.1.1',2));
 assert.throws(()=>priorityChildren('3.1',21));
 assert.throws(()=>splitPriorityPart(rows,assigned,'3.2',1));
});

test('se protege una parte programada sin bloquear otra parte de la misma reserva',()=>{
 const coverage=[
 {reserva:'8657615',prioridad:'3.1',programaciones:1},
 {reserva:'8657615',prioridad:'3.2',programaciones:0},
 {reserva:'8657000',prioridad:'3.2',programaciones:5}
 ];
 assert.equal(hasScheduledPriority(coverage,'8657615',['3.1']),true);
 assert.equal(hasScheduledPriority(coverage,'8657615',['3.2']),false);
 assert.equal(hasScheduledPriority(coverage,'8657615',['3.1.1']),false);
});

test('módulos preservan subnivel y Picking/Ensamble usan orden jerárquico',()=>{
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(app,/function enhancePrAssignedList\(/);
 assert.match(app,/async function startPrSplit\(/);
 assert.doesNotMatch(app,/generación automática queda bloqueada/);
 assert.match(app,/function askPrSubparts\(/);
 assert.match(app,/splitPriorityPart\(prCurrent.rows,prAssign,parent,n\)/);
 assert.match(app,/validatePriorityAssignments\(prCurrent.rows,prAssign/);
 assert.match(app,/hasScheduledPriority\(coverage,prCurrent.reserva/);
 assert.match(app,/partCompare\(a.parte,b.parte\)/);
 assert.match(app,/assemblySort.key==="prioridad"\?comparePriority/);
 assert.match(app,/priorityDepth\(x.parte\)===3/);
 assert.match(css,/#priorityProductionBody tr\.priority-row-locked/);
 assert.match(css,/\.priority-level3-chip/);
 assert.ok(Number(html.match(/LAB v(\d+)/)?.[1])>=310);
 assert.match(html,/styles\.css\?v=326/);
 assert.match(html,/app\.js\?v=326/);
});

test('migración aplicada preserva contratos y protege programación',()=>{
 const sql=fs.readFileSync(new URL('../supabase/migrations/20261020_lab_v310_prioridad_tercer_nivel.sql',import.meta.url),'utf8');
 assert.match(sql,/AUTORIZADO: tres RPC/);
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.sgp_mecanizado_disponibles/);
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.sgp_picking_cola/);
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.sgp_guardar_prioridad/);
 assert.match(sql,/split_part\(x\.prioridad_semanal,'\.',3\)/);
 assert.match(sql,/split_part\(f\.parte,'\.',3\)/);
 assert.match(sql,/case when p\.parte/);
 assert.match(sql,/end parte_num/);
 assert.match(sql,/mp\.prioridad_semanal=pr\.prioridad/);
 assert.doesNotMatch(sql,/::numeric parte_num/);
});


test('generación automática admite prioridades jerárquicas sin alterar firma, roles ni contrato',()=>{
 const sql=fs.readFileSync(new URL('../supabase/migrations/20261020_lab_v310_generar_prioridades_restantes.sql',import.meta.url),'utf8');
 const rollback=fs.readFileSync(new URL('../supabase/rollback/20261020_lab_v310_generar_prioridades_restantes_rollback.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.sgp_generar_prioridades_restantes\(p_token text, p_anio integer, p_semana integer, p_linea text\)/);
 assert.match(sql,/SECURITY DEFINER/);
 assert.match(sql,/SET search_path TO 'public'/);
 assert.match(sql,/sgp_validar_sesion_rol\(p_token,array\['ADMINISTRADOR','COORDINADOR'\]\)/);
 assert.ok(sql.includes("prioridad ~ '^[0-9]+(\\.[0-9]+){0,2}$'"));
 assert.ok(rollback.includes("prioridad ~ '^[0-9]+(\\.[0-9]+)?$'"));
 assert.equal((sql.match(/\$function\$/g)||[]).length,2);
 assert.equal((sql.match(/CREATE OR REPLACE FUNCTION/g)||[]).length,1);
 assert.equal((sql.match(/return jsonb_build_object/g)||[]).length,1);
 assert.match(sql,/return jsonb_build_object\('ok',true,'reservas_generadas',generated,'siguiente_prioridad',next_prio\)/);
 assert.doesNotMatch(sql,/DROP FUNCTION|ALTER TABLE|REVOKE|GRANT/);
});
