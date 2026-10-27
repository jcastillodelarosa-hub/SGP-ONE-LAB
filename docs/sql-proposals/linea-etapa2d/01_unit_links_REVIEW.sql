-- REVIEW ONLY, isolated PG17. No legacy mutation, no reader registered in C2.
BEGIN;
DO $shape$ DECLARE x record;ok boolean;BEGIN
 FOR x IN SELECT * FROM (VALUES
 ('sgp_aluminio_pendientes','id_pendiente','uuid'),('sgp_aluminio_pendientes','key_produccion','S'),
 ('sgp_aluminio_pendientes','id_pieza','S'),('sgp_aluminio_pendientes','auditado','bool'),('sgp_aluminio_pendientes','ventanas_afectadas','int4'),
 ('sgp_picking_faltantes','id_faltante','uuid'),('sgp_picking_faltantes','id_entrega','uuid'),('sgp_picking_faltantes','auditado','bool'),('sgp_picking_faltantes','ventanas_afectadas','int4'),
 ('sgp_picking_entregas','id_entrega','uuid'),('sgp_picking_entregas','estado','S'),
 ('sgp_mecanizado_programacion','id_programacion','uuid'),('sgp_mecanizado_programacion','reserva','S'),
 ('sgp_aluminio','id_pieza','S'),('sgp_aluminio','tipo_pieza','S'),('sgp_aluminio','activo','S'),
 ('sgp_produccion_reservas_v','key_produccion','S'),('sgp_produccion_reservas_v','reserva','S'),('sgp_produccion_reservas_v','reserva_principal','S'),
 ('sgp_aluminio_pendiente_detalles','id_pendiente','uuid'),('sgp_aluminio_pendiente_detalles','id_detalle','uuid'),
 ('sgp_pdt_entrega_lineas','id_linea','uuid'),('sgp_pdt_entrega_lineas','id_entrega','uuid'),('sgp_pdt_entrega_lineas','id_detalle','uuid'),
 ('sgp_pdt_fuentes','id_detalle','uuid'),('sgp_pdt_fuentes','id_pieza','S')
 ) v(tabla,columna,tipo) LOOP
 SELECT EXISTS(SELECT 1 FROM pg_attribute a JOIN pg_type t ON t.oid=a.atttypid WHERE a.attrelid=to_regclass('public.'||x.tabla) AND a.attname=x.columna AND a.attnum>0 AND NOT a.attisdropped AND (t.typname=x.tipo OR (x.tipo='S' AND t.typcategory='S'))) INTO ok;
 IF NOT ok THEN RAISE EXCEPTION 'D2_FUENTE_INCOMPATIBLE %.%',x.tabla,x.columna;END IF;
 END LOOP;
END$shape$;
CREATE SCHEMA sgp_linea_d2;
REVOKE ALL ON SCHEMA sgp_linea_d2 FROM PUBLIC,anon,authenticated;
-- IDs MUST come from a verified physical unit source. No defaults/generators.
CREATE TABLE sgp_linea_d2.unidades(key text NOT NULL REFERENCES sgp_linea_b2.producciones,id text NOT NULL CHECK(btrim(id)<>''),reserva text NOT NULL,parte text NOT NULL,ensamblada boolean NOT NULL,empacada boolean NOT NULL,source_ref text NOT NULL CHECK(btrim(source_ref)<>''),source_version text NOT NULL CHECK(btrim(source_version)<>''),PRIMARY KEY(key,id),CHECK(NOT empacada OR ensamblada));
-- Complete inventory is a TRUSTED source attestation, never a browser flag.
-- Real coverage of keyless/legacy/shared-reserve rows is NOT yet verified.
CREATE TABLE sgp_linea_d2.cobertura(key text PRIMARY KEY REFERENCES sgp_linea_b2.producciones,identity jsonb NOT NULL,generation bigint NOT NULL CHECK(generation>0),source_ref text NOT NULL CHECK(btrim(source_ref)<>''),pendientes uuid[] NOT NULL);
CREATE TABLE sgp_linea_d2.vinculos(evento uuid PRIMARY KEY,key text NOT NULL REFERENCES sgp_linea_b2.producciones,pdt uuid NOT NULL REFERENCES public.sgp_aluminio_pendientes(id_pendiente),revision bigint NOT NULL,etapa text NOT NULL CHECK(etapa IN('ENSAMBLE','EMPAQUE')),entrega uuid NOT NULL REFERENCES public.sgp_picking_entregas(id_entrega),faltante uuid NOT NULL REFERENCES public.sgp_picking_faltantes(id_faltante),huella text NOT NULL,snapshot jsonb NOT NULL,unidades text[] NOT NULL,usuario text NOT NULL,motivo text NOT NULL CHECK(btrim(motivo)<>''),solicitud jsonb NOT NULL,creado_en timestamptz NOT NULL DEFAULT now(),UNIQUE(pdt,revision));
CREATE TRIGGER fijo BEFORE UPDATE OR DELETE ON sgp_linea_d2.vinculos FOR EACH ROW EXECUTE FUNCTION sgp_linea_b2.inmutable();
-- Physical per-unit clearance evidence MUST exist in a trusted server source.
-- A VALIDADA piece line alone is insufficient; no function auto-inserts clearance.
CREATE TABLE sgp_linea_d2.liberaciones(key text NOT NULL,pdt uuid NOT NULL,unidad text NOT NULL,linea uuid NOT NULL REFERENCES public.sgp_pdt_entrega_lineas(id_linea),huella text NOT NULL,physical_ref text NOT NULL CHECK(btrim(physical_ref)<>''),source_version text NOT NULL CHECK(btrim(source_version)<>''),PRIMARY KEY(key,pdt,unidad),FOREIGN KEY(key,unidad) REFERENCES sgp_linea_d2.unidades(key,id));
CREATE FUNCTION sgp_linea_d2.fuente(p_id uuid,p_entrega uuid,p_faltante uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE p record;e record;x jsonb;mp record;BEGIN
 IF p_faltante IS NULL THEN RAISE EXCEPTION 'REFERENCIA_EXPLICITA_REQUERIDA';END IF;
 SELECT * INTO STRICT p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p_id;
 SELECT * INTO STRICT e FROM public.sgp_picking_entregas WHERE id_entrega=p_entrega;
 SELECT * INTO STRICT mp FROM public.sgp_mecanizado_programacion WHERE id_programacion=e.id_programacion;
 SELECT to_jsonb(f) INTO STRICT x FROM public.sgp_picking_faltantes f WHERE id_faltante=p_faltante AND id_entrega=p_entrega;
 IF p.key_produccion IS NULL OR p.id_pieza IS NULL OR x->>'id_pieza' IS DISTINCT FROM p.id_pieza OR p.produccion IS DISTINCT FROM e.produccion
 OR coalesce(nullif(x->>'reserva_pendiente',''),mp.reserva) IS DISTINCT FROM p.reserva
 OR NOT EXISTS(SELECT 1 FROM public.sgp_produccion_reservas_v v WHERE v.key_produccion=p.key_produccion AND v.produccion=p.produccion AND v.reserva=p.reserva AND v.reserva_principal=mp.reserva)
 OR NOT EXISTS(SELECT 1 FROM public.sgp_aluminio a WHERE a.id_pieza=p.id_pieza AND a.tipo_pieza='PANEL' AND a.activo='SI')
 THEN RAISE EXCEPTION 'IDENTIDAD_NO_DEMOSTRADA';END IF;
 IF p.auditado IS DISTINCT FROM true OR e.estado IS NULL OR e.estado NOT IN ('VALIDADA','AUDITADA_DIFERENCIA') OR (p_faltante IS NOT NULL AND x->>'auditado' IS DISTINCT FROM 'true')
 OR coalesce((x->>'ventanas_afectadas')::int,0)<1 OR p.ventanas_afectadas IS DISTINCT FROM (x->>'ventanas_afectadas')::int THEN RAISE EXCEPTION 'AUDITORIA_INSUFICIENTE';END IF;
 RETURN jsonb_build_object('key',p.key_produccion,'windows',(x->>'ventanas_afectadas')::int,'snapshot',jsonb_build_array(to_jsonb(p),to_jsonb(e),x,to_jsonb(mp)),'hash',md5(jsonb_build_array(to_jsonb(p),to_jsonb(e),x,to_jsonb(mp))::text));
END$$;
CREATE FUNCTION sgp_linea_d2.asociar(token text,k text,p_id uuid,p_entrega uuid,p_faltante uuid,etapa text,ids text[],esperada bigint,huella text,evento uuid,motivo text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s jsonb;pe jsonb;f jsonb;prior sgp_linea_d2.vinculos%rowtype;lastrow sgp_linea_d2.vinculos%rowtype;payload jsonb;r bigint;BEGIN
 s:=sgp_linea_b2.sesion(token);
 IF s->>'rol' NOT IN ('COORDINADOR','ADMINISTRADOR') OR etapa NOT IN ('ENSAMBLE','EMPAQUE') OR etapa IS NULL OR evento IS NULL OR esperada IS NULL OR esperada<0 OR nullif(btrim(motivo),'') IS NULL THEN RAISE EXCEPTION 'OPERACION_NO_AUTORIZADA';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(evento::text,123));
 PERFORM 1 FROM sgp_linea_b2.producciones WHERE key=k FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCCION_NO_EXISTE';END IF;
 pe:=sgp_linea_c2.leer('PERMISOS',k);
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(pe->'grants') g WHERE g->>'user'=s->>'usuario' AND g->>'stage'=etapa) THEN RAISE EXCEPTION 'AMBITO_DENEGADO';END IF;
 payload:=jsonb_build_array(k,p_id,p_entrega,p_faltante,etapa,ids,esperada,huella,motivo,s->>'usuario');
 SELECT * INTO prior FROM sgp_linea_d2.vinculos WHERE vinculos.evento=asociar.evento;
 IF FOUND THEN IF prior.solicitud<>payload THEN RAISE EXCEPTION 'IDEMPOTENCIA_REUTILIZADA';END IF;RETURN jsonb_build_object('ok',true,'duplicate',true,'revision',prior.revision);END IF;
 SELECT * INTO lastrow FROM sgp_linea_d2.vinculos WHERE pdt=p_id ORDER BY revision DESC LIMIT 1;
 r:=coalesce(lastrow.revision,0);IF r<>esperada THEN RAISE EXCEPTION 'CONFLICTO_REVISION';END IF;
 IF r>0 AND (lastrow.key<>k OR lastrow.etapa<>etapa) THEN RAISE EXCEPTION 'REASIGNACION_ETAPA_REQUIERE_REVISION';END IF;
 f:=sgp_linea_d2.fuente(p_id,p_entrega,p_faltante);
 IF f->>'key'<>k OR f->>'hash' IS DISTINCT FROM huella THEN RAISE EXCEPTION 'FUENTE_OBSOLETA';END IF;
 IF ids IS NULL OR cardinality(ids)<>(f->>'windows')::int OR cardinality(ids)<>(SELECT count(DISTINCT z) FROM unnest(ids) z)
 OR EXISTS(SELECT 1 FROM unnest(ids) z WHERE NOT EXISTS(SELECT 1 FROM sgp_linea_d2.unidades u WHERE u.key=k AND u.id=z AND u.ensamblada AND EXISTS(SELECT 1 FROM sgp_linea_d2.cobertura cov CROSS JOIN LATERAL jsonb_array_elements_text(cov.identity->'reserves') rr WHERE cov.key=k AND rr.value=u.reserva) AND u.parte=(SELECT identity->>'part' FROM sgp_linea_d2.cobertura WHERE key=k))) THEN RAISE EXCEPTION 'UNIDADES_NO_DEMOSTRADAS';END IF;
 INSERT INTO sgp_linea_d2.vinculos VALUES(evento,k,p_id,r+1,etapa,p_entrega,p_faltante,huella,f->'snapshot',ids,s->>'usuario',motivo,payload,now());
 UPDATE sgp_linea_d2.cobertura SET generation=generation+1 WHERE key=k;
 RETURN jsonb_build_object('ok',true,'duplicate',false,'revision',r+1);
END$$;
CREATE FUNCTION sgp_linea_d2.huella_liberacion(p_id uuid,p_linea uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$DECLARE h text;BEGIN
 SELECT md5(jsonb_build_array(to_jsonb(l),to_jsonb(e),to_jsonb(d),to_jsonb(f))::text) INTO h
 FROM public.sgp_pdt_entrega_lineas l JOIN public.sgp_picking_entregas e ON e.id_entrega=l.id_entrega
 JOIN public.sgp_aluminio_pendiente_detalles d ON d.id_detalle=l.id_detalle JOIN public.sgp_pdt_fuentes f ON f.id_detalle=d.id_detalle
 JOIN public.sgp_aluminio_pendientes p ON p.id_pendiente=d.id_pendiente JOIN public.sgp_mecanizado_programacion mp ON mp.id_programacion=e.id_programacion
 WHERE l.id_linea=p_linea AND d.id_pendiente=p_id AND l.estado='VALIDADA' AND l.cantidad>0 AND e.estado='VALIDADA' AND l.id_pieza=d.id_pieza AND f.id_pieza=d.id_pieza AND e.produccion=p.produccion
 AND EXISTS(SELECT 1 FROM public.sgp_produccion_reservas_v v WHERE v.key_produccion=p.key_produccion AND v.produccion=e.produccion AND v.reserva=p.reserva AND v.reserva_principal=mp.reserva);
 RETURN h;END$$;
CREATE FUNCTION sgp_linea_d2.impacto(k text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE c sgp_linea_d2.cobertura%rowtype;p record;v sgp_linea_d2.vinculos%rowtype;l record;f jsonb;items jsonb:='[]';ids text[];a text[];e text[];revision text;BEGIN
 SELECT * INTO STRICT c FROM sgp_linea_d2.cobertura WHERE key=k;
 -- Coverage must enumerate every active keyed PDT and every previously mapped
 -- PDT (a closed NC/PDT status does not itself clear a recorded physical block).
 IF c.identity->>'production' IS DISTINCT FROM k OR EXISTS(SELECT 1 FROM public.sgp_aluminio_pendientes pp WHERE pp.key_produccion=k AND (pp.estado='PENDIENTE' OR EXISTS(SELECT 1 FROM sgp_linea_d2.vinculos vl WHERE vl.pdt=pp.id_pendiente)) AND NOT pp.id_pendiente=ANY(c.pendientes))
 OR EXISTS(SELECT 1 FROM unnest(c.pendientes) id WHERE NOT EXISTS(SELECT 1 FROM public.sgp_aluminio_pendientes pp WHERE pp.id_pendiente=id AND pp.key_produccion=k)) THEN RAISE EXCEPTION 'COBERTURA_NO_DEMOSTRADA';END IF;
 FOR p IN SELECT * FROM public.sgp_aluminio_pendientes WHERE id_pendiente=ANY(c.pendientes) ORDER BY id_pendiente LOOP
 SELECT * INTO v FROM sgp_linea_d2.vinculos WHERE pdt=p.id_pendiente AND key=k ORDER BY revision DESC LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'IDENTIFICACION_INDIVIDUAL_AUSENTE';END IF;
 f:=sgp_linea_d2.fuente(v.pdt,v.entrega,v.faltante);
 IF f->>'hash' IS DISTINCT FROM v.huella THEN RAISE EXCEPTION 'VINCULO_OBSOLETO';END IF;
 ids:=v.unidades;
 FOR l IN SELECT * FROM sgp_linea_d2.liberaciones WHERE key=k AND pdt=v.pdt LOOP
 IF NOT l.unidad=ANY(v.unidades) OR sgp_linea_d2.huella_liberacion(v.pdt,l.linea) IS DISTINCT FROM l.huella OR l.huella IS NULL THEN RAISE EXCEPTION 'REPOSICION_NO_ACREDITADA';END IF;
 ids:=array_remove(ids,l.unidad);END LOOP;
 items:=items||jsonb_build_array(jsonb_build_object('id',p.id_pendiente,'stage',v.etapa,'active',cardinality(ids)>0,'sourceRef',c.source_ref||'/'||v.evento::text,'sourceVersion',v.huella||'/'||v.revision,'unitIds',to_jsonb(ids)));
 END LOOP;
 SELECT coalesce(array_agg(id ORDER BY id) FILTER(WHERE ensamblada),'{}'),coalesce(array_agg(id ORDER BY id) FILTER(WHERE empacada),'{}') INTO a,e FROM sgp_linea_d2.unidades WHERE key=k;
 -- Include all physical/unit/source revisions, not just the coverage counter.
 SELECT md5(jsonb_build_array(to_jsonb(c),items,coalesce((SELECT jsonb_agg(to_jsonb(u) ORDER BY id) FROM sgp_linea_d2.unidades u WHERE key=k),'[]'),coalesce((SELECT jsonb_agg(to_jsonb(rel) ORDER BY rel.pdt,rel.unidad) FROM sgp_linea_d2.liberaciones rel WHERE key=k),'[]'))::text) INTO revision;
 RETURN jsonb_build_object('production',k,'identity',c.identity,'generation',c.generation,'revision',revision,'complete',true,'sourceRef',c.source_ref,'items',items,'unitMap',jsonb_build_object('assembled',a,'packed',e,'sourceRef',c.source_ref||'/units'));
END$$;
CREATE TABLE sgp_linea_d2.historial_fuente(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tabla text NOT NULL,operacion text NOT NULL,antes jsonb,despues jsonb,actor_bd text NOT NULL,fecha timestamptz NOT NULL DEFAULT now());
CREATE TRIGGER fijo BEFORE UPDATE OR DELETE ON sgp_linea_d2.historial_fuente FOR EACH ROW EXECUTE FUNCTION sgp_linea_b2.inmutable();
CREATE FUNCTION sgp_linea_d2.invalidar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE k text;BEGIN
 k:=CASE WHEN TG_OP='DELETE' THEN OLD.key ELSE NEW.key END;
 IF TG_OP='UPDATE' AND NEW.key<>OLD.key THEN RAISE EXCEPTION 'IDENTIDAD_INMUTABLE';END IF;
 INSERT INTO sgp_linea_d2.historial_fuente(tabla,operacion,antes,despues,actor_bd) VALUES(TG_TABLE_NAME,TG_OP,CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) END,CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) END,session_user);
 IF TG_TABLE_NAME<>'cobertura' THEN UPDATE sgp_linea_d2.cobertura SET generation=generation+1 WHERE key=k;END IF;
 PERFORM sgp_linea_c2.notificar(k,'PDT');RETURN NULL;END$$;
-- These are NEW complementary tables only. Trusted writers MUST lock production
-- first (and bump coverage generation), before mutating a row. No real hook added.
CREATE TRIGGER invalidar AFTER INSERT OR UPDATE OR DELETE ON sgp_linea_d2.unidades FOR EACH ROW EXECUTE FUNCTION sgp_linea_d2.invalidar();
CREATE TRIGGER invalidar AFTER INSERT OR UPDATE OR DELETE ON sgp_linea_d2.cobertura FOR EACH ROW EXECUTE FUNCTION sgp_linea_d2.invalidar();
CREATE TRIGGER invalidar AFTER INSERT OR UPDATE OR DELETE ON sgp_linea_d2.liberaciones FOR EACH ROW EXECUTE FUNCTION sgp_linea_d2.invalidar();
DO $rls$ DECLARE r record;BEGIN FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='sgp_linea_d2' LOOP EXECUTE format('ALTER TABLE sgp_linea_d2.%I ENABLE ROW LEVEL SECURITY',r.tablename);END LOOP;END$rls$;
REVOKE ALL ON ALL TABLES IN SCHEMA sgp_linea_d2 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sgp_linea_d2 FROM PUBLIC,anon,authenticated;
COMMIT;
