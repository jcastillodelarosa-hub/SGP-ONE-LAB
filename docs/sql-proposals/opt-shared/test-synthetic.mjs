import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createOptSharedCuts} from '../../../src/services/opt-shared-cuts.js';
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite();let checks=0;
const ok=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
const reject=async(fn,pattern)=>{await assert.rejects(fn,pattern);checks++;};
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const scope={linea:'PANELES_2',anio:2026,semana:45,modo:'BASE'};
const result=async(sql,params=[]) => (await db.query(sql,params)).rows[0].result;
const estado=(user='alice',reserva='R',s=scope)=>result('SELECT public.sgp_opt_cortes_estado_v2($1,$2,$3) result',[user,reserva,s]);
const registrar=(user,reserva,piezas,clave,s=scope)=>result('SELECT public.sgp_opt_cortes_registrar_v2($1,$2,$3,$4,$5) result',[user,reserva,piezas,clave,s]);
const count=async(table)=>(await db.query(`SELECT count(*) n FROM sgp_opt_shared.${table}`)).rows[0].n;
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
CREATE TABLE public.sgp_producciones(key_produccion text PRIMARY KEY,id_linea text,reserva_al text,sistema text,anio integer,semana_base integer,semana_actual integer,activa text,excluida_export boolean);
CREATE TABLE public.sgp_mecanizado_programacion(id_programacion uuid PRIMARY KEY,reserva text,estado text);
CREATE TABLE public.sgp_mecanizado_programacion_detalle(id_programacion uuid REFERENCES public.sgp_mecanizado_programacion,key_produccion text,reserva_snapshot text,cantidad_snapshot numeric,PRIMARY KEY(id_programacion,key_produccion));
CREATE VIEW public.sgp_produccion_reservas_v AS SELECT sp.key_produccion,trim(r) reserva,split_part(sp.reserva_al,',',1) reserva_principal FROM public.sgp_producciones sp CROSS JOIN LATERAL unnest(string_to_array(sp.reserva_al,',')) r WHERE sp.activa='SI';
CREATE TABLE public.fixture_users(actor text PRIMARY KEY,active boolean); INSERT INTO public.fixture_users VALUES('alice',true),('bob',true);
CREATE FUNCTION public.sgp_pdt_validar_rol_real(token text,roles text[]) RETURNS text LANGUAGE plpgsql AS $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.fixture_users WHERE actor=token AND active) OR NOT 'LIDER MECANIZADO'=ANY(roles) THEN RAISE EXCEPTION 'UNAUTHORIZED'; END IF; RETURN token; END $$;
CREATE FUNCTION public.sgp_mis_accesos(token text) RETURNS TABLE(ventana text) LANGUAGE sql AS $$SELECT 'mecanizado'::text$$;`);
// Exact existing LP helper, not a mock of schedule calculation. Continuous fixture
// keeps unrelated regression tests independent of the CI clock and Monday gap.
await db.exec(`CREATE SCHEMA sgp_lp_operacion;
CREATE TABLE public.sgp_configuracion_general(clave text PRIMARY KEY,valor jsonb);
INSERT INTO public.sgp_configuracion_general VALUES('HORARIOS_TURNOS',
'{"lunes_sabado":{"turno1":{"inicio":"07:00","fin":"19:00"},"turno2":{"inicio":"19:00","fin":"07:00"}},"domingo":{"turno1":{"inicio":"07:00","fin":"19:00"},"turno2":{"inicio":"19:00","fin":"07:00"}}}');`);
const lpSql=readFileSync(new URL('../lp01-operacion/01_operacion_REVIEW.sql',import.meta.url),'utf8');
const periodStart=lpSql.indexOf('CREATE FUNCTION sgp_lp_operacion.periodo(');
await db.exec(lpSql.slice(periodStart,lpSql.indexOf('END $$;',periodStart)+7));
for (const [n,res,line,week,year] of [[1,'R,ASSOCIATED','PANELES_2',45,2026],[2,'R2','PANELES_2',45,2026],[3,'OUT','OTHER',45,2026],[4,'R','PANELES_2',46,2026],[5,'R','PANELES_2',45,2027]]) {
 const primary=res.split(',')[0];
 await db.query("INSERT INTO public.sgp_producciones VALUES($1,$2,$3,'SYSTEM-A',$4,$5,$5,'SI',false)",[`KEY-${n}`,line,res,year,week]);
 await db.query("INSERT INTO public.sgp_mecanizado_programacion VALUES($1,$2,'SIN INICIAR')",[id(100+n),primary]);
 await db.query('INSERT INTO public.sgp_mecanizado_programacion_detalle VALUES($1,$2,$3,5)',[id(100+n),`KEY-${n}`,primary]);
}
await db.exec(readFileSync(new URL('./install_REVIEW.sql',import.meta.url),'utf8'));
ok((await db.query('SELECT enabled,read_roles,write_roles FROM sgp_opt_shared.config')).rows[0],{enabled:false,read_roles:[],write_roles:[]});
await reject(()=>estado(),/OPT_NO_HABILITADO/);
await db.exec("UPDATE sgp_opt_shared.config SET enabled=true,access_window='mecanizado',read_roles=ARRAY['LIDER MECANIZADO'],write_roles=ARRAY['LIDER MECANIZADO']");
const piece=(corte=1,key=1,reserva='R')=>({referencia:'REF',pagina:1,patron:1,barra:1,corte,longitud_mm:123.45,asignacion:{reserva,sistema:'SYSTEM-A',key_produccion:`KEY-${key}`,id_programacion:id(100+key)}});
const source=(source_key,origen='RETAIL',modo_carga='INDICE')=>({source_key,origen,modo_carga,consecutivo:'OPT-1'});
let approvalNumber=1000;
async function approve(manifest,bytes,fuentes=[source(`SOURCE-${approvalNumber}`)]){
 const approval=id(approvalNumber++);
 await db.query(`INSERT INTO sgp_opt_shared.approvals(id_aprobacion,sha256,manifest_sha256,fuentes,evidencia) VALUES($1,encode(sha256($2::bytea),'hex'),encode(sha256(convert_to($3::jsonb::text,'UTF8')),'hex'),$4,'{"sgp_binding":"synthetic-only"}')`,[approval,bytes,JSON.stringify(manifest),JSON.stringify(fuentes)]);
 return approval;
}
const importIt=(approval,pdf,manifest)=>result('SELECT sgp_opt_shared.import_manifest($1,$2,$3) result',[approval,pdf,JSON.stringify(manifest)]);
const pdf=Buffer.from('%PDF-synthetic'); const manifest=[piece(1),piece(2),piece(3)];
const approval=await approve(manifest,pdf,[source('RETAIL-1')]);
await reject(()=>importIt(approval,Buffer.from('%PDF-wrong'),manifest),/OPT_HASH_DOCUMENTO/);
await reject(()=>importIt(approval,pdf,[piece(1)]),/OPT_HASH_MANIFIESTO/);
const imported=await importIt(approval,pdf,manifest);ok(imported.cantidad_piezas,3);ok((await importIt(approval,pdf,manifest)).duplicado,true);
const ids=(await db.query('SELECT id_pieza FROM sgp_opt_shared.pieces WHERE id_documento=$1 ORDER BY corte',[imported.id_documento])).rows.map(p=>p.id_pieza);
for (const bad of [[{...piece(),pagina:1.5}],[{...piece(),longitud_mm:0}],[piece(),piece()],[{...piece(),usuario:'spoof'}],[{...piece(),corte:null}],[{...piece(),referencia:''}],[{...piece(),longitud_mm:'123'}],[{...piece(),asignacion:{...piece().asignacion,key_produccion:'MISSING'}}],[{...piece(),asignacion:{...piece().asignacion,id_programacion:id(102)}}],[{...piece(),asignacion:[piece().asignacion,piece().asignacion]}]]) {
 const bytes=Buffer.from(`%PDF-invalid-${approvalNumber}`),a=await approve(bad,bytes);
 await reject(()=>importIt(a,bytes,bad),/OPT_MANIFIESTO_INVALIDO|OPT_ASIGNACION_INVALIDA|OPT_UNIDAD_FUERA_AMBITO|check constraint|unique constraint/);
 ok(await count('documents'),1);
}
await reject(()=>db.exec('UPDATE sgp_opt_shared.pieces SET longitud_mm=1'),/OPT_INMUTABLE/);
await reject(()=>db.exec('DELETE FROM sgp_opt_shared.approvals'),/OPT_INMUTABLE/);
await reject(()=>registrar('unknown','R',[ids[0]],id(10)),/UNAUTHORIZED/);
await reject(()=>registrar('alice','OTHER',[ids[0]],id(10)),/RESERVA_NO_VALIDADA/);
await reject(()=>registrar('alice','R',[ids[0],ids[0]],id(10)),/PIEZAS_DUPLICADAS/);
await reject(()=>registrar('alice','R',[ids[0],id(999)],id(10)),/RESERVA_NO_VALIDADA/);
ok(await count('cuts'),0);
ok((await registrar('alice','R',[ids[1],ids[0]],id(10))).cantidad_piezas,2);
ok((await registrar('alice','R',[ids[0],ids[1]],id(10))).duplicado,true);
await reject(()=>registrar('bob','R',[ids[0],ids[1]],id(10)),/CLAVE_REUTILIZADA/);
await reject(()=>registrar('alice','R',[ids[2]],id(10)),/CLAVE_REUTILIZADA/);
await reject(()=>registrar('alice','R',[ids[0],ids[1]],id(10),{...scope,semana:46}),/CLAVE_REUTILIZADA/);
await reject(()=>registrar('bob','R',[ids[1],ids[2]],id(11)),/CORTE_YA_REGISTRADO/);
ok(await count('cuts'),2); await registrar('bob','R',[ids[2]],id(11));
let state=await estado();ok(state.totales.cortadas,3);ok(state.referencias[0].piezas[2].usuario,'bob');ok(state.scope,scope);
await db.exec("UPDATE sgp_opt_shared.config SET write_roles='{}'");ok((await estado()).puede_registrar,false);ok((await estado('alice','EMPTY')).manifiesto_validado,false);
await db.exec('SET ROLE anon');
await reject(()=>db.query('SELECT sgp_opt_shared.import_manifest(null,null,null)'),/permission denied/);
await reject(()=>db.query('SELECT * FROM sgp_opt_shared.cuts'),/permission denied/);
await reject(()=>estado(),/permission denied/);await db.exec('RESET ROLE');
await db.exec("UPDATE sgp_opt_shared.config SET access_window='other'");await reject(()=>estado(),/OPT_NO_HABILITADO/);
await db.exec("UPDATE sgp_opt_shared.config SET access_window='mecanizado',write_roles=ARRAY['LIDER MECANIZADO']");
// One mixed document: two reserves, another line, another week/year, unresolved unit and associated reserve.
const mixed=[piece(1),piece(2,2,'R2'),piece(3,3,'OUT'),piece(4,4),piece(5,5),{...piece(6),asignacion:null},piece(7,1,'ASSOCIATED')];
const mixedPdf=Buffer.from('%PDF-multi-reserva'); const mixedApproval=await approve(mixed,mixedPdf,[source('RETAIL-MIXED')]);
const mixedDoc=await importIt(mixedApproval,mixedPdf,mixed);ok(mixedDoc.sin_asignacion,1);
const mixedIds=(await db.query('SELECT id_pieza FROM sgp_opt_shared.pieces WHERE id_documento=$1 ORDER BY corte',[mixedDoc.id_documento])).rows.map(p=>p.id_pieza);
const before=await count('pieces');
const secondSource=await approve(mixed,mixedPdf,[source('PROJECT-MIXED','PROYECTO'),source('INDIVIDUAL-MIXED','DESCONOCIDO','INDIVIDUAL')]);
ok((await importIt(secondSource,mixedPdf,mixed)).id_documento,mixedDoc.id_documento);ok(await count('pieces'),before);
const changed=[{...mixed[0],asignacion:piece(2,2,'R2').asignacion},...mixed.slice(1)];
const changedApproval=await approve(changed,mixedPdf);await reject(()=>importIt(changedApproval,mixedPdf,changed),/RECONCILIACION/);
const conflictPdf=Buffer.from('%PDF-new-version'),conflictApproval=await approve([piece()],conflictPdf,[source('RETAIL-MIXED')]);
await reject(()=>importIt(conflictApproval,conflictPdf,[piece()]),/OPT_FUENTE_REUTILIZADA/);ok(await count('documents'),2);
ok((await estado()).totales,{piezas:4,cortadas:3,pendientes:1});
ok((await estado('alice','R2')).referencias[0].id_documento,mixedDoc.id_documento);
ok((await estado('alice','R2')).totales.piezas,1);ok((await estado('alice','ASSOCIATED')).totales.piezas,1);
ok((await estado('alice','OUT')).totales.piezas,0);
ok((await estado('alice','R',{...scope,semana:46})).totales.piezas,1);
ok((await estado('alice','R',{...scope,anio:2027})).totales.piezas,1);
ok((await estado()).referencias.find(r=>r.id_documento===mixedDoc.id_documento).fuentes.length,3);
for(const index of [1,2,3,4,5,6]) await reject(()=>registrar('alice','R',[mixedIds[index]],id(30+index)),/RESERVA_NO_VALIDADA|OPT_UNIDAD_FUERA_AMBITO/);
for(const badScope of [{...scope,linea:'OTHER'},{...scope,modo:'ACTUAL'},{...scope,anio:2019},{...scope,semana:54},{...scope,extra:true}]) await reject(()=>estado('alice','R',badScope),/OPT_SCOPE_INVALIDO/);
// Additional v2 regression: invalid assignments are atomic; evidence is not discarded.
const physicalBefore=await count('pieces'),sourcesBefore=await count('sources');
for(const bad of [
 [{...piece(),asignacion:undefined}],
 [{...piece(),asignacion:{...piece().asignacion,reserva:'R2'}}],
 [{...piece(),asignacion:{...piece().asignacion,sistema:'OTHER'}}],
 [{...piece(),asignacion:{...piece().asignacion,id_programacion:'not-a-uuid'}}],
 [{...piece(),asignacion:{...piece().asignacion,key_produccion:''}}],
 [{...piece(),asignacion:{...piece().asignacion,cantidad:2}}],
 [piece(),{...piece(),asignacion:piece(1,2,'R2').asignacion}],
 [{...piece(),cantidad:2}],
 [{...piece(),pagina:0}],
 [{...piece(),longitud_mm:100000}]
]) {
 const bytes=Buffer.from(`%PDF-v2-invalid-${approvalNumber}`),a=await approve(bad,bytes);
 await reject(()=>importIt(a,bytes,bad),/OPT_MANIFIESTO_INVALIDO|OPT_ASIGNACION_INVALIDA|OPT_UNIDAD_FUERA_AMBITO|invalid input syntax|check constraint|unique constraint/);
 ok(await count('pieces'),physicalBefore);ok(await count('sources'),sourcesBefore);
 // Approval/evidence remains available for review even when import rolls back.
 ok((await db.query('SELECT evidencia FROM sgp_opt_shared.approvals WHERE id_aprobacion=$1',[a])).rows[0].evidencia,{sgp_binding:'synthetic-only'});
}
// Source keys do not silently rewrite metadata or create a second document.
for(const badSources of [
 [source('RETAIL-MIXED'),{...source('RETAIL-MIXED'),consecutivo:'OTHER'}],
 [{...source('RETAIL-MIXED'),modo_carga:'INDIVIDUAL'}],
 [source('NEW-BEFORE-INVALID'),{...source('INVALID'),origen:'INDIVIDUAL'}],
 [{...source('INVALID'),evidencia:'unexpected'}]
]) {
 const a=await approve(mixed,mixedPdf,badSources);
 await reject(()=>importIt(a,mixedPdf,mixed),/OPT_FUENTE_REUTILIZADA|OPT_FUENTE_INVALIDA|check constraint/);
 ok(await count('sources'),sourcesBefore);ok(await count('pieces'),physicalBefore);
}
ok((await db.query('SELECT count(*) n FROM sgp_opt_shared.pieces WHERE id_documento=$1',[mixedDoc.id_documento])).rows[0].n,7);
ok((await db.query('SELECT count(*) n FROM sgp_opt_shared.assignments a JOIN sgp_opt_shared.pieces p USING(id_pieza) WHERE p.id_documento=$1',[mixedDoc.id_documento])).rows[0].n,6);
// Null is intentionally unresolved, not a default assignment to the first reserve.
ok((await db.query('SELECT count(*) n FROM sgp_opt_shared.assignments WHERE id_pieza=$1',[mixedIds[5]])).rows[0].n,0);
// Approved origin-week rule: moving execution week never moves the reserve.
await db.query('UPDATE public.sgp_producciones SET semana_actual=46 WHERE key_produccion=$1',['KEY-1']);
ok((await estado()).totales.piezas,4);
ok((await estado('alice','R',{...scope,semana:46})).totales.piezas,1);
await db.query('UPDATE public.sgp_producciones SET semana_actual=45 WHERE key_produccion=$1',['KEY-1']);
// Live binding must fail after exact canonical membership or detail is lost.
await db.query("UPDATE public.sgp_producciones SET reserva_al='R' WHERE key_produccion=$1",['KEY-1']);
ok((await estado('alice','ASSOCIATED')).puede_registrar,false);
await reject(()=>registrar('alice','ASSOCIATED',[mixedIds[6]],id(60)),/OPT_UNIDAD_FUERA_AMBITO/);
await db.query("UPDATE public.sgp_producciones SET reserva_al='R,ASSOCIATED' WHERE key_produccion=$1",['KEY-1']);
await db.query('UPDATE public.sgp_mecanizado_programacion_detalle SET cantidad_snapshot=0 WHERE key_produccion=$1',['KEY-1']);
await reject(()=>registrar('alice','R',[mixedIds[0]],id(61)),/OPT_UNIDAD_FUERA_AMBITO/);
await db.query('UPDATE public.sgp_mecanizado_programacion_detalle SET cantidad_snapshot=5 WHERE key_produccion=$1',['KEY-1']);
// Actual adapter -> SQL, including commit succeeded / response lost / exact replay.
await db.query("UPDATE public.sgp_mecanizado_programacion SET estado='CANCELADA' WHERE id_programacion=$1",[id(101)]);
await reject(()=>registrar('alice','R',[mixedIds[0]],id(40)),/OPT_UNIDAD_FUERA_AMBITO/);ok((await estado()).puede_registrar,false);
await db.query("UPDATE public.sgp_mecanizado_programacion SET estado='SIN INICIAR' WHERE id_programacion=$1",[id(101)]);
let loseResponse=true;
const client={rpc:async(name,a)=>{
 try {
  const data=name==='sgp_opt_cortes_estado_v2' ? await estado(a.p_token,a.p_reserva,a.p_scope) : await registrar(a.p_token,a.p_reserva,a.p_piezas,a.p_idempotency_key,a.p_scope);
  if(name==='sgp_opt_cortes_registrar_v2'&&loseResponse){loseResponse=false;throw new Error('SIMULATED_RESPONSE_LOST_AFTER_COMMIT');}return {data};
 }catch(error){if(error.message==='SIMULATED_RESPONSE_LOST_AFTER_COMMIT')throw error;return {error};}
}};
const aliceApi=createOptSharedCuts(client,()=> 'alice'),bobApi=createOptSharedCuts(client,()=> 'bob');
ok((await aliceApi.estado('R',scope)).totales.pendientes,1);ok((await bobApi.estado('R',scope)).totales.pendientes,1);
const command={reserva:'R',piezas:[mixedIds[0]],idempotencyKey:id(40),scope};
await reject(()=>aliceApi.registrar(command),/SIMULATED_RESPONSE_LOST_AFTER_COMMIT/);
const replay=await aliceApi.registrar(command);ok(replay.duplicado,true);ok(replay.usuario,'alice');ok(replay.scope,scope);
ok((await bobApi.estado('R',scope)).totales,{piezas:4,cortadas:4,pendientes:0});
ok((await db.query('SELECT count(*) n FROM sgp_opt_shared.events WHERE clave=$1',[id(40)])).rows[0].n,1);
await registrar('bob','R2',[mixedIds[1]],id(41));ok((await bobApi.estado('R2',scope)).totales.cortadas,1);ok(await count('cuts'),5);
// Report contract is read-only, catalog first, one row per physical unit.
const reporte=(reserves=null,user='bob',s=scope)=>result('SELECT public.sgp_opt_cortes_reporte_v2($1,$2,$3) result',[user,s,reserves]);
await db.exec("INSERT INTO public.sgp_producciones VALUES('KEY-NO-MANIFEST','PANELES_2','R-NO-MANIFEST','SYSTEM-A',2026,45,45,'SI',false)");
const catalog=await reporte();
ok(Object.keys(catalog).sort(),['contract_version','report_contract','scope','semana_tipo','reservas','seleccion','filas','total_piezas'].sort());
ok(catalog.report_contract,'OPT-CUT-REPORT-1');ok(catalog.semana_tipo,'ALCANCE_REGISTRADO');
ok(catalog.seleccion,null);ok(catalog.filas,[]);ok(catalog.total_piezas,0);
ok(catalog.reservas,[{reserva:'ASSOCIATED',cortadas:0},{reserva:'R',cortadas:4},{reserva:'R-NO-MANIFEST',cortadas:0},{reserva:'R2',cortadas:1}]);
const report=await reporte(['R2','R']);ok(report.seleccion,['R','R2']);ok(report.total_piezas,5);
ok(new Set(report.filas.map(r=>r.id_pieza)).size,5);ok(report.filas.map(r=>r.reserva),['R','R','R','R','R2']);
ok((await reporte(['ASSOCIATED'])).filas,[]);
ok((await reporte(['R-NO-MANIFEST'])).filas,[]);ok((await reporte(['R-NO-MANIFEST'])).total_piezas,0);
ok((await reporte(null,'bob',{...scope,semana:46})).reservas,[{reserva:'R',cortadas:0}]);
ok((await reporte(['R'],'bob',{...scope,semana:46})).total_piezas,0);
for(const [selection,code] of [[[],/RESERVAS_INVALIDAS/],[['R','R'],/RESERVAS_DUPLICADAS/],[['UNKNOWN'],/RESERVA_DESCONOCIDA/],[[null],/RESERVAS_INVALIDAS/],[[' R'],/RESERVAS_INVALIDAS/],[[''],/RESERVAS_INVALIDAS/]]) await reject(()=>reporte(selection),code);
await reject(()=>reporte(Array.from({length:1001},(_,i)=>`R-${i}`)),/OPT_REPORTE_SELECCION_EXCESIVA/);
ok((await db.query("SELECT provolatile FROM pg_proc WHERE oid='public.sgp_opt_cortes_reporte_v2(text,jsonb,text[])'::regprocedure")).rows[0].provolatile,'s');
await reject(()=>reporte(null,'unknown'),/UNAUTHORIZED/);
await reject(()=>reporte(null,'bob',{...scope,semana:54}),/OPT_SCOPE_INVALIDO/);
await db.exec('BEGIN READ ONLY');ok((await reporte(['R','R2'])).total_piezas,5);await db.exec('COMMIT');
for(const role of ['anon','authenticated','service_role']) {
 await db.exec(`SET ROLE ${role}`);await reject(()=>reporte(),/permission denied/);await db.exec('RESET ROLE');
}
await db.exec("UPDATE sgp_opt_shared.config SET read_roles='{}'");await reject(()=>reporte(),/OPT_NO_AUTORIZADO/);
await db.exec("UPDATE sgp_opt_shared.config SET read_roles=ARRAY['LIDER MECANIZADO']");
// Historical report survives changed week/year, archival, cancelled programming and lost membership.
await db.exec("UPDATE public.sgp_producciones SET activa='NO',excluida_export=true,anio=2027,semana_base=1,reserva_al='CHANGED'; UPDATE public.sgp_mecanizado_programacion SET estado='CANCELADA'");
ok((await reporte(['R','R2'])).filas,report.filas);
ok((await reporte()).reservas,[{reserva:'R',cortadas:4},{reserva:'R2',cortadas:1}]);
await db.exec("UPDATE public.sgp_producciones SET activa='SI',excluida_export=false,anio=2026,semana_base=45,reserva_al=CASE key_produccion WHEN 'KEY-1' THEN 'R,ASSOCIATED' WHEN 'KEY-2' THEN 'R2' WHEN 'KEY-3' THEN 'OUT' ELSE 'R' END; UPDATE public.sgp_mecanizado_programacion SET estado='SIN INICIAR'");
// Dedicated origin-week fixtures are rolled back so existing totals remain independent.
// The RPC keeps the real server clock: neither clients nor these tests inject a cut date.
await db.exec('BEGIN');
for(const [key,reserve,origin,later] of [
 [80,'ORIGIN-45',scope,{...scope,semana:46}],
 [81,'ORIGIN-YEAR-END',{...scope,anio:2020,semana:53},{...scope,anio:2021,semana:1}]
]) {
 await db.query("INSERT INTO public.sgp_producciones VALUES($1,'PANELES_2',$2,'SYSTEM-A',$3,$4,$5,'SI',false)",[`KEY-${key}`,reserve,origin.anio,origin.semana,later.semana]);
 await db.query("INSERT INTO public.sgp_mecanizado_programacion VALUES($1,$2,'SIN INICIAR')",[id(100+key),reserve]);
 await db.query('INSERT INTO public.sgp_mecanizado_programacion_detalle VALUES($1,$2,$3,5)',[id(100+key),`KEY-${key}`,reserve]);
 const units=[piece(1,key,reserve),piece(2,key,reserve)],bytes=Buffer.from(`%PDF-origin-${key}`);
 const doc=await importIt(await approve(units,bytes),bytes,units);
 const unitIds=(await db.query('SELECT id_pieza FROM sgp_opt_shared.pieces WHERE id_documento=$1 ORDER BY corte',[doc.id_documento])).rows.map(p=>p.id_pieza);
 ok((await estado('bob',reserve,origin)).totales,{piezas:2,cortadas:0,pendientes:2});
 ok((await estado('bob',reserve,later)).totales.piezas,0);
 // A wrong-week attempt cannot write anything, including at a year boundary.
 await db.exec('SAVEPOINT wrong_week');
 await reject(()=>registrar('bob',reserve,[unitIds[0]],id(key),later),/OPT_UNIDAD_FUERA_AMBITO/);
 await db.exec('ROLLBACK TO SAVEPOINT wrong_week');
 const serverBefore=(await db.query('SELECT clock_timestamp()::text t')).rows[0].t;
 const receipt=await registrar('bob',reserve,[unitIds[0]],id(key),origin);
 const serverAfter=(await db.query('SELECT clock_timestamp()::text t')).rows[0].t;
 ok(receipt.scope,origin);
 ok(Date.parse(receipt.registrado_en)>=Date.parse(serverBefore)&&Date.parse(receipt.registrado_en)<=Date.parse(serverAfter),true);
 ok(receipt.periodo,await result('SELECT sgp_opt_shared.resolver_periodo($1) result',[receipt.registrado_en]));
 ok((await estado('bob',reserve,origin)).totales,{piezas:2,cortadas:1,pendientes:1});
 ok((await estado('bob',reserve,later)).totales.piezas,0);
 const originalRows=(await reporte([reserve],'bob',origin)).filas;
 ok(originalRows.length,1);ok(originalRows[0].periodo,receipt.periodo);
 ok((await reporte(null,'bob',later)).reservas.some(r=>r.reserva===reserve),false);
 // Subsequent scheduling and replay preserve the cut and the remaining piece.
 await db.query('UPDATE public.sgp_producciones SET semana_actual=2 WHERE key_produccion=$1',[`KEY-${key}`]);
 ok(await registrar('bob',reserve,[unitIds[0]],id(key),origin),{...receipt,duplicado:true});
 ok((await estado('bob',reserve,origin)).totales,{piezas:2,cortadas:1,pendientes:1});
 ok((await reporte([reserve],'bob',origin)).filas,originalRows);
 ok((await db.query('SELECT count(*) n FROM sgp_opt_shared.events WHERE clave=$1',[id(key)])).rows[0].n,1);
 ok((await db.query('SELECT count(*) n FROM sgp_opt_shared.cuts WHERE id_pieza=ANY($1)',[unitIds])).rows[0].n,1);
 await db.exec('SAVEPOINT replay_wrong_week');
 await reject(()=>registrar('bob',reserve,[unitIds[0]],id(key),later),/OPT_CLAVE_REUTILIZADA/);
 await db.exec('ROLLBACK TO SAVEPOINT replay_wrong_week');
 ok((await reporte(null,'bob',later)).reservas.some(r=>r.reserva===reserve),false);
}
await db.exec('ROLLBACK');
// Immutable period appears everywhere and registration clock is inside its interval.
for(const row of report.filas) {
 ok(Object.keys(row.periodo).sort(),['fecha','turno','inicio','fin','zona','horario_sha256'].sort());
 ok(row.periodo.zona,'America/Bogota');ok(/^[a-f0-9]{64}$/.test(row.periodo.horario_sha256),true);
 ok(Date.parse(row.registrado_en)>=Date.parse(row.periodo.inicio)&&Date.parse(row.registrado_en)<Date.parse(row.periodo.fin),true);
 ok([1,2].includes(row.periodo.turno),true);
}
ok((await estado()).referencias.flatMap(r=>r.piezas).filter(p=>p.estado==='CORTADO').every(p=>p.periodo!==null),true);
ok((await estado('bob','ASSOCIATED')).referencias[0].piezas[0].periodo,null);
const continuous=(await db.query("SELECT valor FROM public.sgp_configuracion_general WHERE clave='HORARIOS_TURNOS'")).rows[0].valor;
const liveSchedule={lunes_sabado:{turno1:{inicio:'07:00',fin:'19:00'},turno2:{inicio:'19:00',fin:'07:00'}},domingo:{turno1:{inicio:'07:00',fin:'18:00'},turno2:{inicio:'18:00',fin:'05:00'}}};
const setSchedule=h=>db.query("UPDATE public.sgp_configuracion_general SET valor=$1 WHERE clave='HORARIOS_TURNOS'",[h]);
const periodAt=t=>result('SELECT sgp_opt_shared.resolver_periodo($1) result',[t]);
await setSchedule(liveSchedule);
for(const [time,date,shift] of [
 ['2027-01-01T06:59:59-05:00','2026-12-31',2],['2027-01-01T07:00:00-05:00','2027-01-01',1],
 ['2026-11-14T06:59:59-05:00','2026-11-13',2],['2026-11-14T07:00:00-05:00','2026-11-14',1],
 ['2026-11-14T19:00:00-05:00','2026-11-14',2],['2026-11-15T06:59:59-05:00','2026-11-14',2],
 ['2026-11-15T07:00:00-05:00','2026-11-15',1],['2026-11-15T18:00:00-05:00','2026-11-15',2],
 ['2026-11-16T04:59:59-05:00','2026-11-15',2],['2026-11-16T07:00:00-05:00','2026-11-16',1]
]) {const p=await periodAt(time);ok(p.fecha,date);ok(p.turno,shift);}
for(const time of ['2026-11-16T05:00:00-05:00','2026-11-16T06:59:59-05:00']) await reject(()=>periodAt(time),/OPT_HORARIO_SIN_TURNO/);
await setSchedule({...liveSchedule,domingo:{...liveSchedule.domingo,turno2:{inicio:'17:00',fin:'08:00'}}});
await reject(()=>periodAt('2026-11-15T17:30:00-05:00'),/OPT_HORARIO_SUPERPUESTO/);
await reject(()=>periodAt('2026-11-16T07:00:00-05:00'),/OPT_HORARIO_SUPERPUESTO/);
await setSchedule({...liveSchedule,lunes_sabado:{...liveSchedule.lunes_sabado,turno1:{inicio:'07:00',fin:'07:00'}}});
await reject(()=>periodAt('2026-11-14T10:00:00-05:00'),/HORARIO_OPERATIVO_AMBIGUO/);
// Exercise actual registration rollback with real server clock, never inject RPC time.
// Same short future interval leaves the current instant uncovered; +/- one hour
// around the server clock covers it twice. Wide margin avoids minute-boundary flakes.
const clockHour=Number((await db.query("SELECT extract(hour FROM clock_timestamp() AT TIME ZONE 'America/Bogota') h")).rows[0].h);
const hm=h=>`${String((h+24)%24).padStart(2,'0')}:00`;
for(const [start,end,code] of [[clockHour+2,clockHour+3,/OPT_HORARIO_SIN_TURNO/],[clockHour-1,clockHour+2,/OPT_HORARIO_SUPERPUESTO/]]) {
 const slot={inicio:hm(start),fin:hm(end)};
 await setSchedule({lunes_sabado:{turno1:slot,turno2:slot},domingo:{turno1:slot,turno2:slot}});
 await reject(()=>registrar('bob','ASSOCIATED',[mixedIds[6]],id(70)),code);
 ok(await count('cuts'),5);ok((await db.query('SELECT count(*) n FROM sgp_opt_shared.events WHERE clave=$1',[id(70)])).rows[0].n,0);
}
// Replay ignores even unavailable/changed schedules and preserves original event.
await db.exec("DELETE FROM public.sgp_configuracion_general WHERE clave='HORARIOS_TURNOS'");
const originalReceipt=(await db.query('SELECT resultado FROM sgp_opt_shared.events WHERE clave=$1',[id(10)])).rows[0].resultado;
ok(await registrar('alice','R',[ids[0],ids[1]],id(10)),{...originalReceipt,duplicado:true});
await reject(()=>registrar('bob','ASSOCIATED',[mixedIds[6]],id(70)),/OPT_HORARIO_NO_CONFIGURADO/);
ok(await count('cuts'),5);ok((await db.query('SELECT count(*) n FROM sgp_opt_shared.events WHERE clave=$1',[id(70)])).rows[0].n,0);
await db.query("INSERT INTO public.sgp_configuracion_general VALUES('HORARIOS_TURNOS',$1)",[continuous]);
await db.exec("UPDATE public.fixture_users SET active=false WHERE actor='alice'");await reject(()=>aliceApi.registrar(command),/UNAUTHORIZED/);await reject(()=>reporte(['R'],'alice'),/UNAUTHORIZED/);
await db.exec(readFileSync(new URL('./contain_REVIEW.sql',import.meta.url),'utf8'));ok(await count('cuts'),5);await reject(()=>reporte(),/OPT_NO_HABILITADO/);
// Execute the exact preflight under a read-only transaction against fixtures only.
const preflight=readFileSync(new URL('./00_preflight_READONLY.sql',import.meta.url),'utf8');
await db.exec('BEGIN READ ONLY');
const inspection=await db.exec(preflight);
await db.exec('COMMIT');
ok(inspection.length,4);
ok(inspection[1].rows.length,18);
ok(inspection[1].rows.every(r=>r.exists && r.production_concordance==='NOT_VERIFIED'),true);
ok(inspection[1].rows.filter(r=>['anio','semana_base','activa','excluida_export'].includes(r.column_name)).length,4);
ok(inspection[2].rows[0].exists,true);
ok(inspection[2].rows[0].expected_definition_md5,null);
ok(inspection[2].rows[0].production_concordance,'NOT_VERIFIED');
ok(/^[a-f0-9]{32}$/.test(inspection[2].rows[0].current_definition_md5),true);
ok(inspection[3].rows.some(r=>r.definition.includes('PRIMARY KEY (id_programacion, key_produccion)')),true);
ok(await count('cuts'),5);
const shiftPreflight=readFileSync(new URL('./01_shift_preflight_READONLY.sql',import.meta.url),'utf8');
await db.exec('BEGIN READ ONLY');const shiftInspection=await db.exec(shiftPreflight);await db.exec('COMMIT');
ok(shiftInspection.length,3);ok(shiftInspection[0].rows[0].exists,true);
ok(shiftInspection[1].rows[0].clave,'HORARIOS_TURNOS');ok(/^[a-f0-9]{64}$/.test(shiftInspection[1].rows[0].horario_sha256),true);
ok(shiftInspection[2].rows[0].opt_schema_already_exists,true);
// Missing dependency remains visible instead of disappearing from the report.
await db.exec('ALTER VIEW public.sgp_produccion_reservas_v RENAME TO fixture_saved_reservas_v');
await db.exec('BEGIN READ ONLY');
const missingInspection=await db.exec(preflight);
await db.exec('COMMIT');
ok(missingInspection[1].rows.filter(r=>r.table_name==='sgp_produccion_reservas_v').map(r=>r.exists),[false,false,false]);
ok(missingInspection[2].rows[0].exists,false);
ok(missingInspection[2].rows[0].current_definition_md5,null);
await db.exec('ALTER VIEW public.fixture_saved_reservas_v RENAME TO sgp_produccion_reservas_v');
console.log(`PASS: ${checks} synthetic SQL checks. PGlite single session, NOT a multi-session or production test.`);await db.close();
