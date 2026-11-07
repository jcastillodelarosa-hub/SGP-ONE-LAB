CREATE OR REPLACE FUNCTION sgp_lp_operacion.acceso_rol(u text, et text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 SELECT EXISTS(SELECT 1 FROM public.sgp_usuarios a WHERE a.usuario=u AND a.activo
 AND cardinality(sgp_lp_operacion.operaciones_rol(a.rol,et))>0
 AND EXISTS(SELECT 1 FROM public.sgp_rol_accesos r WHERE r.rol=a.rol AND r.permitido AND r.ventana IN('ensamble',CASE et WHEN 'ENSAMBLE' THEN 'ensamble.operacion-ensamble' ELSE 'ensamble.operacion-empaque' END))
 AND(a.rol='ADMINISTRADOR' OR EXISTS(SELECT 1 FROM public.sgp_usuario_accesos v WHERE v.id_usuario=a.id_usuario AND v.permitido AND v.ventana IN('ensamble',CASE et WHEN 'ENSAMBLE' THEN 'ensamble.operacion-ensamble' ELSE 'ensamble.operacion-empaque' END))))
$function$

