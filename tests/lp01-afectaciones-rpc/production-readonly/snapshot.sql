BEGIN READ ONLY; SET LOCAL statement_timeout='15s';
SELECT clock_timestamp() AS observed_at,current_setting('transaction_read_only') AS read_only,
to_regnamespace('sgp_lp_afectaciones') IS NULL AS new_schema_absent,
(SELECT jsonb_build_object('writes',escrituras,'bi_format_approved',formato_bi_aprobado) FROM sgp_lp_operacion.config WHERE id) AS lp_flags,
(SELECT habilitado FROM sgp_lp_operacion.perfil_roles WHERE id) AS native_role_profile,
(SELECT count(*) FROM public.sgp_aluminio_pendientes p WHERE p.origen='PICKING' AND EXISTS(SELECT 1 FROM sgp_pdt_multiorigen.detalles d WHERE d.id_pendiente=p.id_pendiente) AND EXISTS(SELECT 1 FROM sgp_pdt_manual.detalles d WHERE d.id_pendiente=p.id_pendiente)) AS overlapping_native_manual_sources,
(SELECT count(*) FROM public.sgp_aluminio_pendientes p WHERE p.origen='PICKING' AND p.key_produccion IS NOT NULL AND EXISTS(SELECT 1 FROM public.sgp_producciones x WHERE x.key_produccion=p.key_produccion)) AS exact_key_readable_candidates;
ROLLBACK;
