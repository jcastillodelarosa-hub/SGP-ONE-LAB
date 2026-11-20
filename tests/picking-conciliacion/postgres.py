"""Integration tests for a disposable, loopback-only PostgreSQL 17."""
import copy
import pathlib
import threading
import time
import uuid

import psycopg
from psycopg.types.json import Jsonb


SCHEMA = "qa_reconciliation"
PATH = pathlib.Path(__file__).with_name("prototype.sql")
PREVIEW = f"select {SCHEMA}.preview(%s)"
APPLY = f"select {SCHEMA}.apply_batch(%s,%s,%s)"
COORD = "qa_coordinator"


def connect():
    # Explicit parameters; no DATABASE_URL, PGSERVICE or deployment credentials.
    conn = psycopg.connect(
        host="127.0.0.1", hostaddr="127.0.0.1", port=55448, dbname="picking_conciliacion_test",
        user="postgres", password="synthetic_reconciliation_only", connect_timeout=4,
        sslmode="disable", options="-c timezone=UTC", autocommit=True,
    )
    name, pg, has_external_schema = conn.execute(
        "select current_database(), current_setting('server_version_num')::int, exists (select from pg_namespace where nspname in ('auth','storage','qa_reconciliation'))"
    ).fetchone()
    if name != "picking_conciliacion_test" or not 170000 <= pg < 180000 or has_external_schema:
        conn.close()
        raise RuntimeError("An empty disposable PostgreSQL 17 test database is required")
    return conn


def authorize(conn, role=COORD):
    assert role in {COORD, "qa_unprivileged"}
    conn.execute(f"set session authorization {role}")


def execute(conn, sql, args=()):
    return conn.execute(sql, args).fetchone()[0]


def must_fail(conn, sql, args, contains):
    try:
        conn.execute(sql, args)
    except psycopg.Error as exc:
        assert contains in str(exc), repr(exc)
    else:
        raise AssertionError(f"Expected {contains}")


def payload(*orders):
    return {
        "date": "2020-01-03",
        "shift": 1,
        "delivery": "QA-DELIVERY",
        "vertical": "QA-VERTICAL",
        "base": "QA-BASE",
        "reason": "QA-CORRECTION",
        "orders": [{"id": key, "qty": qty} for key, qty in orders],
    }


def fixture(conn):
    conn.execute(PATH.read_text())
    conn.execute(f"set search_path to {SCHEMA},pg_catalog")
    conn.execute("""
    insert into staff values ('QA-DELIVERY','DELIVERY'),('QA-VERTICAL','VERTICALES'),('QA-BASE','ZOCALERO');
    insert into orders values ('QA-EARLY','PANELES_2',3),('QA-SECOND','PANELES_2',4),
      ('QA-RACE','PANELES_2',5),('QA-LATE','PANELES_2',7),('QA-OTHER','FRAMES_2',3),
      ('QA-PENDING','PANELES_2',3),('QA-PREVIOUS','PANELES_2',3),('QA-OVERNIGHT','PANELES_2',4),
      ('QA-SUNDAY','PANELES_2',3);
    insert into machine_history
    select id,'2020-01-03 22:00+00','PROCESADO'
      from orders where id not in ('QA-LATE','QA-OVERNIGHT','QA-SUNDAY');
    insert into machine_history values ('QA-LATE','2020-01-03 23:59+00','CORTE'),
      ('QA-LATE','2020-01-04 00:00+00','PROCESADO'),
      ('QA-OVERNIGHT','2020-01-04 11:59+00','PROCESADO'),
      ('QA-SUNDAY','2020-01-06 10:30+00','PROCESADO');
    insert into deliveries (order_id,qty,operational_date,shift,operator,registered_by)
      values ('QA-PREVIOUS',1,'2020-01-01',2,'QA-DELIVERY','qa_existing');
    insert into pending values ('QA-PENDING','QA-DO-NOT-CHANGE');
    """)


def counts(conn):
    return conn.execute("""
      select (select count(*) from batches), (select count(*) from deliveries),
             (select count(*) from reviews), (select count(*) from closures)
    """).fetchone()


def check_application(admin, coordinator, other):
    valid = payload(("QA-EARLY", 3), ("QA-SECOND", 4))
    before = counts(admin)
    orig_delivery = admin.execute(
        "select * from deliveries where order_id='QA-PREVIOUS'"
    ).fetchone()
    orig_pending = admin.execute("select * from pending").fetchone()
    must_fail(other, PREVIEW, (Jsonb(valid),), "permission denied")
    must_fail(other, APPLY, (uuid.uuid4(), Jsonb(valid), "none"), "permission denied")
    must_fail(coordinator, f"select * from {SCHEMA}.batches", (), "permission denied")
    spoof = {**valid, "registered_by": "QA-DELIVERY"}
    must_fail(coordinator, PREVIEW, (Jsonb(spoof),), "QA_BAD_REQUEST")
    wrong = {**valid, "base": "QA-VERTICAL"}
    must_fail(coordinator, PREVIEW, (Jsonb(wrong),), "QA_INVALID_ATTRIBUTION")
    must_fail(coordinator, PREVIEW, (Jsonb(payload(("QA-EARLY",3),("QA-EARLY",3))),), "QA_DUPLICATE_ROW")

    overnight = {**payload(("QA-OVERNIGHT",4)), "shift": 2}
    assert execute(coordinator, PREVIEW, (Jsonb(overnight),))["rows"][0]["result"] == "APTO"
    sunday = {**payload(("QA-SUNDAY",3)), "date": "2020-01-05", "shift": 2}
    assert execute(coordinator, PREVIEW, (Jsonb(sunday),))["rows"][0]["result"] == "NO_PROCESADO_AL_CORTE"
    candidates = payload(("QA-EARLY", 4), ("QA-OTHER", 3), ("QA-PREVIOUS", 3), ("QA-PENDING", 3), ("QA-LATE", 7))
    rejected = execute(coordinator, PREVIEW, (Jsonb(candidates),))
    assert {r["order"]: r["result"] for r in rejected["rows"]} == {
        "QA-EARLY": "SALDO_NO_COINCIDE", "QA-OTHER": "FUERA_ALCANCE",
        "QA-PREVIOUS": "ENTREGA_PREVIA", "QA-PENDING": "PENDIENTE_PREVIO", "QA-LATE": "NO_PROCESADO_AL_CORTE",
    }
    must_fail(coordinator, APPLY, (uuid.uuid4(), Jsonb(candidates), rejected["fingerprint"]), "QA_INELIGIBLE_BATCH")
    assert counts(admin) == before

    preview = execute(coordinator, PREVIEW, (Jsonb(valid),))
    assert preview["registered_by"] == COORD
    assert [row["result"] for row in preview["rows"]] == ["APTO", "APTO"]
    assert counts(admin) == before
    batch = uuid.uuid4()
    args = (batch, Jsonb(valid), preview["fingerprint"])
    admin.execute("""
    create function fixture_fail() returns trigger language plpgsql as $$
    begin
      if new.order_id='QA-SECOND' then raise exception 'QA_INJECTED_FAILURE'; end if;
      return new;
    end $$;
    create trigger fixture_fail before insert on closures for each row execute function fixture_fail();
    """)
    must_fail(coordinator, APPLY, args, "QA_INJECTED_FAILURE")
    assert counts(admin) == before
    admin.execute("drop trigger fixture_fail on closures; drop function fixture_fail()")

    first = execute(coordinator, APPLY, args)
    assert first["applied"] and first["id"] == str(batch) and first["registered_by"] == COORD
    assert execute(coordinator, APPLY, args) == first
    changed = copy.deepcopy(valid)
    changed["reason"] = "QA-OTHER-REASON"
    must_fail(coordinator, APPLY, (batch, Jsonb(changed), preview["fingerprint"]), "QA_IDEMPOTENCY_CONFLICT")
    other_preview = execute(coordinator, PREVIEW, (Jsonb(valid),))
    must_fail(coordinator, APPLY, (uuid.uuid4(), Jsonb(valid), other_preview["fingerprint"]), "QA_INELIGIBLE_BATCH")
    assert counts(admin) == (1, 3, 4, 2)
    assert admin.execute("""
    select qty,operator,registered_by,operational_date::text,shift,recorded_at > operational_date+1
      from deliveries where order_id='QA-EARLY'
    """).fetchone() == (3, "QA-DELIVERY", COORD, "2020-01-03", 1, True)
    assert admin.execute("""
    select section,operator,registered_by,result,operational_date::text,shift from reviews
      where order_id='QA-EARLY' order by section
    """).fetchall() == [("VERTICALES", "QA-VERTICAL", COORD, "SIN_FALTANTES", "2020-01-03", 1),
                        ("ZOCALERO", "QA-BASE", COORD, "SIN_FALTANTES", "2020-01-03", 1)]
    assert admin.execute("select * from deliveries where order_id='QA-PREVIOUS'").fetchone() == orig_delivery
    assert admin.execute("select * from pending").fetchone() == orig_pending
    print("PASS local QA: attribution, permissions, historical eligibility, no-write preview, rollback and idempotency")


def check_race(admin, coordinator, ordinary):
    request = payload(("QA-RACE",5))
    preview = execute(coordinator, PREVIEW, (Jsonb(request),))
    batch = uuid.uuid4()
    app_pid = execute(coordinator, "select pg_backend_pid()")
    ordinary.execute("begin")
    result = []
    worker = None
    try:
        ordinary.execute(f"select id from {SCHEMA}.orders where id='QA-RACE' for update")
        ordinary.execute(f"""
         insert into {SCHEMA}.deliveries (order_id,qty,operational_date,shift,operator,registered_by)
            values ('QA-RACE',2,'2020-01-02',2,'QA-DELIVERY','qa_existing')
        """)
        def application():
            try:
                must_fail(coordinator, APPLY, (batch, Jsonb(request), preview["fingerprint"]), "QA_STALE_PREVIEW")
            except BaseException as exc:
                result.append(exc)
            else:
                result.append(True)

        worker = threading.Thread(target=application, daemon=True)
        worker.start()
        for _ in range(100):
            if ordinary.info.backend_pid in execute(admin, "select pg_blocking_pids(%s)", (app_pid,)):
                break
            time.sleep(0.03)
        else:
            raise AssertionError("Application did not wait for the ordinary-delivery lock")
        ordinary.execute("commit")
    finally:
        if ordinary.info.transaction_status != psycopg.pq.TransactionStatus.IDLE:
            ordinary.execute("rollback")
        if worker is not None:
            worker.join(10)
    assert result == [True], result
    assert counts(admin) == (1, 4, 4, 2)
    assert admin.execute("select qty,batch_id from deliveries where order_id='QA-RACE'").fetchone() == (2, None)
    print("PASS local QA: concurrent ordinary delivery wins; stale preview cannot duplicate")


if __name__ == "__main__":
    with connect() as admin, connect() as coordinator, connect() as other, connect() as ordinary:
        fixture(admin)
        authorize(coordinator)
        authorize(other, "qa_unprivileged")
        check_application(admin, coordinator, other)
        check_race(admin, coordinator, ordinary)
