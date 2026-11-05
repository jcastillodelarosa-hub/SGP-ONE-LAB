-- Original aggregate supplied by coordinator; archived only, NOT rerun by PR203.
BEGIN READ ONLY;
SELECT jsonb_build_object(
 'current',(SELECT jsonb_agg(to_jsonb(a)) FROM (SELECT id_linea,count(*) FILTER(WHERE porc_vidrio>0 AND porc_vidrio<100) AS partial_pct,count(*) FILTER(WHERE porc_vidrio<>trunc(porc_vidrio)) AS fractional_pct,count(*) FILTER(WHERE cantidad*porc_vidrio/100<>trunc(cantidad*porc_vidrio/100)) AS fractional_windows_from_pct FROM public.sgp_producciones GROUP BY id_linea)a),
 'history',(SELECT jsonb_agg(to_jsonb(a)) FROM (SELECT id_linea,count(*) AS rows,count(*) FILTER(WHERE porc_vidrio IS NULL) AS nulls,min(porc_vidrio) AS min_pct,max(porc_vidrio) AS max_pct,count(*) FILTER(WHERE porc_vidrio<0 OR porc_vidrio>100) AS out_of_range,count(*) FILTER(WHERE porc_vidrio>0 AND porc_vidrio<1) AS between_zero_one,count(*) FILTER(WHERE porc_vidrio=1) AS exactly_one,count(*) FILTER(WHERE porc_vidrio>1 AND porc_vidrio<=100) AS above_one_to_hundred,count(*) FILTER(WHERE porc_vidrio<>trunc(porc_vidrio)) AS fractional_pct FROM public.sgp_export_diario_historial WHERE presente=true GROUP BY id_linea)a),
 'last_cut_quantity',(SELECT jsonb_agg(to_jsonb(a)) FROM (SELECT p.id_linea,count(*) AS matched,count(*) FILTER(WHERE h.datos?'cantidad') AS has_input_quantity,count(*) FILTER(WHERE nullif(h.datos->>'cantidad','')::numeric IS DISTINCT FROM p.cantidad) AS differs_from_order_quantity FROM public.sgp_producciones p JOIN public.sgp_export_diario_historial h ON h.key_produccion=p.key_produccion AND h.id_linea=p.id_linea AND h.id_carga_diaria=p.ultima_carga_diaria WHERE h.presente=true GROUP BY p.id_linea)a)) AS evidence;
ROLLBACK;
BEGIN READ ONLY;
SELECT n.nspname,p.proname,md5(p.prosrc) AS body_md5,md5(pg_get_functiondef(p.oid)) AS definition_md5 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='public' AND p.proname='sgp_aplicar_export_diario') OR (n.nspname='sgp_pdt_manual' AND p.proname='original_aplicar_export_diario');
ROLLBACK;
