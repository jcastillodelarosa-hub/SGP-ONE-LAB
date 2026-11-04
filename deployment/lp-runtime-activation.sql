-- Authorized LP183 runtime activation; configuration DML only, not a migration.
-- No users, grants, RLS, business records, Export or SQL09 are changed.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='15s';
-- Same order as protected commands: role containment before admission/config.
LOCK TABLE sgp_lp_operacion.perfil_roles IN EXCLUSIVE MODE;
SELECT id FROM sgp_lp_operacion.config WHERE id=true FOR UPDATE;
DO $$
DECLARE c sgp_lp_operacion.config%rowtype; enabled boolean;
BEGIN
 SELECT * INTO STRICT c FROM sgp_lp_operacion.config WHERE id=true;
 SELECT habilitado INTO STRICT enabled FROM sgp_lp_operacion.perfil_roles WHERE id=true;
 IF to_regclass('sgp_lp_operacion.piloto_paneles') IS NOT NULL
 OR c.adaptador_bi<>'LP-PBI-XLSX-1'
 OR NOT ((NOT enabled AND NOT c.escrituras AND NOT c.formato_bi_aprobado)
         OR (enabled AND c.escrituras AND c.formato_bi_aprobado)) THEN
  RAISE EXCEPTION 'LP_ACTIVATION_STATE_NOT_APPROVED';
 END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.sgp_lp_operacion_comando(text,jsonb)'::regprocedure)
      IS DISTINCT FROM '6327a5478c11ae6ba9a13e6966d42162'
 OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='sgp_lp_operacion.verificar_temporal(text,text,text,date,integer,text,text)'::regprocedure)
      IS DISTINCT FROM 'c39ce5692affad2b1edc4a7dbf66faf2'
 THEN RAISE EXCEPTION 'LP_SQL10_CONTRACT_DRIFT'; END IF;
 IF has_function_privilege('anon','public.sgp_lp_operacion_importar_xlsx(text,jsonb,text,text,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated','public.sgp_lp_operacion_importar_xlsx(text,jsonb,text,text,jsonb)','EXECUTE')
 OR NOT has_function_privilege('service_role','public.sgp_lp_operacion_importar_xlsx(text,jsonb,text,text,jsonb)','EXECUTE')
 OR EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated']) r
   CROSS JOIN unnest(ARRAY['public.sgp_rol_accesos','public.sgp_usuario_accesos']) t
   WHERE has_table_privilege(r,t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
 THEN RAISE EXCEPTION 'LP_ACTIVATION_ACL_UNSAFE'; END IF;
END $$;
UPDATE sgp_lp_operacion.perfil_roles SET habilitado=true WHERE id=true AND NOT habilitado;
-- No-op on retries: avoids firing revision invalidation again unnecessarily.
UPDATE sgp_lp_operacion.config SET escrituras=true,formato_bi_aprobado=true
 WHERE id=true AND NOT escrituras AND NOT formato_bi_aprobado;
COMMIT;
-- Recovery: use authorized 02_CONTENER_REVIEW.sql; retain the role profile and
-- audit/history after use. Never restore direct catalog access for UI rollback.
