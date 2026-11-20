-- Only the disposable localhost PG17 fixture; never a migration.
DO $guard$
BEGIN
 IF current_database() <> 'picking_conciliacion_test' OR
    EXISTS (SELECT FROM pg_namespace WHERE nspname IN ('auth','storage','qa_reconciliation')) OR
    inet_server_addr() IS NULL OR current_setting('server_version_num')::integer / 10000 <> 17 THEN
  RAISE EXCEPTION 'QA_DATABASE_ONLY';
 END IF;
END
$guard$;
CREATE ROLE qa_coordinator NOLOGIN;
CREATE ROLE qa_unprivileged NOLOGIN;
CREATE SCHEMA qa_reconciliation;
REVOKE ALL ON SCHEMA qa_reconciliation FROM PUBLIC;
GRANT USAGE ON SCHEMA qa_reconciliation TO qa_coordinator, qa_unprivileged;
SET search_path TO qa_reconciliation, pg_catalog;

CREATE TABLE staff (
 actor text PRIMARY KEY CHECK (actor LIKE 'QA-%'),
 job text NOT NULL CHECK (job IN ('DELIVERY','VERTICALES','ZOCALERO'))
);
CREATE TABLE orders (
 id text PRIMARY KEY CHECK (id LIKE 'QA-%'),
 line text NOT NULL,
 qty integer NOT NULL CHECK (qty > 0)
);
CREATE TABLE machine_history (
 order_id text REFERENCES orders NOT NULL,
 observed_at timestamptz NOT NULL,
 state text NOT NULL,
 PRIMARY KEY (order_id, observed_at)
);
CREATE TABLE pending (
 order_id text REFERENCES orders PRIMARY KEY,
 detail text NOT NULL
);
CREATE TABLE batches (
 id uuid PRIMARY KEY,
 actor name NOT NULL,
 request jsonb NOT NULL,
 response jsonb NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE deliveries (
 order_id text REFERENCES orders PRIMARY KEY,
 batch_id uuid REFERENCES batches,
 qty integer NOT NULL CHECK (qty > 0),
 operational_date date NOT NULL,
 shift integer NOT NULL CHECK (shift IN (1,2)),
 operator text NOT NULL REFERENCES staff,
 registered_by name NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE reviews (
 order_id text REFERENCES deliveries NOT NULL,
 section text NOT NULL CHECK (section IN ('VERTICALES','ZOCALERO')),
 operator text REFERENCES staff NOT NULL,
 registered_by name NOT NULL,
 operational_date date NOT NULL,
 shift integer NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 result text NOT NULL CHECK (result = 'SIN_FALTANTES'),
 PRIMARY KEY (order_id, section),
 UNIQUE (order_id, operator)
);
CREATE TABLE closures (
 order_id text REFERENCES deliveries PRIMARY KEY,
 batch_id uuid REFERENCES batches NOT NULL,
 registered_by name NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE FUNCTION preview(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, qa_reconciliation, pg_temp
AS $preview$
DECLARE
 d date;
 s integer;
 start_at timestamptz;
 end_at timestamptz;
 rows jsonb;
BEGIN
 IF SESSION_USER <> 'qa_coordinator' THEN RAISE EXCEPTION 'QA_UNAUTHORIZED'; END IF;
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'QA_BAD_REQUEST'; END IF;
 IF NOT (p ?& ARRAY['date','shift','delivery','vertical','base','reason','orders']) OR
   (p - ARRAY['date','shift','delivery','vertical','base','reason','orders']) <> '{}'::jsonb
 THEN RAISE EXCEPTION 'QA_BAD_REQUEST'; END IF;
 IF coalesce(p->>'reason','') NOT LIKE 'QA-%' THEN RAISE EXCEPTION 'QA_BAD_REASON'; END IF;
 d := (p->>'date')::date;
 s := (p->>'shift')::integer;
 IF d IS NULL OR s IS NULL OR s NOT IN (1,2) THEN RAISE EXCEPTION 'QA_BAD_SHIFT'; END IF;
 start_at := (d + CASE WHEN s=1 THEN time '07:00' WHEN extract(isodow from d)=7 THEN time '18:00' ELSE time '19:00' END) AT TIME ZONE 'America/Bogota';
 end_at := CASE WHEN s=1 THEN (d + CASE WHEN extract(isodow from d)=7 THEN time '18:00' ELSE time '19:00' END)
             ELSE ((d + 1) + CASE WHEN extract(isodow from d)=7 THEN time '05:00' ELSE time '07:00' END) END
           AT TIME ZONE 'America/Bogota';
 IF end_at >= statement_timestamp() OR end_at <= start_at THEN RAISE EXCEPTION 'QA_SHIFT_NOT_CLOSED'; END IF;
 IF NOT EXISTS (SELECT FROM staff WHERE actor=(p->>'delivery') AND job='DELIVERY')
    OR NOT EXISTS (SELECT FROM staff WHERE actor=(p->>'vertical') AND job='VERTICALES')
    OR NOT EXISTS (SELECT FROM staff WHERE actor=(p->>'base') AND job='ZOCALERO')
 THEN RAISE EXCEPTION 'QA_INVALID_ATTRIBUTION'; END IF;
 IF jsonb_typeof(p->'orders') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'QA_BAD_ORDERS'; END IF;
 IF jsonb_array_length(p->'orders') NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'QA_BAD_ORDERS'; END IF;
 IF EXISTS(SELECT FROM jsonb_array_elements(p->'orders') j(value)
   WHERE jsonb_typeof(value) <> 'object')
 THEN RAISE EXCEPTION 'QA_BAD_ROW'; END IF;
 IF EXISTS(SELECT FROM jsonb_array_elements(p->'orders') j(value)
   WHERE NOT (value ?& ARRAY['id','qty']) OR (value - ARRAY['id','qty']) <> '{}'::jsonb
   OR coalesce(value->>'id','') NOT LIKE 'QA-%'
   OR jsonb_typeof(value->'qty') IS DISTINCT FROM 'number'
   OR coalesce(value->>'qty','') !~ '^[1-9][0-9]{0,8}$')
 THEN RAISE EXCEPTION 'QA_BAD_ROW'; END IF;
 IF EXISTS(SELECT FROM jsonb_array_elements(p->'orders') j(value)
           GROUP BY value->>'id' HAVING count(*) > 1)
 THEN RAISE EXCEPTION 'QA_DUPLICATE_ROW'; END IF;

 SELECT jsonb_agg(jsonb_build_object('order',j.value->>'id','qty',(j.value->>'qty')::integer,
          'observed_at',m.observed_at,
          'result',CASE
            WHEN o.id IS NULL OR o.line <> 'PANELES_2' THEN 'FUERA_ALCANCE'
            WHEN e.order_id IS NOT NULL THEN 'ENTREGA_PREVIA'
            WHEN f.order_id IS NOT NULL THEN 'PENDIENTE_PREVIO'
            WHEN m.state IS DISTINCT FROM 'PROCESADO' THEN 'NO_PROCESADO_AL_CORTE'
            WHEN o.qty <> (j.value->>'qty')::integer THEN 'SALDO_NO_COINCIDE'
            ELSE 'APTO' END)
          ORDER BY j.value->>'id')
 INTO rows
 FROM jsonb_array_elements(p->'orders') j(value)
 LEFT JOIN orders o ON o.id=j.value->>'id'
 LEFT JOIN deliveries e ON e.order_id=o.id
 LEFT JOIN pending f ON f.order_id=o.id
 LEFT JOIN LATERAL (
  SELECT state, observed_at FROM machine_history h
  WHERE h.order_id=o.id AND h.observed_at<end_at ORDER BY h.observed_at DESC LIMIT 1
 ) m ON true;
 RETURN jsonb_build_object('rows',rows, 'fingerprint',md5(jsonb_build_array(p,rows)::text), 'registered_by',SESSION_USER);
END
$preview$;

CREATE FUNCTION apply_batch(p_id uuid,p jsonb,p_fingerprint text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, qa_reconciliation, pg_temp
AS $apply$
DECLARE
 r jsonb;
 saved batches%ROWTYPE;
 receipt jsonb;
 order_key text;
BEGIN
 IF SESSION_USER <> 'qa_coordinator' THEN RAISE EXCEPTION 'QA_UNAUTHORIZED'; END IF;
 IF p_id IS NULL OR p_fingerprint IS NULL THEN RAISE EXCEPTION 'QA_MISSING_BATCH'; END IF;
 -- Serialize retry even when no receipt exists, independent of per-order lock.
 PERFORM pg_advisory_xact_lock(hashtextextended('qa-reconciliation/'||p_id::text, 0));
 SELECT * INTO saved FROM batches WHERE id=p_id;
 IF FOUND THEN
   IF saved.request IS DISTINCT FROM p OR saved.actor <> SESSION_USER OR
      saved.response->>'fingerprint' IS DISTINCT FROM p_fingerprint
   THEN RAISE EXCEPTION 'QA_IDEMPOTENCY_CONFLICT'; END IF;
   RETURN saved.response;
 END IF;
 PERFORM preview(p);
 -- All synthetic Picking writers take this same row lock first.
 PERFORM 1 FROM orders o JOIN jsonb_array_elements(p->'orders') j(value)
 ON o.id=j.value->>'id' ORDER BY o.id FOR UPDATE OF o;
 r := preview(p);
 IF r->>'fingerprint' IS DISTINCT FROM p_fingerprint THEN RAISE EXCEPTION 'QA_STALE_PREVIEW'; END IF;
 IF EXISTS (SELECT FROM jsonb_array_elements(r->'rows') j(value) WHERE value->>'result'<>'APTO')
 THEN RAISE EXCEPTION 'QA_INELIGIBLE_BATCH'; END IF;
 receipt := r || jsonb_build_object('id',p_id,'applied',true,'registered_at',clock_timestamp());
 INSERT INTO batches(id,actor,request,response) VALUES(p_id,SESSION_USER,p,receipt);
 FOR order_key IN SELECT value->>'order' FROM jsonb_array_elements(r->'rows') ORDER BY value->>'order'
 LOOP
  INSERT INTO deliveries(order_id,batch_id,qty,operational_date,shift,operator,registered_by)
  SELECT id,p_id,qty,(p->>'date')::date,(p->>'shift')::integer,p->>'delivery',SESSION_USER
  FROM orders WHERE id=order_key;
  INSERT INTO reviews(order_id,section,operator,registered_by,operational_date,shift,result)
  VALUES
   (order_key,'VERTICALES',p->>'vertical',SESSION_USER,(p->>'date')::date,(p->>'shift')::integer,'SIN_FALTANTES'),
   (order_key,'ZOCALERO',p->>'base',SESSION_USER,(p->>'date')::date,(p->>'shift')::integer,'SIN_FALTANTES');
  INSERT INTO closures(order_id,batch_id,registered_by)
  SELECT order_key,p_id,SESSION_USER
  WHERE (SELECT count(*) FROM reviews WHERE order_id=order_key)=2;
  IF NOT FOUND THEN RAISE EXCEPTION 'QA_INCOMPLETE_REVIEW'; END IF;
 END LOOP;
 RETURN receipt;
END
$apply$;

REVOKE ALL ON ALL TABLES IN SCHEMA qa_reconciliation FROM PUBLIC, qa_coordinator, qa_unprivileged;
REVOKE ALL ON FUNCTION preview(jsonb), apply_batch(uuid,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION preview(jsonb), apply_batch(uuid,jsonb,text) TO qa_coordinator;
RESET search_path;
