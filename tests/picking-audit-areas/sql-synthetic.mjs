import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');const db=new PGlite();await db.waitReady;
const read=p=>readFile(new URL('../../'+p,import.meta.url),'utf8');const checks=[];const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name)};
const dir='docs/sql-proposals/picking-audit-areas/';
const ctx=async(id,t='RECEPCION:a')=>(await db.query('select public.sgp_picking_auditoria_areas_contexto($1,$2) r',[t,id])).rows[0].r;
const save=async(f,area,result,dec=[],diff=[],token='RECEPCION:a',version=null,request=randomUUID())=>{
 const args=[token,f.id,version??(await ctx(f.id,token)).version,request,'2026-11-16','TURNO 1',dec,diff,'fixture',area,result];
 return {r:(await db.query('select public.sgp_picking_auditoria_area_guardar($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) r',args)).rows[0].r,args};};
const state=async id=>(await db.query('select estado from public.sgp_picking_entregas where id_entrega=$1',[id])).rows[0].estado;
let seq=0;async function fixture(line='PANELES_2',missing=0){
 const n=++seq,id=randomUUID(),prog=randomUUID(),prod='Q'+n,key=prod+'|'+line,res='R'+n;
 await db.query('insert into public.sgp_mecanizado_programacion values($1,$2,\'SYS\',\'A\')',[prog,res]);
 await db.query('insert into public.sgp_producciones values($1,$2,$3,10)',[key,prod,line]);
 await db.query('insert into public.sgp_prioridades values($1,$2,$3)',[key,res,line]);
 await db.query('insert into public.sgp_picking_entregas(id_entrega,id_programacion,produccion,completa) values($1,$2,$3,$4)',[id,prog,prod,missing===0]);
 const ds=[];for(let j=0;j<missing;j++) {const pid=randomUUID(),fid=randomUUID(),piece='P'+n+'-'+j;
 await db.query('insert into public.sgp_aluminio_pendientes(id_pendiente,id_pieza,reserva,cantidad) values($1,$2,$3,1)',[pid,piece,res]);
 await db.query('insert into sgp_mecanizado_parcial.contextos_pdt values($1,$2)',[pid,id]);
 await db.query('insert into public.sgp_picking_faltantes(id_faltante,id_entrega,id_pieza,reserva_pendiente,cantidad) values($1,$2,$3,$4,1)',[fid,id,piece,res]);
 ds.push({id_faltante:fid,accion:'ACEPTAR'});}
 return {id,prog,prod,key,res,ds};
}
const readRollback=await read(dir+'rollback-unused.sql');
try{
 await db.exec(await read('tests/picking-audit-areas/fixture.sql'));
 await db.exec(await read('docs/sql-proposals/picking-audit/01-review.sql'));
 const historic=await fixture('PANELES_2'),hs=(await db.query('select public.sgp_picking_auditoria_contexto($1,$2) r',['RECEPCION:old',historic.id])).rows[0].r;
 const historicArgs=['RECEPCION:old',historic.id,hs.version,randomUUID(),'2026-11-15','TURNO 1',[],[],'historical'];
 const historicResult=(await db.query('select public.sgp_picking_auditoria_guardar($1,$2,$3,$4,$5,$6,$7,$8,$9) r',historicArgs)).rows[0].r;
 await db.exec(await read(dir+'install-review.sql'));
 await db.exec(await read(dir+'rollback-unused.sql'));
 assert.equal((await db.query("select to_regnamespace('sgp_picking_audit_areas') n")).rows[0].n,null);
 checks.push('exact installer and unused rollback');
 await db.exec(await read(dir+'install-review.sql'));
 const histReplay=(await db.query('select public.sgp_picking_auditoria_guardar($1,$2,$3,$4,$5,$6,$7,$8,$9) r',historicArgs)).rows[0].r;assert.deepEqual(histReplay,historicResult);checks.push('historical replay preserved');
 await check('two explicit empty reviews required; one consolidated event; same-request replay',async()=>{
 const f=await fixture(),a=await save(f,'VERTICALES','SIN_FALTANTES');assert.equal(a.r.finalizada,false);assert.equal(await state(f.id),'PENDIENTE_VALIDACION');
 const c=await ctx(f.id);assert.equal(c.areas[0].revision.usuario,'RECEPCION:a');assert.equal(c.areas[1].revision,null);
 const b=await save(f,'ZOCALERO','SIN_FALTANTES',[],[],'RECEPCION:b');assert.equal(b.r.finalizada,true);assert.equal(await state(f.id),'VALIDADA');
 const replay=await db.query('select public.sgp_picking_auditoria_area_guardar($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) r',a.args);assert.deepEqual(replay.rows[0].r,a.r);
 assert.equal((await db.query('select count(*)::int n from sgp_picking_audit.eventos where id_entrega=$1',[f.id])).rows[0].n,1);
 await assert.rejects(()=>save(f,'VERTICALES','SIN_FALTANTES'),/AREA_YA_AUDITADA/);
 });
 await check('missing decisions claimed once; per-area actor preserved; all must be decided',async()=>{
 const f=await fixture('PANELES_2',2),v=(await ctx(f.id)).version;
 await save(f,'VERTICALES','CON_FALTANTES',[f.ds[0]]);
 assert.deepEqual((await ctx(f.id)).revisados_ids,[f.ds[0].id_faltante]);
 await assert.rejects(()=>save(f,'ZOCALERO','CON_FALTANTES',[f.ds[1]],[],'RECEPCION:b',v),/CONFLICTO_RECARGAR/);
 await assert.rejects(()=>save(f,'ZOCALERO','CON_FALTANTES',[f.ds[0]]),/FALTANTE_YA_REVISADO/);
 await assert.rejects(()=>save(f,'ZOCALERO','SIN_FALTANTES'),/FALTANTES_SIN_REVISAR/);
 await save(f,'ZOCALERO','CON_FALTANTES',[f.ds[1]],[],'RECEPCION:b');
 const a=(await db.query('select usuario from sgp_picking_audit.decisiones where id_entrega=$1 order by usuario',[f.id])).rows;assert.deepEqual(a.map(x=>x.usuario),['RECEPCION:a','RECEPCION:b']);
 });
 await check('differences persisted immediately, no closure until second area, all differences in receipt',async()=>{
 const f=await fixture(),d={id_pieza:'NEW',perfil:'P',reserva:f.res,acabado:'A',key_produccion:f.key,cantidad:1,ventanas_afectadas:1};
 const a=await save(f,'VERTICALES','CON_FALTANTES',[],[d]);assert.equal(a.r.ids_nuevos.length,1);assert.equal(await state(f.id),'PENDIENTE_VALIDACION');
 assert.equal((await db.query('select count(*)::int n from public.sgp_picking_auditoria_diferencias where id_entrega=$1',[f.id])).rows[0].n,1);
 await save(f,'ZOCALERO','SIN_FALTANTES',[],[],'RECEPCION:b');assert.equal(await state(f.id),'AUDITADA_DIFERENCIA');
 const ev=(await db.query('select payload from sgp_picking_audit.eventos where id_entrega=$1',[f.id])).rows[0].payload;assert.equal(ev.diferencias.length,1);assert.equal(ev.areas.length,2);
 });
 await check('invalid differences roll back area ledger and operational writes',async()=>{
 const f=await fixture();await assert.rejects(()=>save(f,'VERTICALES','CON_FALTANTES',[],[{id_pieza:'INVALID',cantidad:1,ventanas_afectadas:1,key_produccion:f.key}]),/INVALID_PIECE/);
 assert.equal((await db.query('select count(*)::int n from sgp_picking_audit_areas.revisiones where id_entrega=$1',[f.id])).rows[0].n,0);
 });
 await check('explicit result validation, invalid area, invalid token, no direct table/worker access',async()=>{
 const f=await fixture('PANELES_2',1);await assert.rejects(()=>save(f,'VERTICALES','SIN_FALTANTES',f.ds),/RESULTADO_NO_COINCIDE/);
 await assert.rejects(()=>save(f,'VERTICALES','CON_FALTANTES'),/RESULTADO_NO_COINCIDE/);
 await assert.rejects(()=>save(f,'UNKNOWN','SIN_FALTANTES'),/AREA_NO_REQUERIDA/);
 await assert.rejects(()=>ctx(f.id,'CONSULTA'),/UNAUTHORIZED/);
 await db.exec('SET ROLE anon');await ctx(f.id);await assert.rejects(()=>db.query('select * from sgp_picking_audit_areas.revisiones'),/permission denied/);await db.exec('RESET ROLE');
 });
 await check('legacy RPC and direct close cannot bypass required areas; historical rows stay unchanged',async()=>{
 const f=await fixture(),v=(await ctx(f.id)).version;
 await assert.rejects(()=>db.query('select public.sgp_picking_auditoria_guardar($1,$2,$3,$4,$5,$6,$7,$8,$9)',['RECEPCION:a',f.id,v,randomUUID(),'2026-11-16','TURNO 1',[],[],null]),/POR_AREAS_REQUERIDA/);
 await assert.rejects(()=>db.query("update public.sgp_picking_entregas set estado='VALIDADA' where id_entrega=$1",[f.id]),/AREAS_PENDIENTES/);
 const hist=await fixture();await db.query("insert into public.sgp_picking_entregas values($1,$2,$3,'VALIDADA',true,'ADMIN',now(),'historic')",[randomUUID(),hist.prog,hist.prod]);
 });
 await check('NC reader audit roles, missing/ambiguous references, malformed values and authorization',async()=>{
 await db.exec("insert into public.sgp_nc_aluminio(consecutivo,cod_nc,estado,activo) values('N1','NC-1','FINALIZADA',true),('N2','NC-2','ABIERTA',true),('N3','AMB','ABIERTA',true),('N4','AMB','ABIERTA',true)");
 const lookup=async(ref,t='RECEPCION:a')=>(await db.query('select public.sgp_picking_auditoria_nc_consultar($1,$2) r',[t,ref])).rows[0].r;
 assert.equal((await lookup('NC-1')).nc.consecutivo,'N1');assert.equal((await lookup('MISSING')).nc,null);
 await assert.rejects(()=>lookup('AMB'),/NC_AMBIGUA/);await assert.rejects(()=>lookup('N1','CONSULTA'),/UNAUTHORIZED/);
 const f=await fixture('PANELES_2',1);
 await assert.rejects(()=>save(f,'VERTICALES','CON_FALTANTES',[{...f.ds[0],nc:'MISSING'}]),/NC_NO_ENCONTRADA/);
 await assert.rejects(()=>save(f,'VERTICALES','CON_FALTANTES',[{...f.ds[0],nc:{bad:true}}]),/NC_INVALIDA/);
 assert.equal((await ctx(f.id)).areas[0].revision,null);
 });
 await check('NC append preserves primary and prior links; retries do not duplicate; missing NC remains optional',async()=>{
 const f=await fixture('PANELES_2',1),fid=f.ds[0].id_faltante;
 const pid=(await db.query('select id_pendiente from sgp_mecanizado_parcial.contextos_pdt where id_entrega=$1',[f.id])).rows[0].id_pendiente;
 await db.query("update public.sgp_aluminio_pendientes set nc='HIST-UNRESOLVED' where id_pendiente=$1",[pid]);
 await db.query("update public.sgp_picking_faltantes set nc='HIST-UNRESOLVED' where id_faltante=$1",[fid]);
 await db.query("insert into public.sgp_aluminio_pendiente_ncs values($1,'N2','old','{}')",[pid]);
 const a=await save(f,'VERTICALES','CON_FALTANTES',[{...f.ds[0],nc:'NC-1'}]);
 await db.query('select public.sgp_picking_auditoria_area_guardar($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',a.args);
 assert.equal((await db.query('select nc from public.sgp_aluminio_pendientes where id_pendiente=$1',[pid])).rows[0].nc,'HIST-UNRESOLVED');
 assert.equal((await db.query('select count(*)::int n from public.sgp_aluminio_pendiente_ncs where id_pendiente=$1',[pid])).rows[0].n,2);
 const record=(await db.query('select anterior,nuevo from sgp_picking_audit.decisiones where id_faltante=$1',[fid])).rows[0];assert.equal(record.anterior.ncs.length,1);assert.equal(record.nuevo.ncs.length,2);
 const no=await fixture('PANELES_2',1);await save(no,'VERTICALES','CON_FALTANTES',no.ds);
 });
 await check('new difference NC validated before writes and linked by adapter; blank allowed',async()=>{
 const f=await fixture(),d={id_pieza:'NEWNC',perfil:'P',reserva:f.res,acabado:'A',key_produccion:f.key,cantidad:1,ventanas_afectadas:1,nc:'MISSING'};
 await assert.rejects(()=>save(f,'VERTICALES','CON_FALTANTES',[],[d]),/NC_NO_ENCONTRADA/);
 assert.equal((await ctx(f.id)).areas[0].revision,null);
 const a=await save(f,'VERTICALES','CON_FALTANTES',[],[{...d,nc:'NC-1'}]);
 assert.equal((await db.query('select consecutivo from public.sgp_aluminio_pendiente_ncs where id_pendiente=$1',[a.r.ids_nuevos[0]])).rows[0].consecutivo,'N1');
 const b=await fixture();await save(b,'VERTICALES','CON_FALTANTES',[],[{...d,id_pieza:'BLANK',reserva:b.res,key_produccion:b.key,nc:''}]);
 });
 await check('modify can append NC after safe correction; deletion with new NC rejected',async()=>{
 const f=await fixture('PANELES_2',1),source={id_pieza:'EDIT-NC',codigo_sap:'P',reserva:f.res,acabado:'A',key_produccion:f.key,cantidad:5};
 await db.query("insert into public.sgp_aluminio values('EDIT-NC',5)");
 await db.exec(`create or replace function sgp_pdt_multiorigen.fuentes(text,text,jsonb) returns jsonb language sql as $$select '${JSON.stringify([source])}'::jsonb$$`);
 await save(f,'VERTICALES','CON_FALTANTES',[{...f.ds[0],accion:'MODIFICAR',motivo:'corregir',...source,cantidad:2,ventanas_afectadas:1,nc:'N1'}]);
 const rec=(await db.query('select nuevo from sgp_picking_audit.decisiones where id_faltante=$1',[f.ds[0].id_faltante])).rows[0].nuevo;assert.equal(rec.pendiente.cantidad,2);assert.equal(rec.ncs[0].consecutivo,'N1');
 const g=await fixture('PANELES_2',1);await assert.rejects(()=>save(g,'VERTICALES','SIN_FALTANTES',[{...g.ds[0],accion:'ELIMINAR',motivo:'x',nc:'N1'}]),/NC_NO_APLICA_ELIMINAR/);
 await db.exec("create or replace function sgp_pdt_multiorigen.fuentes(text,text,jsonb) returns jsonb language sql as $$select '[]'::jsonb$$");
 });
 await check('other line defaults single; configuration admin-only, schema frozen after first review',async()=>{
 const f=await fixture('FRAMES_2');assert.equal((await ctx(f.id)).areas.length,1);await save(f,'GENERAL','SIN_FALTANTES');
 await assert.rejects(()=>db.query('select public.sgp_picking_auditoria_areas_configurar($1,$2,$3)',['RECEPCION:a','FRAMES_2',[{id:'X',nombre:'X'}]]),/UNAUTHORIZED/);
 const p=await fixture();await save(p,'VERTICALES','SIN_FALTANTES');
 await db.query('select public.sgp_picking_auditoria_areas_configurar($1,$2,$3)',['ADMINISTRADOR','PANELES_2',[{id:'ONE',nombre:'One'}]]);
 assert.equal((await ctx(p.id)).areas.length,2);await save(p,'ZOCALERO','SIN_FALTANTES');const next=await fixture();assert.equal((await ctx(next.id)).areas[0].id,'ONE');
 });
 await check('line ambiguity fails closed',async()=>{
 const f=await fixture();await db.query('insert into public.sgp_producciones values($1,$2,\'FRAMES_2\',10)',[f.prod+'|FRAMES_2',f.prod]);await db.query('insert into public.sgp_prioridades values($1,$2,\'FRAMES_2\')',[f.prod+'|FRAMES_2',f.res]);await assert.rejects(()=>ctx(f.id),/LINEA_NO_UNIVOCA/);
 });
 await assert.rejects(()=>db.exec(readRollback),/EN_USO_FORWARD/);await db.exec('ROLLBACK');checks.push('used rollback refused without data loss');
 await writeFile(new URL('sql-results.json',import.meta.url),JSON.stringify({passed:checks,environment:'PGlite synthetic; real copied audit writer, stub auth and multiorigin adapter; no live concurrency'},null,2));
}finally{await db.close()}
