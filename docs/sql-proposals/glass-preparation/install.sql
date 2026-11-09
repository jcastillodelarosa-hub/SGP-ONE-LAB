-- B21: preparation requests only. Never asserts physical availability or changes shifts.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE SCHEMA sgp_glass_preparation;
REVOKE ALL ON SCHEMA sgp_glass_preparation FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE sgp_glass_preparation.dates(
 year int NOT NULL,week int NOT NULL,line text NOT NULL,reservation text NOT NULL,priority text NOT NULL,
 preparation_date date NOT NULL,revision bigint NOT NULL CHECK(revision>0),author text NOT NULL,updated_at timestamptz NOT NULL,
 PRIMARY KEY(year,week,line,reservation,priority));
CREATE TABLE sgp_glass_preparation.events(id uuid PRIMARY KEY,author text NOT NULL,request jsonb NOT NULL,response jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
ALTER TABLE sgp_glass_preparation.dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_glass_preparation.events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA sgp_glass_preparation FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION sgp_glass_preparation.actor(token text,writing boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE a jsonb;BEGIN
 SELECT jsonb_build_object('user',u.usuario,'role',u.rol) INTO a FROM public.sgp_sesiones_app s JOIN public.sgp_usuarios u ON u.id_usuario=s.id_usuario
 WHERE s.token_hash=encode(extensions.digest(coalesce(token,''),'sha256'),'hex') AND s.revocado_en IS NULL AND s.expira_en>clock_timestamp() AND u.activo
 AND u.rol IN('ADMINISTRADOR','COORDINADOR','LIDER','CONSULTA');
 IF a IS NULL OR (writing AND a->>'role' NOT IN('ADMINISTRADOR','COORDINADOR')) OR NOT EXISTS(SELECT 1 FROM public.sgp_mis_accesos(token) x WHERE x.ventana='ensamble') THEN RAISE EXCEPTION 'PERMISO_DENEGADO';END IF;
 RETURN a;
END $$;
CREATE FUNCTION sgp_glass_preparation.source(y int,w int,ln text) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 WITH source AS(
 SELECT p.key_produccion key,p.produccion production,p.sistema system,p.acabado finish,p.cantidad windows,p.orden_oves oves,
 coalesce(nullif(btrim(split_part(p.reserva_al,',',1)),''),'SIN RESERVA') reservation,
 coalesce(pr.priority,nullif(btrim(p.prioridad_programacion),''),'') priority,coalesce(pr.conflict,false) conflict,
 p.lotes machining_lot,NULL::text glass_lot
 FROM public.sgp_producciones p LEFT JOIN LATERAL(
 SELECT CASE WHEN count(DISTINCT nullif(btrim(r.prioridad),''))=1 THEN min(nullif(btrim(r.prioridad),'')) END priority,
 count(DISTINCT nullif(btrim(r.prioridad),''))>1 conflict FROM public.sgp_prioridades r
 WHERE r.key_produccion=p.key_produccion AND r.anio=p.anio AND r.semana=coalesce(p.semana_actual,p.semana_base) AND r.id_linea=p.id_linea
 AND r.reserva=btrim(split_part(p.reserva_al,',',1)))pr ON true
 WHERE p.anio=y AND coalesce(p.semana_actual,p.semana_base)=w AND p.id_linea=ln AND p.activa='SI' AND NOT p.excluida_export
 ) SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.reservation,s.priority,s.key),'[]') FROM source s
$$;
CREATE FUNCTION public.sgp_glass_preparation_save(p_token text,p_command jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a jsonb;request_id uuid;y int;w int;ln text;item jsonb;src jsonb;members jsonb;existing sgp_glass_preparation.events%rowtype;rev bigint;stamp timestamptz;response jsonb;d date;BEGIN
 a:=sgp_glass_preparation.actor(p_token,true);
 IF jsonb_typeof(p_command) IS DISTINCT FROM 'object' OR jsonb_typeof(p_command->'changes') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'SOLICITUD_INVALIDA';END IF;
 request_id:=(p_command->>'id')::uuid;y:=(p_command->>'year')::int;w:=(p_command->>'week')::int;ln:=p_command->>'line';
 IF request_id IS NULL OR y IS NULL OR y NOT BETWEEN 2020 AND 2100 OR w IS NULL OR w NOT BETWEEN 1 AND 53 OR ln IS DISTINCT FROM 'PANELES_2' OR jsonb_array_length(p_command->'changes') NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'SOLICITUD_INVALIDA';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('GLASS-PREPARATION:'||y||':'||w||':'||ln,0));
 a:=sgp_glass_preparation.actor(p_token,true);
 SELECT * INTO existing FROM sgp_glass_preparation.events e WHERE e.id=request_id;
 IF FOUND THEN IF existing.author<>a->>'user' OR existing.request<>p_command THEN RAISE EXCEPTION 'ID_REUTILIZADO';END IF;RETURN existing.response;END IF;
 -- Lock catalog rows while validating source membership and persisting the entire batch.
 PERFORM 1 FROM public.sgp_producciones p WHERE p.anio=y AND coalesce(p.semana_actual,p.semana_base)=w AND p.id_linea=ln FOR SHARE;
 PERFORM 1 FROM public.sgp_prioridades p WHERE p.anio=y AND p.semana=w AND p.id_linea=ln FOR SHARE;
 src:=sgp_glass_preparation.source(y,w,ln);
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_command->'changes') e GROUP BY e->>'reservation',e->>'priority' HAVING count(*)>1) THEN RAISE EXCEPTION 'GRUPO_DUPLICADO';END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_command->'changes') LOOP
 IF coalesce(item->>'revision','')!~'^[0-9]{1,15}$' OR coalesce(item->>'date','')!~'^\d{4}-\d{2}-\d{2}$' OR coalesce(item->>'priority','')='' THEN RAISE EXCEPTION 'FECHA_O_PRIORIDAD_INVALIDA';END IF;
 d:=(item->>'date')::date;IF d NOT BETWEEN date '2020-01-01' AND date '2100-12-31' THEN RAISE EXCEPTION 'FECHA_INVALIDA';END IF;
 SELECT coalesce(jsonb_agg(r ORDER BY r->>'key'),'[]') INTO members FROM jsonb_array_elements(src) r WHERE r->>'reservation'=item->>'reservation' AND r->>'priority'=item->>'priority';
 IF jsonb_array_length(members)=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(members) r WHERE (r->>'conflict')::boolean) OR md5(members::text) IS DISTINCT FROM item->>'fingerprint' THEN RAISE EXCEPTION 'FUENTE_CAMBIO_RECARGAR';END IF;
 SELECT revision INTO rev FROM sgp_glass_preparation.dates WHERE year=y AND week=w AND line=ln AND reservation=item->>'reservation' AND priority=item->>'priority';
 IF coalesce(rev,0)<>(item->>'revision')::bigint THEN RAISE EXCEPTION 'FECHA_CAMBIO_RECARGAR';END IF;
 stamp:=clock_timestamp();
 INSERT INTO sgp_glass_preparation.dates VALUES(y,w,ln,item->>'reservation',item->>'priority',d,coalesce(rev,0)+1,a->>'user',stamp)
 ON CONFLICT(year,week,line,reservation,priority) DO UPDATE SET preparation_date=excluded.preparation_date,revision=excluded.revision,author=excluded.author,updated_at=excluded.updated_at;
 END LOOP;
 PERFORM sgp_glass_preparation.actor(p_token,true);
 response:=jsonb_build_object('ok',true,'id',request_id,'saved',jsonb_array_length(p_command->'changes'));
 INSERT INTO sgp_glass_preparation.events(id,author,request,response) VALUES(request_id,a->>'user',p_command,response);
 RETURN response;
END $$;
-- Server fingerprints are generated from the same exact source used by the writer.
CREATE FUNCTION sgp_glass_preparation.fingerprints(rows jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('reservation',reservation,'priority',priority,'fingerprint',md5(members::text))),'[]') FROM(
 SELECT r->>'reservation' reservation,r->>'priority' priority,jsonb_agg(r ORDER BY r->>'key') members FROM jsonb_array_elements(rows) r GROUP BY r->>'reservation',r->>'priority')g
$$;
-- Add fingerprints without exposing private tables.
CREATE OR REPLACE FUNCTION public.sgp_glass_preparation_read(p_token text,p_year int,p_week int,p_line text DEFAULT 'PANELES_2') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a jsonb;rows jsonb;dates jsonb;BEGIN
 a:=sgp_glass_preparation.actor(p_token);
 IF p_year IS NULL OR p_year NOT BETWEEN 2020 AND 2100 OR p_week IS NULL OR p_week NOT BETWEEN 1 AND 53 OR p_line IS DISTINCT FROM 'PANELES_2' THEN RAISE EXCEPTION 'PERIODO_INVALIDO';END IF;
 rows:=sgp_glass_preparation.source(p_year,p_week,p_line);
 SELECT coalesce(jsonb_agg(to_jsonb(d)),'[]') INTO dates FROM sgp_glass_preparation.dates d WHERE year=p_year AND week=p_week AND line=p_line;
 RETURN jsonb_build_object('contract','GLASS-PREPARATION-1','year',p_year,'week',p_week,'line',p_line,'canWrite',a->>'role' IN('ADMINISTRADOR','COORDINADOR'),'rows',rows,'dates',dates,'fingerprints',sgp_glass_preparation.fingerprints(rows),
 'weeks',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY year DESC,week DESC),'[]') FROM(SELECT DISTINCT anio AS year,coalesce(semana_actual,semana_base) AS week FROM public.sgp_producciones WHERE activa='SI' AND NOT excluida_export AND id_linea=p_line)s));
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sgp_glass_preparation FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.sgp_glass_preparation_read(text,int,int,text),public.sgp_glass_preparation_save(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.sgp_glass_preparation_read(text,int,int,text),public.sgp_glass_preparation_save(text,jsonb) TO anon,authenticated;
COMMIT;
