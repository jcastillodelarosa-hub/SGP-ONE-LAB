-- REVIEW ONLY. Requires verified backup and explicit deployment authorization.
BEGIN;
DO $guard$ BEGIN
 IF md5(pg_get_functiondef('sgp_picking_audit_areas.resumen(uuid)'::regprocedure)) <> 'f9ae423ffd2fca879ff214c9d22aea42' THEN RAISE EXCEPTION 'SOURCE_CHANGED_REVIEW_REQUIRED'; END IF;
END $guard$;
CREATE OR REPLACE FUNCTION sgp_picking_audit_areas.resumen(id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(jsonb_build_object('id',a->>'id','nombre',a->>'nombre','revision',case when r.area is null then null else jsonb_build_object('usuario',r.usuario,'nombre',(select u.nombre from public.sgp_usuarios u where u.usuario=r.usuario limit 1),'fecha',r.fecha,'turno',r.turno,'resultado',r.resultado,'registrado_en',r.ejecutado_en,'decisiones',r.payload->'decisiones','diferencias',r.payload->'diferencias') end) order by n),'[]'::jsonb)
 from jsonb_array_elements(sgp_picking_audit_areas.esquema(id)->'areas') with ordinality q(a,n)
 left join sgp_picking_audit_areas.revisiones r on r.id_entrega=id and r.area=a->>'id';
$function$;

COMMIT;
