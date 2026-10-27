"""Proposal ACK checks + empty-only rollback in networkless QA. No product backup."""
import pathlib,json,subprocess,time
R=pathlib.Path(__file__).resolve().parents[2];E=R/'tests/linea-stage2d/evidence';db=(E/'database.txt').read_text().strip();assert db.startswith('sgp_linea_d2_qa_') and db.removeprefix('sgp_linea_d2_qa_').isdigit()
meta=json.loads(subprocess.check_output(['docker','inspect','sgp-pdt-qa-91']))[0];assert meta['HostConfig']['NetworkMode']=='none' and not meta['HostConfig'].get('PortBindings')
def run(q,target=db):return subprocess.run(['docker','exec','-i','sgp-pdt-qa-91','psql','-XqAt','-U','postgres','-d',target,'-v','ON_ERROR_STOP=1'],input=q,text=True,capture_output=True)
def sql(q,target=db):
 r=run(q,target);assert r.returncode==0,r.stderr;return r.stdout.strip()
checks=[]
if sql("SELECT to_regclass('sgp_linea_d2.export_ack') IS NULL")=='t':sql((R/'docs/sql-proposals/linea-etapa2d/02_export_ack_REVIEW.sql').read_text())
q="INSERT INTO sgp_linea_d2.export_ack(carga,key,evento,disposition,source_ref,cut_revision,event_hash,usuario_servidor) SELECT 'QA-CUT-ONLY',key,id,'INCLUDED','QA-external-ack','1',md5(to_jsonb(e)::text),'QA-owner' FROM sgp_linea_b2.eventos e WHERE key='D2-PARTIAL' LIMIT 1;"
sql('BEGIN;'+q+'ROLLBACK;')
r=run('BEGIN;'+q.replace("SELECT 'QA-CUT-ONLY',key,id", "SELECT 'QA-CUT-ONLY','D2-FULL',id")+'COMMIT;');assert r.returncode and 'ACK_EVENTO_AJENO' in r.stderr
checks.append('Proposed ACK binds immutable event hash/key; foreign production rejected, no official cut changed')
sql((R/'docs/linea-etapa2d/PICKING_FIELDS_READONLY.sql').read_text())
checks.append('Targeted Picking catalog query parses under READ ONLY in QA, no operational rows exported')
# Pin NEW functions for empty rollback. Empty-only rollback cannot erase history.
h=sql("SELECT md5(string_agg(pg_get_functiondef(p.oid),'' ORDER BY p.proname)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='sgp_linea_d2'")
undo="""-- REVIEW ONLY. Empty complement only; never delete operational/audit evidence.
BEGIN;
DO $check$ DECLARE t record;n bigint;BEGIN
 IF (SELECT md5(string_agg(pg_get_functiondef(p.oid),'' ORDER BY p.proname)) FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='sgp_linea_d2') IS DISTINCT FROM 'HASH' THEN RAISE EXCEPTION 'D2_ROLLBACK_CAMBIADO';END IF;
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='sgp_linea_d2' LOOP EXECUTE format('SELECT count(*) FROM sgp_linea_d2.%I',t.tablename) INTO n;IF n<>0 THEN RAISE EXCEPTION 'D2_ROLLBACK_CON_EVIDENCIA';END IF;END LOOP;
END$check$;
DROP TABLE sgp_linea_d2.export_ack,sgp_linea_d2.liberaciones,sgp_linea_d2.vinculos,sgp_linea_d2.unidades,sgp_linea_d2.cobertura,sgp_linea_d2.historial_fuente;
DROP FUNCTION sgp_linea_d2.verificar_ack(),sgp_linea_d2.invalidar(),sgp_linea_d2.impacto(text),sgp_linea_d2.huella_liberacion(uuid,uuid),sgp_linea_d2.asociar(text,text,uuid,uuid,uuid,text,text[],bigint,text,uuid,text),sgp_linea_d2.fuente(uuid,uuid,uuid);
DROP SCHEMA sgp_linea_d2;
COMMIT;
""".replace('HASH',h)
(R/'docs/sql-proposals/linea-etapa2d/ROLLBACK_REVIEW.sql').write_text(undo)
r=run(undo);assert r.returncode and 'D2_ROLLBACK_CON_EVIDENCIA' in r.stderr
checks.append('Rollback with source/mapping/history evidence refused, no deletion')
# A schema-only copy contains no productive data: validates empty rollback only.
empty='sgp_linea_d2_empty_'+str(time.time_ns());subprocess.run(['docker','exec','sgp-pdt-qa-91','createdb','-U','postgres',empty],check=True)
dump=subprocess.check_output(['docker','exec','sgp-pdt-qa-91','pg_dump','-U','postgres','-d',db,'--schema-only','--no-owner','--no-privileges'],text=True)
sql(dump,empty);before=sql("SELECT md5(prosrc) FROM pg_proc WHERE oid='public.sgp_picking_validar_recepcion(text,uuid,jsonb,jsonb,text)'::regprocedure",empty)
sql(undo,empty)
assert sql("SELECT to_regnamespace('sgp_linea_d2') IS NULL",empty)=='t'
assert sql("SELECT md5(prosrc) FROM pg_proc WHERE oid='public.sgp_picking_validar_recepcion(text,uuid,jsonb,jsonb,text)'::regprocedure",empty)==before
bad=run("BEGIN;ALTER TABLE public.sgp_picking_faltantes RENAME COLUMN ventanas_afectadas TO qa_incompatible;"+(R/'docs/sql-proposals/linea-etapa2d/01_unit_links_REVIEW.sql').read_text(),empty)
assert bad.returncode and 'D2_FUENTE_INCOMPATIBLE' in bad.stderr
assert sql("SELECT to_regnamespace('sgp_linea_d2') IS NULL",empty)=='t'
checks.append('Structural source mismatch stops installation atomically before creating D2 objects')
checks.append('Empty rollback removes only D2 objects; captured Picking validator fingerprint unchanged')
# Persistent containment from2C; do not remove reader/cache guards with live links.
sql("BEGIN;SELECT revision FROM sgp_linea_b2.producciones WHERE key='D2-PARTIAL' FOR UPDATE;UPDATE sgp_linea_c2.estado SET contenido=true WHERE key='D2-PARTIAL';SELECT sgp_linea_c2.invalidar('D2-PARTIAL','CONTENCION_D2');COMMIT;")
for _ in range(2):assert json.loads(sql("SELECT sgp_linea_c2.reconciliar('D2-PARTIAL')"))['status']=='SIN_CONCILIAR'
assert sql('SELECT count(*)>0 FROM sgp_linea_d2.vinculos')=='t'
checks.append('Persistent per-production containment survives retry and preserves immutable links/history')
out={'status':'PASS','database':db,'empty_database':empty,'checks':checks,'limits':['ACK is proposed, not a certified real Export ingestion','Schema-only QA copy is NOT a productive backup or restore verification']};(E/'recovery.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
