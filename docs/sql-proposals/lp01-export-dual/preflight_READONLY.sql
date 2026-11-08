WITH pins(signature,expected_md5) AS (VALUES
('public.sgp_linea_plan_programar(text,text,date,integer,integer,integer)','248f9feb45f1c2d260896aa95c3e1569'),
('public.sgp_linea_plan_mover(text,uuid,date,integer,integer,integer)','52752c4887c68f8336e38c08a58cc38b'),
('sgp_lp_operacion.sesion(text,text,text,text)','3416a2f6e5640577a4a07c554e26c55e'),
('sgp_lp_operacion.verificar_temporal(text,text,text,date,integer,text,text)','c39ce5692affad2b1edc4a7dbf66faf2'),
('public.sgp_lp_operacion_importar_xlsx(text,jsonb,text,text,jsonb)','eae247d88b7e82d4dc365840dfb03e45'),
('public.sgp_lp_operacion_comando(text,jsonb)','ee5acef7b560bf3864d4e419e9925a4b'),
('public.sgp_lp_operacion_consultar(text,text,text,date,integer)','31a67d573c387f322a1737cda8181f13'),
('public.sgp_lp_operacion_resultado(text,uuid)','23ce7654c7478bec15978bd09c97a67c')), funcs AS (SELECT signature,expected_md5,to_regprocedure(signature) oid FROM pins)
SELECT jsonb_build_object(
'functions',(SELECT jsonb_agg(jsonb_build_object('signature',f.signature,'expected',f.expected_md5,'actual',md5(p.prosrc),'match',md5(p.prosrc)=f.expected_md5,'owner',pg_get_userbyid(p.proowner),'securityDefiner',p.prosecdef,'config',p.proconfig,'acl',p.proacl::text)) FROM funcs f LEFT JOIN pg_proc p ON p.oid=f.oid),
'privateTables',(SELECT jsonb_object_agg(n,to_regclass('sgp_lp_operacion.'||n) IS NOT NULL) FROM unnest(ARRAY['plan_control','plan_baselines','plan_cambios','inclusiones_empaque']) n),
'config',(SELECT to_jsonb(c) FROM sgp_lp_operacion.config c WHERE id),
'columns',(SELECT jsonb_agg(jsonb_build_object('schema',table_schema,'table',table_name,'column',column_name,'type',data_type,'nullable',is_nullable)) FROM information_schema.columns WHERE (table_schema='public' AND table_name IN('sgp_linea_plan_asignaciones','sgp_linea_plan_ejecuciones','sgp_producciones') AND column_name IN('excluida_export','id','key_produccion','fecha','turno','cantidad','prioridad','estado','origen_id','observacion','creado_por','actualizado_en','asignacion_id')) OR (table_schema='sgp_lp_operacion' AND table_name IN('plan_control','inclusiones_empaque')))
) AS preflight;
