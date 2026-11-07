// Reuses the scoped synthetic setup and captured authorization sources of INCORPORAR.
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {readFile} from 'node:fs/promises';
const ROOT=new URL('../../',import.meta.url),read=p=>readFile(new URL(p,ROOT),'utf8');
export async function bootstrap(){
 const db=new PGlite({extensions:{pgcrypto}});await db.waitReady;
 const sql=q=>db.exec(q),identity='public.sgp_lp_operacion_consultar(text,text,text,date,integer)';
 await sql(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA extensions;CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
 CREATE TABLE public.sgp_usuarios(id_usuario uuid PRIMARY KEY DEFAULT gen_random_uuid(),usuario text UNIQUE,nombre text,rol text,activo boolean DEFAULT true);
 CREATE TABLE public.sgp_sesiones_app(id_usuario uuid,token_hash text,revocado_en timestamptz,expira_en timestamptz);
 CREATE TABLE public.sgp_rol_accesos(rol text,ventana text,permitido boolean,PRIMARY KEY(rol,ventana));
 CREATE TABLE public.sgp_usuario_accesos(id_usuario uuid,ventana text,permitido boolean,PRIMARY KEY(id_usuario,ventana));
 CREATE TABLE public.sgp_producciones(key_produccion text PRIMARY KEY,produccion text,id_linea text,sistema text,reserva_al text,cantidad numeric,activa text DEFAULT 'SI',estado_produccion text DEFAULT 'QA',anio integer,semana_base integer,semana_actual integer,saldos_inicializados boolean,presente_ultimo_export boolean,saldo_ensamble numeric,saldo_empaque numeric,ensamblado numeric,empacado numeric,ultima_carga_diaria uuid,ultima_vez_export timestamptz);
 CREATE TABLE public.sgp_linea_plan_asignaciones(id uuid PRIMARY KEY,key_produccion text REFERENCES public.sgp_producciones,fecha date,turno int,cantidad int,prioridad int,estado text,origen_id uuid,observacion text);
 CREATE TABLE public.sgp_configuracion_general(clave text PRIMARY KEY,valor jsonb);
 INSERT INTO public.sgp_configuracion_general VALUES('HORARIOS_TURNOS','{"lunes_sabado":{"turno1":{"inicio":"07:00","fin":"19:00"},"turno2":{"inicio":"19:00","fin":"07:00"}},"domingo":{"turno1":{"inicio":"07:00","fin":"18:00"},"turno2":{"inicio":"18:00","fin":"05:00"}}}');`);
 await sql(await read('tests/lp01-hoja/base-fixture.sql'));
 await sql(`ALTER TABLE sgp_lp_operacion.permisos ADD COLUMN valid_from timestamptz,ADD COLUMN valid_until timestamptz,ADD COLUMN duty text,ADD COLUMN revoked_at timestamptz;
 CREATE TABLE sgp_lp_operacion.perfil_roles(id boolean PRIMARY KEY,habilitado boolean);INSERT INTO sgp_lp_operacion.perfil_roles VALUES(true,true);`);
 for(const f of ['sgp_sesion_actual','periodo','siguiente','ambito_vigente','operaciones_rol','acceso_rol','puede_operar','permisos_en_periodo','contener_ambitos','sesion','verificar_temporal','continuidad','cierre_valido','apertura_preparada','turno_vacio','sgp_lp_operacion_consultar'])await sql(await read('tests/lp01-hoja/production-readonly/'+f+'.sql'));
 await sql(`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sgp_lp_operacion FROM PUBLIC,anon,authenticated,service_role;
 REVOKE ALL ON FUNCTION ${identity} FROM PUBLIC;GRANT EXECUTE ON FUNCTION ${identity} TO anon,authenticated,service_role;
 ALTER TABLE public.sgp_rol_accesos ENABLE ROW LEVEL SECURITY;ALTER TABLE public.sgp_usuario_accesos ENABLE ROW LEVEL SECURITY;
 DO $$DECLARE t record;BEGIN FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='sgp_lp_operacion' LOOP EXECUTE format('ALTER TABLE sgp_lp_operacion.%I ENABLE ROW LEVEL SECURITY',t.tablename);END LOOP;END $$;
 INSERT INTO public.sgp_usuarios(usuario,nombre,rol) VALUES('leader','QA leader','LIDER LINEA'),('ensamble','QA assembly','SUPERVISOR ENSAMBLE'),('empaque','QA packing','SUPERVISOR EMPAQUE'),('viewer','QA viewer','CONSULTA'),('receiver','QA receiver','RECEPCION');
 INSERT INTO public.sgp_sesiones_app SELECT id_usuario,encode(extensions.digest(usuario,'sha256'),'hex'),NULL,now()+interval '1 day' FROM public.sgp_usuarios;
 INSERT INTO public.sgp_rol_accesos SELECT rol,'ensamble',true FROM public.sgp_usuarios;
 INSERT INTO public.sgp_usuario_accesos SELECT id_usuario,'ensamble',true FROM public.sgp_usuarios;
 INSERT INTO public.sgp_producciones(key_produccion,produccion,id_linea,sistema,reserva_al,cantidad,anio,semana_base,semana_actual,saldos_inicializados,presente_ultimo_export,saldo_ensamble,saldo_empaque,ensamblado,empacado,ultima_carga_diaria,ultima_vez_export)
 SELECT key,'QA SAME NAME',ln,'QA SYSTEM','QA RESERVE',10,2026,44,45,true,true,balance,10,10-balance,0,gen_random_uuid(),'2026-11-07 10:00Z' FROM (VALUES ('OPEN|PANELES_2','PANELES_2',5),('PLAN|PANELES_2','PANELES_2',10),('OTHER|PANELES_2','PANELES_2',10),('DONE|PANELES_2','PANELES_2',0),('MISSING|PANELES_2','PANELES_2',7),('OTHER|FRAMES_2','FRAMES_2',10)) x(key,ln,balance);
 UPDATE public.sgp_producciones SET presente_ultimo_export=false WHERE key_produccion='MISSING|PANELES_2';
 INSERT INTO public.sgp_linea_plan_asignaciones VALUES
 ('00000000-0000-0000-0000-000000000001','PLAN|PANELES_2','2026-11-07',1,6,1,'PROGRAMADA',NULL,'QA split1'),
 ('00000000-0000-0000-0000-000000000002','PLAN|PANELES_2','2026-11-07',1,4,2,'PROGRAMADA',NULL,'QA split2'),
 ('00000000-0000-0000-0000-000000000003','OTHER|PANELES_2','2026-11-07',1,2,3,'CANCELADA',NULL,'QA cancelled'),
 ('00000000-0000-0000-0000-000000000004','OTHER|PANELES_2','2026-11-07',2,3,1,'PROGRAMADA',NULL,'QA other shift'),
 ('00000000-0000-0000-0000-000000000005','OTHER|FRAMES_2','2026-11-07',1,10,1,'PROGRAMADA',NULL,'QA other line');`);
 await sql(`ALTER TABLE public.sgp_linea_plan_asignaciones ADD COLUMN creado_por text;
 ALTER TABLE sgp_lp_operacion.auditoria ADD COLUMN rol_efectivo text,ADD COLUMN responsabilidad_servidor text;`);
 const originalBase=await read('tests/lp01-hoja/base-fixture.sql');
 // Pure balance guard copied unchanged from the known SQL01 baseline.
 await sql(`CREATE FUNCTION sgp_lp_operacion.saldo(k text,et text) RETURNS bigint LANGUAGE plpgsql SET search_path='' AS $$
DECLARE p jsonb;v bigint; BEGIN SELECT to_jsonb(x) INTO p FROM public.sgp_producciones x WHERE x.key_produccion=k;
 IF p->>'saldos_inicializados' IS DISTINCT FROM 'true' OR p->>'presente_ultimo_export' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'EXPORT_NO_VALIDADO'; END IF;
 IF (p->>CASE WHEN et='ENSAMBLE' THEN 'saldo_ensamble' ELSE 'saldo_empaque' END)::numeric <> trunc((p->>CASE WHEN et='ENSAMBLE' THEN 'saldo_ensamble' ELSE 'saldo_empaque' END)::numeric) THEN RAISE EXCEPTION 'SALDO_NO_ENTERO'; END IF;
 v:=(p->>CASE WHEN et='ENSAMBLE' THEN 'saldo_ensamble' ELSE 'saldo_empaque' END)::bigint;
 IF v IS NULL OR v<0 THEN RAISE EXCEPTION 'SALDO_OFICIAL_INVALIDO'; END IF; RETURN v; END $$;`);
 for(const f of ['puede_operar','admitir','confirmar_ambito','auditar_rol','sgp_lp_operacion_comando','sgp_lp_operacion_resultado'])await sql(await read('tests/lp01-incorporar/production-readonly/'+f+'.sql'));
 await sql(`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sgp_lp_operacion FROM PUBLIC,anon,authenticated,service_role;
 REVOKE ALL ON FUNCTION public.sgp_lp_operacion_comando(text,jsonb),public.sgp_lp_operacion_resultado(text,uuid) FROM PUBLIC;
 GRANT EXECUTE ON FUNCTION public.sgp_lp_operacion_comando(text,jsonb),public.sgp_lp_operacion_resultado(text,uuid) TO anon,authenticated,service_role;
 CREATE TRIGGER audit_role BEFORE INSERT ON sgp_lp_operacion.auditoria FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.auditar_rol();
 CREATE CONSTRAINT TRIGGER confirm_scope AFTER INSERT ON sgp_lp_operacion.auditoria DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.confirmar_ambito();
 INSERT INTO public.sgp_usuarios(usuario,nombre,rol) VALUES('coordinator','QA coordinator','COORDINADOR'),('admin','QA admin','ADMINISTRADOR');
 INSERT INTO public.sgp_sesiones_app SELECT id_usuario,encode(extensions.digest(usuario,'sha256'),'hex'),NULL,now()+interval '1 day' FROM public.sgp_usuarios WHERE usuario IN('coordinator','admin');
 INSERT INTO public.sgp_rol_accesos SELECT rol,'ensamble',true FROM public.sgp_usuarios WHERE usuario IN('coordinator','admin');
 INSERT INTO public.sgp_usuario_accesos SELECT id_usuario,'ensamble',true FROM public.sgp_usuarios WHERE usuario IN('coordinator','admin');
 UPDATE sgp_lp_operacion.config SET escrituras=true WHERE id;
 INSERT INTO sgp_lp_operacion.turnos(linea,etapa,fecha,turno) VALUES('PANELES_2','ENSAMBLE','2026-11-07',1);
 `);

 await sql(await read('docs/sql-proposals/lp01-incorporar/01_incorporar_REVIEW.sql'));
 await sql(await read('tests/lp01-export-import-v2/production-readonly/importar_xlsx.sql'));
 await sql(`REVOKE ALL ON FUNCTION public.sgp_lp_operacion_importar_xlsx(text,jsonb,text,text,jsonb) FROM PUBLIC,anon,authenticated;
 GRANT EXECUTE ON FUNCTION public.sgp_lp_operacion_importar_xlsx(text,jsonb,text,text,jsonb) TO service_role;
 GRANT EXECUTE ON FUNCTION public.sgp_sesion_actual(text) TO service_role;
 UPDATE sgp_lp_operacion.config SET formato_bi_aprobado=true WHERE id;
 UPDATE public.sgp_producciones SET produccion=split_part(key_produccion,'|',1) WHERE id_linea='PANELES_2';
 DELETE FROM public.sgp_linea_plan_asignaciones WHERE key_produccion='OTHER|PANELES_2';
 INSERT INTO sgp_lp_operacion.ordenes(linea,etapa,fecha,turno,key,parte,sale,ejecutado)
 SELECT 'PANELES_2','ENSAMBLE','2026-11-07',1,key_produccion,id,cantidad,999 FROM public.sgp_linea_plan_asignaciones WHERE key_produccion='PLAN|PANELES_2';
 INSERT INTO public.sgp_linea_plan_asignaciones(id,key_produccion,fecha,turno,cantidad,prioridad,estado) VALUES('00000000-0000-0000-0000-000000000010','OPEN|PANELES_2','2026-11-07',1,5,3,'PROGRAMADA');
 INSERT INTO sgp_lp_operacion.ordenes(linea,etapa,fecha,turno,key,parte,sale,ejecutado) VALUES('PANELES_2','ENSAMBLE','2026-11-07',1,'OPEN|PANELES_2','00000000-0000-0000-0000-000000000010',5,444);
 `);
 return db;
}
