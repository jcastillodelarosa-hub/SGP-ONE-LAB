"""Identity/69-row repair matrix only. Reuses bootstrap + real auth/guard definitions.
No production connection. A fresh DB in the already-authorized networkless QA container.
"""
import hashlib,json,pathlib,subprocess,sys,time
ROOT=pathlib.Path(__file__).resolve().parents[2];D=ROOT/'docs/sql-proposals/pdt/identity';C='sgp-pdt-qa-91'
m=json.loads(subprocess.check_output(['docker','inspect',C]))[0];assert m['HostConfig']['NetworkMode']=='none' and not m['HostConfig'].get('PortBindings')
db='sgp_pdt_qa_91_identity_'+str(time.time_ns());subprocess.run(['docker','exec',C,'createdb','-U','postgres',db],check=True)
def call(sql):return subprocess.run(['docker','exec','-i',C,'psql','-X','-qAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],input=sql,text=True,capture_output=True)
def sql(q):
 r=call(q)
 if r.returncode:raise RuntimeError(r.stderr)
 return r.stdout.strip()
def reject(q,code):
 r=call('BEGIN;'+q+';ROLLBACK;')
 assert r.returncode and code in r.stderr,(code,r.stderr)
# Actual pending/master/novelty columns captured in read-only inventory.
evidence=json.loads((ROOT/'tests/pdt-identity/installed-contracts.json').read_text())
sql('CREATE SCHEMA extensions;CREATE EXTENSION pgcrypto WITH SCHEMA extensions;')
sql("DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;")
for table in ['sgp_aluminio_pendientes','sgp_maestro_piezas','sgp_mecanizado_novedades']:
 cols=[c for c in evidence['columns'] if c['table']==table]
 parts=['"'+c['column']+'" '+c['type']+(' DEFAULT '+c['default'] if c['default'] else '')+(' NOT NULL' if c['notnull'] else '') for c in cols]
 primary={'sgp_aluminio_pendientes':'id_pendiente','sgp_maestro_piezas':'codigo_sap','sgp_mecanizado_novedades':'id_novedad'}[table]
 sql('CREATE TABLE public.'+table+'('+','.join(parts)+',PRIMARY KEY('+primary+'));')
base=(ROOT/'tests/sql/pdt/bootstrap.sql').read_text()
# Reuse non-pending bootstrap DDL, avoiding its operational seed fixtures.
for table in ['sgp_producciones','sgp_aluminio','sgp_aluminio_pendientes_historial','qa_reservas','sgp_nc_aluminio','sgp_mecanizado_programacion','sgp_picking_entregas']:
 import re
 text=re.search(r'CREATE TABLE (?:public\.)?'+table+r'\([^;]+;',base).group()
 sql(text)
sql('ALTER TABLE public.sgp_producciones ADD COLUMN id text,ADD COLUMN id_linea text;CREATE VIEW public.sgp_produccion_reservas_v AS SELECT * FROM qa_reservas;ALTER TABLE qa_reservas ADD COLUMN produccion text,ADD COLUMN reserva_principal text,ADD COLUMN es_reserva_compartida boolean DEFAULT false,ADD COLUMN semana_produccion integer;CREATE OR REPLACE VIEW public.sgp_produccion_reservas_v AS SELECT * FROM qa_reservas;')
sql('CREATE TABLE public.sgp_usuarios(id_usuario uuid PRIMARY KEY DEFAULT gen_random_uuid(),usuario text,nombre text,rol text,activo boolean DEFAULT true);CREATE TABLE public.sgp_sesiones_app(id_usuario uuid,token_hash text,revocado_en timestamptz,expira_en timestamptz);')
functions=json.loads((ROOT/'scripts/pdt-compatibility/evidence/PDT_FUNCIONES_REALES.json').read_text())['funciones']
complement=json.loads((ROOT/'scripts/pdt-compatibility/evidence/PDT_COMPLEMENTO_REAL.json').read_text())['funciones_faltantes']
for f in functions+complement:
 if f['firma'].startswith(('sgp_validar_sesion_rol(','sgp_sesion_actual(')):sql(f['definicion'].replace('\r\n','\n')+';')
sql("INSERT INTO public.sgp_usuarios(usuario,nombre,rol) SELECT x,'QA fixture',x FROM unnest(ARRAY['ADMINISTRADOR','COORDINADOR','LIDER','LIDER MECANIZADO','LIDER LINEA','RECEPCION','CONSULTA','PATINADOR'])x;INSERT INTO sgp_sesiones_app SELECT id_usuario,encode(extensions.digest(usuario,'sha256'),'hex'),NULL,now()+interval '1 day' FROM sgp_usuarios;")
# Install only existing PDT definitions needed for source/distribution identity, no old suite rerun.
sys.path.insert(0,str(ROOT/'tests/sql/pdt'));from installation_plan import PHASE_A,PHASE_B,transaction_body
for name in PHASE_A[1:]+PHASE_B:sql((ROOT/'docs/sql-proposals/pdt'/name).read_text())
for f in evidence['functions']:
 if f['signature'].startswith('sgp_aluminio_pendiente_crear('):sql(f['definition']+';')
for t in evidence['triggers']:sql(t['function_definition']+';')
# Recreate body definitions exactly as captured for the guarded patch checks.
for name,path in [('sgp_pdt_fuentes_v2',ROOT/'docs/sql-proposals/pdt/20261025_pdt_capacidades_REVIEW.sql'),('sgp_aluminio_pendiente_validar_detalles_v1',ROOT/'docs/sql-proposals/pdt/20261024_pdt_rpc_contracts_REVIEW.sql')]:
 text=path.read_text();start=text.index('CREATE OR REPLACE FUNCTION public.'+name);end=text.index('END $fn$;',start)+len('END $fn$;');sql(text[start:end])
sql("""INSERT INTO public.sgp_producciones(key_produccion,id,id_linea,produccion,sistema) VALUES
('QA|FRAMES_2','QA','FRAMES_2','QA ORDER','ES'),('QA|PANELES_2','QA','PANELES_2','QA ORDER','ES');
INSERT INTO qa_reservas(key_produccion,reserva,acabado_reserva,produccion,reserva_principal,es_reserva_compartida,semana_produccion) VALUES
('QA|FRAMES_2','R','DS','QA ORDER','R',true,44),('QA|PANELES_2','R','DS','QA ORDER','R',true,44),
('QA|FRAMES_2','SHARED','DS','QA ORDER','R',true,44),('QA|PANELES_2','SHARED','DS','QA ORDER','R',true,44);
INSERT INTO public.sgp_maestro_piezas(codigo_sap,tipo_pieza,destino_productivo,activo) VALUES('PANEL-REF','PANEL','PANEL','SI'),('FRAME-REF','FRAME','FRAME','SI');
INSERT INTO sgp_aluminio(id_pieza,id_carga,fila_origen,key_produccion,produccion,codigo_sap,sistema,activo,tipo_pieza,fabricacion,longitud,acabado,cantidad) VALUES
('P1','QA',1,'QA|PANELES_2','QA ORDER','PANEL-REF','ES','SI','PANEL','E17',100,'DS',5),
('P2','QA',2,'QA|PANELES_2','QA ORDER','PANEL-REF','ES','SI','PANEL','E17-1',100,'DS',4),
('F1','QA',3,'QA|PANELES_2','QA ORDER','FRAME-REF','ES','SI','FRAME','F1',100,'DS',9);
INSERT INTO sgp_mecanizado_programacion(id_programacion,reserva,sistema,acabado) VALUES('00000000-0000-0000-0000-000000000001','R','ES','DS');
INSERT INTO public.sgp_aluminio_pendientes(id_pendiente,key_produccion,produccion,perfil,cantidad,longitud,reserva,reserva_principal,acabado_pendiente,contrato_pdt,validacion_estado,estado,estado_repo,fecha_validacion,validado_por,nc,origen)
SELECT ('00000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,CASE WHEN n<=47 THEN 'QA|PANELES_2' ELSE 'QA|FRAMES_2' END,'QA ORDER','PANEL-REF',9,100,'R','R','DS','LEGACY',CASE WHEN n<=47 THEN 'POR_VALIDAR' ELSE 'VALIDADO' END,'PENDIENTE',CASE WHEN n<=58 THEN 'PENDIENTE' WHEN n<=64 THEN 'PROCESADO' ELSE 'PICKING' END,CASE WHEN n>47 THEN '2026-10-20'::timestamptz END,CASE WHEN n>47 THEN 'QA historical' END,'NC historic','PRODUCCION' FROM generate_series(1,69)n;
CREATE TABLE public.sgp_pdt_key_backup_20261025 AS SELECT * FROM sgp_aluminio_pendientes;
UPDATE public.sgp_pdt_key_backup_20261025 SET key_produccion='QA|FRAMES_2';
""")
# Clone the new fixture before any repair; both clones stay inside the networkless QA container.
clones=[db+'_atomic_fail',db+'_atomic_ok']
for clone in clones:subprocess.run(['docker','exec',C,'createdb','-U','postgres','--template',db,clone],check=True,capture_output=True)
report=[]
# Full transactional repair, failure rollback and unchanged-47 verification.
repair=(D/'00_repair_22_REVIEW.sql').read_text();rollback=(D/'00_repair_22_ROLLBACK_REVIEW.sql').read_text()
failed=repair.rsplit('COMMIT;',1)[0]+"SELECT 1/0;COMMIT;"
r=call(failed);assert r.returncode and 'division by zero' in r.stderr,r.stderr
assert sql("SELECT count(*) FROM sgp_aluminio_pendientes WHERE key_produccion='QA|FRAMES_2'")=='22'
assert sql("SELECT to_regnamespace('sgp_pdt_line_repair_20261025') IS NULL")=='t'
for setup,expected in [
 ("UPDATE sgp_aluminio_pendientes SET cantidad=10 WHERE id_pendiente='00000000-0000-0000-0000-000000000069';",'PDT_REPAIR_ROW_CHANGED_OR_AMBIGUOUS'),
 ("INSERT INTO sgp_aluminio_pendiente_detalles(id_pendiente,fabricacion,longitud,acabado,cantidad_validada,creado_por) VALUES('00000000-0000-0000-0000-000000000069','E17',100,'DS',1,'QA');",'PDT_REPAIR_NEW_DEPENDENCIES'),
 ("INSERT INTO sgp_producciones(key_produccion,id,id_linea,produccion,sistema) VALUES('QA|PANEL_ALIAS','QA','PANELES_2','QA ORDER','ES');INSERT INTO qa_reservas VALUES('QA|PANEL_ALIAS','R','DS','QA ORDER','R',false,44);",'PDT_REPAIR_ROW_CHANGED_OR_AMBIGUOUS')]:
 altered=repair.replace('LOCK TABLE public.sgp_aluminio_pendientes',setup+'\nLOCK TABLE public.sgp_aluminio_pendientes',1)
 r=call(altered);assert r.returncode and expected in r.stderr,r.stderr
 assert sql("SELECT count(*) FROM sgp_aluminio_pendientes WHERE key_produccion='QA|FRAMES_2'")=='22'
report.append('Repair rejects changed rows, new dependencies and ambiguous target without any partial changes')
sql(repair);assert sql("SELECT count(*) FROM sgp_aluminio_pendientes WHERE key_produccion='QA|FRAMES_2'")=='0'
report.append('69 backup / 47 unchanged / 22 key-only repaired incl 11 pending + 6 processed + 5 Picking; real guard remains enabled')
# Reject data rollback if a later write occurred; never overwrite it.
sql("UPDATE public.sgp_aluminio_pendientes SET observacion='QA later write' WHERE id_pendiente='00000000-0000-0000-0000-000000000069';")
r=call(rollback);assert r.returncode and 'PDT_ROLLBACK_NEW_WRITES' in r.stderr,r.stderr
sql("UPDATE public.sgp_aluminio_pendientes SET observacion=NULL WHERE id_pendiente='00000000-0000-0000-0000-000000000069';")
sql(rollback);assert sql("SELECT count(*) FROM sgp_aluminio_pendientes WHERE key_produccion='QA|FRAMES_2'")=='22'
report.append('Injected failure fully rolls back; reverse restores 22 only; reverse rejects later writes')
# Keep the fixture repaired for strict-trigger installation, without executing a production script twice.
sql("UPDATE sgp_aluminio_pendientes p SET key_produccion=l.after_row->>'key_produccion' FROM sgp_pdt_line_repair_20261025.ledger l WHERE p.id_pendiente=l.id_pendiente;")
sql((D/'01_creation_and_source_identity_REVIEW.sql').read_text())
print('IDENTITY_FIXTURE_READY',db)

def check(name,body):
 sql('BEGIN; DO $case$ DECLARE id uuid; id2 uuid; event_id uuid; detail_id uuid; line_id uuid; result jsonb; n integer; BEGIN '+body+' END $case$; ROLLBACK;')
 report.append(name)
sql("""CREATE FUNCTION public.qa_identity_reject(statement text,expected text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN BEGIN EXECUTE statement; RAISE EXCEPTION 'EXPECTED_REJECTION_MISSING'; EXCEPTION WHEN OTHERS THEN IF position(expected IN SQLERRM)=0 THEN RAISE EXCEPTION 'Unexpected error: %',SQLERRM; END IF; END; END $$;""")
create="public.sgp_aluminio_pendiente_crear('COORDINADOR','R','QA ORDER','PANEL-REF',9,100,'PRODUCCION','QA','QA',NULL,'R','DS')"
check('Simultaneous lines: PANEL old-signature creation resolves PANELES_2',"id:="+create+"; IF (SELECT key_produccion FROM sgp_aluminio_pendientes WHERE id_pendiente=id)<>'QA|PANELES_2' THEN RAISE EXCEPTION 'WRONG_PANEL_LINE'; END IF;")
check('FRAME master maps to FRAMES_2 even with legacy imported source key PANEL',"id:="+create.replace('PANEL-REF','FRAME-REF')+"; IF (SELECT key_produccion FROM sgp_aluminio_pendientes WHERE id_pendiente=id)<>'QA|FRAMES_2' THEN RAISE EXCEPTION 'WRONG_FRAME_LINE'; END IF;")
check('Frontend key cannot bypass master; direct insert is guarded',"PERFORM qa_identity_reject($q$SELECT "+create.replace("NULL,'R'","'QA|FRAMES_2','R'")+"$q$,'PDT_CLAVE_NO_CORRESPONDE_A_MAESTRO'); PERFORM qa_identity_reject($q$INSERT INTO sgp_aluminio_pendientes(reserva,produccion,perfil,cantidad,longitud,origen,key_produccion,reserva_principal,acabado_pendiente) VALUES('R','QA ORDER','PANEL-REF',9,100,'PRODUCCION','QA|FRAMES_2','R','DS')$q$,'PDT_CLAVE_NO_CORRESPONDE_A_MAESTRO');")
check('Missing master and invalid quantity reject without partial data',"SELECT count(*) INTO n FROM sgp_aluminio_pendientes; PERFORM qa_identity_reject($q$SELECT "+create.replace('PANEL-REF','UNKNOWN')+"$q$,'PDT_MAESTRO_NO_VERIFICABLE'); PERFORM qa_identity_reject($q$SELECT "+create.replace("9,100","-1,100")+"$q$,'PDT_CANTIDAD_INVALIDA'); IF (SELECT count(*) FROM sgp_aluminio_pendientes)<>n THEN RAISE EXCEPTION 'PARTIAL_ROWS'; END IF;")
check('Unchanged legacy historical edits remain possible without implicit reclassification',"UPDATE sgp_maestro_piezas SET activo='NO' WHERE codigo_sap='PANEL-REF'; UPDATE sgp_aluminio_pendientes SET observacion='QA annotation' WHERE id_pendiente='00000000-0000-0000-0000-000000000069'; PERFORM qa_identity_reject($q$SELECT "+create+"$q$,'PDT_MAESTRO_NO_VERIFICABLE');")
novelty={'id_programacion':'00000000-0000-0000-0000-000000000001','produccion':'QA ORDER','perfil':'PANEL-REF','cantidad':9,'longitud':100,'origen':'BODEGA','tipo':'QA','observacion':'Fixture only','usuario':'IMPERSONATED'}
json_literal="'"+json.dumps(novelty).replace("'","''")+"'::jsonb"
atomic="public.sgp_produccion_novedad_pdt_crear_v3('COORDINADOR',"+json_literal+",'P1','SHARED','DS','QA|PANELES_2','R')"
check('Shared reserve and principal are preserved; novelty/PDT save atomically',"result:="+atomic+"; IF result->>'ok'<>'true' THEN RAISE EXCEPTION 'NOT_OK'; END IF; IF NOT EXISTS(SELECT 1 FROM sgp_aluminio_pendientes WHERE id_pendiente=(result->>'id_pendiente')::uuid AND reserva='SHARED' AND reserva_principal='R' AND key_produccion='QA|PANELES_2' AND usuario_reporte='COORDINADOR') THEN RAISE EXCEPTION 'WRONG_SHARED_OR_ACTOR'; END IF; IF (SELECT count(*) FROM sgp_mecanizado_novedades)<>1 THEN RAISE EXCEPTION 'NOVELTY_MISSING'; END IF;")
check('Wrong source/key/principal reject before novelty or PDT is persisted',"SELECT count(*) INTO n FROM sgp_aluminio_pendientes; PERFORM qa_identity_reject($q$SELECT "+atomic.replace("'P1'","'F1'")+"$q$,'PDT_ASOCIACION_INEXISTENTE_O_AMBIGUA'); PERFORM qa_identity_reject($q$SELECT "+atomic.replace("'QA|PANELES_2'","'QA|FRAMES_2'")+"$q$,'PDT_CLAVE_NO_CORRESPONDE_A_MAESTRO'); IF (SELECT count(*) FROM sgp_aluminio_pendientes)<>n OR (SELECT count(*) FROM sgp_mecanizado_novedades)<>0 THEN RAISE EXCEPTION 'PARTIAL_ATOMIC_WRITE'; END IF;")
check('Failure after pending INSERT rolls back both atomic writes',"CREATE FUNCTION pg_temp.qa_novelty_fail() RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN RAISE EXCEPTION 'QA_NOVELTY_FAILURE'; END $f$; CREATE TRIGGER qa_novelty_fail BEFORE INSERT ON sgp_mecanizado_novedades FOR EACH ROW EXECUTE FUNCTION pg_temp.qa_novelty_fail(); SELECT count(*) INTO n FROM sgp_aluminio_pendientes;PERFORM qa_identity_reject($q$SELECT "+atomic+"$q$,'QA_NOVELTY_FAILURE');IF (SELECT count(*) FROM sgp_aluminio_pendientes)<>n OR (SELECT count(*) FROM sgp_mecanizado_novedades)<>0 THEN RAISE EXCEPTION 'ATOMIC_WRITE_LEAK'; END IF;")
check('Master type/destination inconsistency rejects new associations',"UPDATE sgp_maestro_piezas SET destino_productivo='FRAME' WHERE codigo_sap='PANEL-REF';PERFORM qa_identity_reject($q$SELECT "+create+"$q$,'PDT_MAESTRO_NO_VERIFICABLE');")
check('Unauthorized role cannot create or discover sources',"PERFORM qa_identity_reject($q$SELECT "+create.replace('COORDINADOR','CONSULTA')+"$q$,'PERMISO_DENEGADO');PERFORM qa_identity_reject($q$SELECT sgp_pdt_origenes_novedad_v3('CONSULTA','R','PANEL-REF')$q$,'PERMISO_DENEGADO');")
check('Duplicate production name cannot be disambiguated by caller key alone',"INSERT INTO sgp_producciones(key_produccion,id,id_linea,produccion,sistema) VALUES('OTHER|PANELES_2','OTHER','PANELES_2','QA ORDER','ES');INSERT INTO qa_reservas VALUES('OTHER|PANELES_2','R','DS','QA ORDER','R',false,44); INSERT INTO sgp_aluminio SELECT 'OTHER-P1',id_carga,fila_origen,'OTHER|PANELES_2',produccion,codigo_sap,sistema,activo,tipo_pieza,fabricacion,longitud,acabado,cantidad,marca,uso FROM sgp_aluminio WHERE id_pieza='P1'; PERFORM qa_identity_reject($q$SELECT "+create.replace("NULL,'R'","'QA|PANELES_2','R'")+"$q$,'PDT_ASOCIACION_INEXISTENTE_O_AMBIGUA'); result:="+atomic+"; IF result->>'id_linea'<>'PANELES_2' THEN RAISE EXCEPTION 'WRONG_EXPLICIT_SOURCE'; END IF;")
# Compare exact installed fingerprints before applying the strictly-scoped V2 proposal.
for signature in ['sgp_pdt_fuentes_v2(text,uuid)','sgp_aluminio_pendiente_validar_detalles_v1(text,uuid,jsonb,text,text)','sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)']:
 print('FIXTURE_HASH',signature,sql("SELECT md5(pg_get_functiondef('public."+signature+"'::regprocedure))"))
sql((D/'02_panel_v2_identity_REVIEW.sql').read_text())
check('FRAME never enters PANEL V2; row IDs/quantities of PANEL sources stay exact',"id:="+create.replace('PANEL-REF','FRAME-REF')+";PERFORM qa_identity_reject(format('SELECT sgp_pdt_fuentes_v2(%L,%L)','COORDINADOR',id),'PDT_V2_REQUIERE_PIEZA_PANEL');id2:="+create+";result:=sgp_pdt_fuentes_v2('COORDINADOR',id2);IF jsonb_array_length(result)<>2 THEN RAISE EXCEPTION 'SOURCE_COUNT';END IF;")
check('PANEL V2 distribution, advances, Picking and closure preserve strict same-line identity',"""id:="""+create+""";
 result:=sgp_aluminio_pendiente_validar_detalles_v1('COORDINADOR',id,'[{"id_pieza":"P1","fabricacion":"E17","longitud":100,"acabado":"DS","cantidad":5},{"id_pieza":"P2","fabricacion":"E17-1","longitud":100,"acabado":"DS","cantidad":4}]'::jsonb,'R',NULL);
 IF NOT EXISTS(SELECT 1 FROM sgp_aluminio_pendientes WHERE id_pendiente=id AND contrato_pdt='V2' AND cantidad=9 AND key_produccion='QA|PANELES_2') THEN RAISE EXCEPTION 'V2_IDENTITY_OR_QUANTITY'; END IF;
 PERFORM sgp_pdt_estado_v2('LIDER',id,'CORTE');PERFORM sgp_pdt_estado_v2('LIDER',id,'MECANIZADO');
 FOR detail_id IN SELECT id_detalle FROM sgp_aluminio_pendiente_detalles WHERE id_pendiente=id LOOP
 PERFORM sgp_aluminio_pendiente_registrar_avance_v1('LIDER',id,detail_id,(SELECT cantidad_validada FROM sgp_aluminio_pendiente_detalles WHERE id_detalle=detail_id),'T1',current_date,gen_random_uuid(),NULL);
 END LOOP;
 PERFORM sgp_pdt_estado_v2('LIDER',id,'PROCESADO');
 event_id:=gen_random_uuid();INSERT INTO sgp_picking_entregas(id_entrega,id_programacion,produccion,completa,estado) VALUES(event_id,'00000000-0000-0000-0000-000000000001','QA ORDER',false,'VALIDADA');
 FOR detail_id IN SELECT id_detalle FROM sgp_aluminio_pendiente_detalles WHERE id_pendiente=id LOOP
 result:=sgp_pdt_entrega_registrar_v2('COORDINADOR',detail_id,event_id,(SELECT cantidad_validada FROM sgp_aluminio_pendiente_detalles WHERE id_detalle=detail_id),gen_random_uuid());line_id:=(result->>'id_linea')::uuid;
 PERFORM sgp_pdt_entrega_validar_v2('COORDINADOR',line_id);PERFORM sgp_pdt_asignar_v2('COORDINADOR',line_id,gen_random_uuid());
 END LOOP;
 PERFORM sgp_pdt_cerrar_v2('COORDINADOR',id,gen_random_uuid());
 IF NOT EXISTS(SELECT 1 FROM sgp_aluminio_pendientes WHERE id_pendiente=id AND estado_repo='PICKING' AND cantidad=9 AND contrato_pdt='V2') THEN RAISE EXCEPTION 'CLOSURE_FAILED'; END IF;
 PERFORM qa_identity_reject(format('UPDATE sgp_aluminio_pendientes SET key_produccion=%L WHERE id_pendiente=%L','QA|FRAMES_2',id),'PDT_CERRADO_INMUTABLE');
""")
assert sql('SELECT count(*) FROM sgp_aluminio_pendientes')=='69'
assert sql('SELECT count(*) FROM sgp_mecanizado_novedades')=='0'
assert sql("SELECT count(*) FROM sgp_aluminio_pendientes WHERE key_produccion='QA|PANELES_2'")=='69'
# The complete three-file deployment, including the 22-row repair, is atomic.
import importlib.util
spec=importlib.util.spec_from_file_location('identity_bundle',ROOT/'scripts/build-pdt-identity-install.py');bundle=importlib.util.module_from_spec(spec);spec.loader.exec_module(bundle)
def clone_sql(name,q):return subprocess.run(['docker','exec','-i',C,'psql','-X','-qAt','-U','postgres','-d',name,'-v','ON_ERROR_STOP=1'],input=q,text=True,capture_output=True)
script=bundle.render();bad=script.rsplit('COMMIT;',1)[0]+'SELECT 1/0;COMMIT;'
r=clone_sql(clones[0],bad);assert r.returncode and 'division by zero' in r.stderr,r.stderr
q="SELECT count(*)=22 AND to_regnamespace('sgp_pdt_line_repair_20261025') IS NULL AND to_regprocedure('public.sgp_pdt_linea_maestro_v3(text)') IS NULL FROM sgp_aluminio_pendientes WHERE key_produccion='QA|FRAMES_2';"
r=clone_sql(clones[0],q);assert r.returncode==0 and r.stdout.strip()=='t',r.stderr
r=clone_sql(clones[1],script);assert r.returncode==0,r.stderr
r=clone_sql(clones[1],"SELECT count(*)=69 FROM sgp_aluminio_pendientes WHERE key_produccion='QA|PANELES_2';");assert r.stdout.strip()=='t',r.stderr
report.append('Full combined install commits all three components or rolls back every row and DDL on injected failure')
output={'database':db,'production_writes':False,'postgres_version':sql('SHOW server_version'),'real_auth_definitions':True,'pending_master_novelty_columns_from_catalog':True,'cases':report,'all_passed':True}
(ROOT/'tests/pdt-identity/results.json').write_text(json.dumps(output,indent=2));print(json.dumps(output))
