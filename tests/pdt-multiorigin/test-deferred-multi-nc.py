"""Focused regression for deferred multi-NC matching in networkless PG17."""
import json
import pathlib
import re
import subprocess
import time

ROOT = pathlib.Path(__file__).resolve().parents[2]
D = ROOT / "docs/sql-proposals/pdt/multiorigin"
C = "sgp-pdt-qa-91"
info = json.loads(subprocess.check_output(["docker", "inspect", C]))[0]
assert info["HostConfig"]["NetworkMode"] == "none"
assert not info["HostConfig"].get("PortBindings")
db = "sgp_nc_deferred_" + str(time.time_ns())
subprocess.run(["docker", "exec", C, "createdb", "-U", "postgres", db], check=True)


def psql(query):
    return subprocess.run(
        ["docker", "exec", "-i", C, "psql", "-X", "-qAt", "-U", "postgres",
         "-d", db, "-v", "ON_ERROR_STOP=1"],
        input=query, text=True, capture_output=True,
    )


def sql(query):
    result = psql(query)
    if result.returncode:
        raise AssertionError(result.stderr)
    return result.stdout.strip()


from fixture import prepare
prepare(ROOT, sql)
sql("""ALTER TABLE sgp_mecanizado_programacion ADD COLUMN estado text DEFAULT 'PROCESADO';
ALTER TABLE sgp_picking_entregas ALTER COLUMN id_entrega SET DEFAULT gen_random_uuid(),
 ADD COLUMN observacion text, ADD COLUMN usuario_entrega text,
 ADD COLUMN fecha_entrega timestamptz, ADD COLUMN fecha_operativa date,
 ADD COLUMN turno_entrega text;
CREATE TABLE sgp_picking_faltantes(
 id_faltante uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 id_entrega uuid REFERENCES sgp_picking_entregas,
 id_pieza text,produccion text,perfil text,marca text,fabricacion text,
 longitud numeric,cantidad numeric,observacion text,nc text,
 reserva_pendiente text,acabado_pendiente text);
CREATE SCHEMA sgp_pdt_compat_91;
CREATE FUNCTION public.sgp_picking_piezas_panel(
 p_token text,p_id_programacion uuid,p_produccion text) RETURNS jsonb LANGUAGE sql
 AS $$ SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]')
 FROM public.sgp_aluminio a JOIN public.sgp_maestro_piezas m
 ON m.codigo_sap=a.codigo_sap AND m.tipo_pieza='PANEL' AND m.activo='SI'
 JOIN public.sgp_mecanizado_programacion p ON p.id_programacion=p_id_programacion
 WHERE a.produccion=p_produccion AND a.sistema=p.sistema AND a.acabado=p.acabado $$;
UPDATE sgp_sesiones_app SET expira_en=now()+interval '1 day';
""")
functions = json.loads((ROOT / "scripts/pdt-compatibility/evidence/PDT_FUNCIONES_REALES.json").read_text())["funciones"]
for function in functions:
    if function["firma"] == "sgp_picking_entrega_orden(text,uuid,text,boolean,text,jsonb,date,text)":
        sql(function["definicion"].replace("public.sgp_picking_entrega_orden(", "sgp_pdt_compat_91.sgp_picking_entrega_orden("))
    if "rechazar_entrega_completa" in function["firma"]:
        sql(function["definicion"])
sql("CREATE TRIGGER trg_sgp_picking_no_duplicar_completa BEFORE INSERT ON sgp_picking_entregas FOR EACH ROW EXECUTE FUNCTION sgp_picking_rechazar_entrega_completa_duplicada();")
sql("UPDATE qa_reservas SET semana_produccion=45 WHERE key_produccion='QA|FRAMES_2';")
import importlib.util
spec = importlib.util.spec_from_file_location("legacy_matrix", ROOT / "tests/pdt-multiorigin/legacy-regression.py")
legacy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(legacy)
legacy.seed(ROOT, sql, functions)
sql((D / "01_multiorigin_REVIEW.sql").read_text())
cycle = (D / "02_canonical_lifecycle_REVIEW.sql").read_text()
fixture_hash = sql("SELECT md5(prosrc) FROM pg_proc WHERE oid='public.sgp_aluminio_pendiente_validar_detalles_v1(text,uuid,jsonb,text,text)'::regprocedure")
sql(cycle.replace("641227c7727bd9586b2ef20323a23791", fixture_hash))
sql((D / "03_multi_nc_REVIEW.sql").read_text())

# This fixture lacks the current live list RPC. Install its pinned, unchanged body
# from the rollback proposal before applying the corrective migration.
rollback = (D / "04_deferred_multi_nc_ROLLBACK_REVIEW.sql").read_text()
list_sql = re.search(
    r"CREATE OR REPLACE FUNCTION public\.sgp_aluminio_pendientes_listar_v2[\s\S]*?\$fn\$;",
    rollback,
)
assert list_sql
sql(list_sql.group())
assert sql("SELECT md5(prosrc) FROM pg_proc WHERE oid='public.sgp_aluminio_pendientes_listar_v2(text,boolean)'::regprocedure") == "e3e05984d915b2c3a1f55226719204d0"
proposal = (D / "04_deferred_multi_nc_REVIEW.sql").read_text()
failed = psql(proposal.replace("COMMIT;", "SELECT 1/0;COMMIT;"))
assert failed.returncode
assert sql("SELECT md5(prosrc) FROM pg_proc WHERE oid='sgp_pdt_multiorigen.registrar(text,text,jsonb,jsonb,uuid,uuid)'::regprocedure") == "c0af642cc10c1d391cc30d6f28b611c8"
sql(proposal)
assert sql("SELECT md5(prosrc) FROM pg_proc WHERE oid='public.sgp_aluminio_pendientes_listar_v2(text,boolean)'::regprocedure") == "ebc7e76a95408002b0c4b5e92ed4e70c"
sql(rollback)
sql(proposal)

ctx = {
    "id_programacion": "00000000-0000-0000-0000-000000000001",
    "produccion": "QA ORDER", "completa": False,
    "fecha_entrega": "2026-10-26", "turno": "TURNO 1",
    "key_produccion": "QA|PANELES_2", "reserva": "SHARED",
}
source = {
    "id_pieza": "P1", "key_produccion": "QA|PANELES_2",
    "reserva": "SHARED", "reserva_principal": "R", "perfil": "PANEL-REF",
    "fabricacion": "E17", "longitud": 100, "acabado": "DS",
    "cantidad": 1, "nc": "",
}


def literal(value):
    return "'" + json.dumps(value).replace("'", "''") + "'::jsonb"


def call(ncs, pieces=None, key="10000000-0000-0000-0000-000000000001"):
    piece = {**source, "nc": ncs[0] if ncs else ""}
    if len(ncs) > 1:
        piece["ncs"] = ncs
    return "public.sgp_pdt_registrar_v4('PATINADOR','PICKING'," + literal(ctx) + "," + literal(pieces or [piece]) + ",'" + key + "')"


def check(body):
    sql("BEGIN; DO $case$ DECLARE r jsonb; v_pending uuid; listing jsonb; BEGIN "
        + body + " END $case$; ROLLBACK;")


for count in (0, 1, 2, 20):
    refs = ["FUTURE-" + str(i) for i in range(1, count + 1)]
    check("r:=" + call(refs) + ";v_pending:=(r->'ids_pendientes'->>0)::uuid;"
          "IF (SELECT count(*) FROM sgp_aluminio_pendientes WHERE id_pendiente=v_pending AND cantidad=1)<>1"
          " OR (SELECT count(*) FROM sgp_picking_faltantes WHERE id_entrega=(r->>'id_entrega')::uuid)<>1"
          " OR (SELECT count(*) FROM sgp_aluminio_pendiente_ncs WHERE id_pendiente=v_pending)<>0"
          " OR (SELECT jsonb_array_length(datos_nuevos->'ncs') FROM sgp_aluminio_pendientes_historial WHERE id_pendiente=v_pending AND tipo_evento='REGISTRO_MULTIORIGEN_V4')<>"
          + str(count) + " THEN RAISE EXCEPTION 'BAD_PENDING';END IF;"
          "listing:=public.sgp_aluminio_pendientes_listar_v2('PATINADOR',true);"
          "IF (SELECT count(*) FROM jsonb_array_elements(listing->'pendientes') p,"
          "jsonb_array_elements(p->'ncs') n WHERE p->>'id_pendiente'=v_pending::text)<>"
          + str(count) + " THEN RAISE EXCEPTION 'BAD_LIST';END IF;"
          "IF " + call(refs) + "->>'duplicado'<>'true' THEN RAISE EXCEPTION 'RETRY_FAILED';END IF;")

check("r:=" + call(["1004733", "104628"]) + ";v_pending:=(r->'ids_pendientes'->>0)::uuid;"
      "INSERT INTO sgp_nc_aluminio(consecutivo,cod_nc,activo) VALUES"
      "('1004733','ALIAS-A',true),('104628','ALIAS-B',true);"
      "listing:=public.sgp_aluminio_pendientes_listar_v2('PATINADOR',true);"
      "IF (SELECT count(*) FROM jsonb_array_elements(listing->'pendientes') p,"
      "jsonb_array_elements(p->'ncs') n WHERE p->>'id_pendiente'=v_pending::text"
      " AND n->>'resolucion'='ACTIVA')<>2 THEN RAISE EXCEPTION 'DEFERRED_MATCH_FAILED';END IF;"
      "PERFORM public.sgp_aluminio_pendiente_nc_vincular_v1('PATINADOR',v_pending,ARRAY['1004733','104628']);"
      "PERFORM public.sgp_aluminio_pendiente_nc_vincular_v1('PATINADOR',v_pending,ARRAY['ALIAS-A','ALIAS-B']);"
      "listing:=public.sgp_aluminio_pendientes_listar_v2('PATINADOR',true);"
      "IF (SELECT count(*) FROM jsonb_array_elements(listing->'pendientes') p,"
      "jsonb_array_elements(p->'ncs') n WHERE p->>'id_pendiente'=v_pending::text)<>2"
      " OR (SELECT count(*) FROM sgp_aluminio_pendiente_ncs WHERE id_pendiente=v_pending)<>2"
      " THEN RAISE EXCEPTION 'DUPLICATED_AFTER_LINK';END IF;")

check("INSERT INTO sgp_nc_aluminio(consecutivo,cod_nc,activo) VALUES('EXISTING','EX-ALIAS',true);"
      "r:=" + call(["EXISTING", "UNKNOWN"]) + ";v_pending:=(r->'ids_pendientes'->>0)::uuid;"
      "IF (SELECT count(*) FROM sgp_aluminio_pendiente_ncs WHERE id_pendiente=v_pending)<>1"
      " THEN RAISE EXCEPTION 'EXISTING_NOT_LINKED';END IF;"
      "INSERT INTO sgp_nc_aluminio(consecutivo,cod_nc,activo) VALUES('UNKNOWN','NEW-ALIAS',true);"
      "listing:=public.sgp_aluminio_pendientes_listar_v2('PATINADOR',true);"
      "IF (SELECT count(*) FROM jsonb_array_elements(listing->'pendientes') p,"
      "jsonb_array_elements(p->'ncs') n WHERE p->>'id_pendiente'=v_pending::text)<>2"
      " THEN RAISE EXCEPTION 'MIXED_LIST_FAILED';END IF;")

check("r:=" + call(["FUTURE-A", "FUTURE-B"], pieces=[{**source, "nc": "FUTURE-A", "ncs": ["FUTURE-A", "FUTURE-B"]}, {**source, "id_pieza": "P2", "fabricacion": "E17-1", "nc": "FUTURE-C", "ncs": ["FUTURE-C", "FUTURE-D"]}]) + ";"
      "IF jsonb_array_length(r->'ids_pendientes')<>2"
      " OR (SELECT count(*) FROM sgp_picking_faltantes WHERE id_entrega=(r->>'id_entrega')::uuid)<>2"
      " THEN RAISE EXCEPTION 'SHARED_RESERVE_DUPLICATED';END IF;")

for references, expected in [
    (["REPEATED", "REPEATED"], "PDT_NC_DUPLICADA"),
    (["EXISTING", "EX-ALIAS"], "PDT_NC_DUPLICADA"),
    (["EXISTING", "AMBIGUOUS"], "PDT_NC_AMBIGUA"),
]:
    sql("INSERT INTO sgp_nc_aluminio(consecutivo,cod_nc,activo) VALUES"
        "('EXISTING','EX-ALIAS',true),('AMB-1','AMBIGUOUS',true),"
        "('AMB-2','AMBIGUOUS',true) ON CONFLICT DO NOTHING;") if references == ["REPEATED", "REPEATED"] else None
    rejected = psql("BEGIN; SELECT " + call(references) + "; ROLLBACK;")
    assert rejected.returncode and expected in rejected.stderr, rejected.stderr

sql("SELECT " + call(["AFTER-ROLLBACK-A", "AFTER-ROLLBACK-B"]) + ";")
refused = psql(rollback)
assert refused.returncode and "PDT_NC_DIFERIDA_ROLLBACK_DATA_PRESENT" in refused.stderr
assert sql("SELECT md5(prosrc) FROM pg_proc WHERE oid='sgp_pdt_multiorigen.registrar(text,text,jsonb,jsonb,uuid,uuid)'::regprocedure") == "2c9da616eb830fd6db20973e9bec4155"

print(json.dumps({"status": "PASS", "postgres": sql("SHOW server_version"),
                  "network": "none", "focused_cases": 11,
                  "coverage": ["0/1/2/20 deferred NC", "later match and link",
                               "existing plus missing", "idempotent retry",
                               "shared reserve", "duplicate/ambiguous rejection",
                               "rollback and rollback guard"]}))
