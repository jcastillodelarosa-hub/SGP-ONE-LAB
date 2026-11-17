"""Real two-session PostgreSQL CI check. Synthetic dedicated DB ONLY; no production inputs."""
import concurrent.futures, json, os, time, uuid
from pathlib import Path
import psycopg2
from psycopg2.extras import Json

if os.environ.get('SGP_SYNTHETIC_PG') != '1':
    raise SystemExit('Set SGP_SYNTHETIC_PG=1 for the dedicated synthetic service')
if os.environ.get('PGDATABASE') != 'sgp_impact_qa' or os.environ.get('PGHOST', '') not in ('127.0.0.1', 'localhost'):
    raise SystemExit('Only local dedicated database sgp_impact_qa is allowed')
ROOT = Path(__file__).resolve().parents[2]
SQL = ROOT / 'docs/sql-proposals/picking-impact/complement-history-review.sql'

def connect(name):
    c = psycopg2.connect(application_name=name, connect_timeout=5)
    with c.cursor() as cur:
        cur.execute("SET statement_timeout='15000ms'; SET idle_in_transaction_session_timeout='30000ms'")
    c.commit()
    return c

admin = connect('impact-qa-admin')
try:
    with admin.cursor() as cur:
        cur.execute("SELECT current_database(),to_regnamespace('sgp_picking_impacto'),to_regclass('public.synthetic_receipts')")
        database, schema, fixture = cur.fetchone()
        if database != 'sgp_impact_qa' or schema or fixture:
            raise RuntimeError('Dedicated fixture must be empty; this script never drops existing objects')
        cur.execute("""
CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
CREATE SCHEMA sgp_picking_audit;
CREATE TABLE public.sgp_picking_entregas(id_entrega uuid PRIMARY KEY);
CREATE TABLE sgp_picking_audit.eventos(id_entrega uuid,fecha_recepcion date);
CREATE TABLE public.sgp_producciones(key_produccion text PRIMARY KEY,id_linea text);
CREATE TABLE public.sgp_usuarios(usuario text PRIMARY KEY,nombre text);
CREATE TABLE public.synthetic_receipts(id_entrega uuid PRIMARY KEY,row jsonb);
CREATE FUNCTION public.sgp_pdt_validar_rol_real(t text,roles text[]) RETURNS text LANGUAGE plpgsql AS $$BEGIN IF NOT t=ANY(roles) THEN RAISE EXCEPTION 'DENIED';END IF;RETURN t;END$$;
CREATE FUNCTION public.sgp_picking_reporte_recepciones_v1(t text,a date,b date,c text,d text,e integer,f integer) RETURNS jsonb LANGUAGE sql AS $$SELECT jsonb_build_object('rows',coalesce(jsonb_agg(row),'[]'),'total_rows',count(*)) FROM public.synthetic_receipts$$;
INSERT INTO public.sgp_producciones VALUES('SYNTHETIC-K','PANELES_2');
INSERT INTO public.sgp_usuarios VALUES('ADMINISTRADOR','Synthetic Admin'),('COORDINADOR','Synthetic Coordinator');
""")
    admin.commit()
    with admin.cursor() as cur:
        cur.execute(SQL.read_text())
    admin.commit()

    def fixture(n):
        eid, fid, pid = [str(uuid.UUID(int=base+n)) for base in (100,200,300)]
        row = dict(id_entrega=eid, produccion='SYNTHETIC', key_produccion='SYNTHETIC-K', cantidad_programada=10,
                   pendientes_al_recibir=[dict(id_faltante=fid,id_pendiente=pid,ventanas_afectadas=None)])
        with admin.cursor() as cur:
            cur.execute('INSERT INTO public.sgp_picking_entregas VALUES(%s)',(eid,))
            cur.execute('INSERT INTO sgp_picking_audit.eventos VALUES(%s,%s)',(eid,'2026-11-17'))
            cur.execute('INSERT INTO public.synthetic_receipts VALUES(%s,%s)',(eid,Json(row)))
        admin.commit()
        return eid, dict(faltantes=[dict(id_faltante=fid,id_pendiente=pid,ventanas_afectadas=3)],total_consolidado=None)

    def save(conn, eid, request, detail, role='ADMINISTRADOR'):
        with conn.cursor() as cur:
            cur.execute('SELECT public.sgp_picking_impacto_complementar(%s,%s,%s,%s,%s)',
                        (role,eid,request,Json(detail),'Synthetic missing impact'))
            return cur.fetchone()[0]

    def attempt(conn, *args):
        try:
            value=save(conn,*args);conn.commit();return ('ok',value)
        except psycopg2.Error as error:
            conn.rollback();return ('error',str(error))

    def await_lock(pid):
        until=time.monotonic()+8
        while time.monotonic()<until:
            with admin.cursor() as cur:
                cur.execute('SELECT wait_event_type FROM pg_stat_activity WHERE pid=%s',(pid,))
                row=cur.fetchone()
            admin.commit()  # refresh statistics snapshot
            if row and row[0]=='Lock':return
            time.sleep(.05)
        raise AssertionError('Contender did not reach a real PostgreSQL lock wait')

    def assert_single(eid):
        with admin.cursor() as cur:
            cur.execute('SELECT count(*) FROM sgp_picking_impacto.complementos WHERE id_entrega=%s',(eid,))
            assert cur.fetchone()[0]==1
            cur.execute("SELECT row#>>'{pendientes_al_recibir,0,ventanas_afectadas}' FROM public.synthetic_receipts WHERE id_entrega=%s",(eid,))
            assert cur.fetchone()[0] is None
        admin.commit()

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        for n, same_request in [(1,True),(2,False)]:
            eid,detail=fixture(n);r1=str(uuid.UUID(int=400+n));r2=r1 if same_request else str(uuid.UUID(int=500+n))
            first,second=connect('impact-qa-holder'),connect('impact-qa-contender')
            try:
                result=save(first,eid,r1,detail);assert result['cantidad_efectiva']==7
                pending=pool.submit(attempt,second,eid,r2,detail)
                await_lock(second.get_backend_pid());first.commit()
                outcome,value=pending.result(timeout=18)
                if same_request:
                    assert outcome=='ok' and value.get('duplicado') is True
                else:
                    assert outcome=='error' and 'IMPACTO_YA_COMPLEMENTADO' in value
                assert_single(eid)
            finally:
                first.rollback();second.rollback();first.close();second.close()

        # First request writes but is rolled back; contender then succeeds exactly once.
        eid,detail=fixture(3);r1=str(uuid.UUID(int=403));r2=str(uuid.UUID(int=503))
        first,second=connect('impact-qa-rollback-holder'),connect('impact-qa-recovery')
        try:
            save(first,eid,r1,detail)
            pending=pool.submit(attempt,second,eid,r2,detail,'COORDINADOR')
            await_lock(second.get_backend_pid());first.rollback()
            outcome,value=pending.result(timeout=18)
            assert outcome=='ok' and not value.get('duplicado')
            assert_single(eid)
        finally:
            first.rollback();second.rollback();first.close();second.close()
    print('PASS real PostgreSQL locks: exact retry, distinct request rejection, rollback recovery; one complement and historical snapshot intact')
finally:
    admin.rollback();admin.close()
