// Local PostgreSQL WASM only. No production URL or data.
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();let checks=0;
const sql=async q=>(await db.query(q)).rows;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const denied=async(q,pattern)=>{await assert.rejects(()=>db.query(q),pattern);checks++;};
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
CREATE TABLE sgp_producciones(id text,key_produccion text primary key);
CREATE TABLE sgp_accesorios(codigo_sap text,descripcion text,id text,key_produccion text,estado_relacion_produccion text,activo text);
CREATE FUNCTION sgp_validar_sesion_rol(token text,roles text[]) RETURNS text LANGUAGE plpgsql AS $$ BEGIN IF token='admin' AND 'ADMINISTRADOR'=ANY(roles) THEN RETURN 'fixture-admin'; END IF; RAISE EXCEPTION 'PERMISO_DENEGADO'; END $$;
CREATE FUNCTION fixture_source(token text) RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN IF token NOT IN ('admin','viewer') THEN RAISE EXCEPTION 'SOURCE_ACL_DENIED'; END IF;
 RETURN '{"filas":[{"key_produccion":"1|PANELES_2"},{"key_produccion":"1|FRAMES_2"},{"key_produccion":"2|PANELES_2"}],"catalog":{"productions":[{"key":"1|PANELES_2","oficial":{"key_produccion":"1|PANELES_2"}}]}}'; END $$;
CREATE FUNCTION sgp_consultar_ensamble(text,integer,text) RETURNS jsonb LANGUAGE sql AS $$ SELECT public.fixture_source($1) $$;
CREATE FUNCTION sgp_lp_seguimiento_consultar(text,text,text) RETURNS jsonb LANGUAGE sql AS $$ SELECT public.fixture_source($1) $$;
CREATE FUNCTION sgp_lp_operacion_consultar(text,text,text,date,integer) RETURNS jsonb LANGUAGE sql AS $$ SELECT public.fixture_source($1) $$;
CREATE FUNCTION sgp_linea_plan_consultar(text,date,date,text) RETURNS jsonb LANGUAGE sql AS $$ SELECT public.fixture_source($1) $$;
CREATE FUNCTION sgp_mecanizado_disponibles(text,integer) RETURNS TABLE(ordenes jsonb,reserva text) LANGUAGE sql AS $$ SELECT public.fixture_source($1)->'filas','fixture'::text $$;
INSERT INTO sgp_producciones VALUES('1','1|PANELES_2'),('1','1|FRAMES_2'),('2','2|PANELES_2'),('hidden','hidden|PANELES_2');
INSERT INTO sgp_accesorios VALUES
('A','Synthetic A','1',NULL,'RELACIONADO','SI'),('A','duplicate','1',NULL,'RELACIONADO','SI'),
('B','line-only','1','1|PANELES_2','RELACIONADO','SI'),('A0','not prefix','2',NULL,'RELACIONADO','SI'),
('A','unrelated',NULL,NULL,'SIN_RELACION','SI'),('A','inactive','2',NULL,'RELACIONADO','NO'),
('A','conflicting line','2','1|PANELES_2','RELACIONADO','SI'),('SECRET','hidden','hidden',NULL,'RELACIONADO','SI');`);
const file=(await readdir('supabase/migrations')).find(x=>x.endsWith('_accessory_alert_rules.sql'));
await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
await db.exec('SET ROLE anon');
await denied("select * from sgp_accessory_alerts.rules",/permission denied/);
await denied("select sgp_accessory_alerts.decorate('{}','{}')",/permission denied/);
await denied("select sgp_alertas_accesorio_catalogo('viewer')",/PERMISO_DENEGADO/);
await denied("select sgp_alertas_accesorio_guardar('viewer','A','BAD',true,0)",/PERMISO_DENEGADO/);
await denied("select sgp_alertas_accesorio_guardar('admin','G05','EXAMPLE',true,0)",/ACCESORIO_INEXISTENTE/);
await denied("select sgp_alertas_accesorio_guardar('admin','A',' ',true,0)",/DATOS_INVALIDOS/);
await denied("select sgp_alertas_accesorio_guardar('admin','A',repeat('x',501),true,0)",/DATOS_INVALIDOS/);
let catalog=(await sql("select sgp_alertas_accesorio_catalogo('admin') x"))[0].x;
ok(catalog.length===4&&catalog.every(r=>r.revision===0),'catalog lists actual codes with no seeded rules');
for(const code of ['A','B','SECRET'])await sql(`select sgp_alertas_accesorio_guardar('admin','${code}','Notice ${code}',true,0)`);
const read=async(source='sgp_consultar_ensamble',token='viewer',extra={})=>(await db.query('select sgp_alertas_accesorio_consultar($1,$2,$3) x',[token,source,JSON.stringify({p_linea:'PANELES_2',p_etapa:'ENSAMBLE',p_fecha:'2026-11-14',p_turno:1,...extra})])).rows[0].x;
let data=await read();ok(data.filas[0].accessory_alerts.length===2,'cumulative, repeated accessory deduplicated');ok(data.filas[1].accessory_alerts.length===1,'null key applies to both lines, explicit key only selected line');ok(data.filas[2].accessory_alerts.length===0,'exact code + ID + line rejects prefixes, inactive and conflicting relationship');ok(!JSON.stringify(data).includes('SECRET'),'hidden order cannot leak');ok(data.catalog.productions[0].oficial.accessory_alerts.length===2,'nested catalog enriched');
for(const source of ['sgp_lp_seguimiento_consultar','sgp_lp_operacion_consultar','sgp_linea_plan_consultar'])ok((await read(source)).filas[0].accessory_alerts.length===2,source);
ok((await read('sgp_mecanizado_disponibles'))[0].ordenes[0].accessory_alerts.length===2,'programming table return enriched');
ok(!JSON.stringify(await read(undefined,undefined,{keys:['hidden|PANELES_2']})).includes('SECRET'),'caller cannot add authorized keys');
await denied("select sgp_alertas_accesorio_consultar('revoked','sgp_consultar_ensamble','{}')",/SOURCE_ACL_DENIED/);
await denied("select sgp_alertas_accesorio_consultar('admin','sgp_login','{}')",/FUENTE_INVALIDA/);
await denied("select sgp_alertas_accesorio_guardar('admin','A','duplicate',true,0)",/REGLA_MODIFICADA_RECARGAR/);
await sql("select sgp_alertas_accesorio_guardar('admin','A','Edited',true,1)");ok((await read()).filas[0].accessory_alerts[0].mensaje==='Edited','edit takes effect');
await denied("select sgp_alertas_accesorio_guardar('admin','A','stale',false,1)",/REGLA_MODIFICADA_RECARGAR/);
await sql("select sgp_alertas_accesorio_guardar('admin','A','Edited',false,2)");ok((await read()).filas[0].accessory_alerts.length===1,'disable takes effect');
await sql("select sgp_alertas_accesorio_guardar('admin','A','Edited',true,3)");ok((await read()).filas[0].accessory_alerts.length===2,'reactivation');
await db.exec('RESET ROLE');
// Test rollback guard directly in transaction, then clear synthetic data and execute full rollback.
const rollback=await readFile('docs/accessory-alerts/ROLLBACK_REVIEW.sql','utf8');
await assert.rejects(()=>db.exec(rollback),/RULES_EXIST/);checks++;await db.exec('ROLLBACK');
await db.exec('DELETE FROM sgp_accessory_alerts.rules');await db.exec(rollback);checks++;
const result={environment:'PGlite 0.3.14 isolated PostgreSQL, synthetic source ACL fixtures',checks,pass:true,limitations:'Tests actual new migration. Existing source RPC bodies are ACL fixtures; no hosted session or production migration tested.'};
console.log(result);await writeFile('tests/accessory-alerts/sql-result.json',JSON.stringify(result,null,2)+'\n');await db.close();
