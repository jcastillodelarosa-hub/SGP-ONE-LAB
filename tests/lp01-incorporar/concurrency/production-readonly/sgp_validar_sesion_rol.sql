CREATE OR REPLACE FUNCTION public.sgp_validar_sesion_rol(p_token text, p_roles text[])
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$ declare v_usuario text; v_rol text; begin select u.usuario,u.rol into v_usuario,v_rol from public.sgp_sesiones_app s join public.sgp_usuarios u on u.id_usuario=s.id_usuario where s.token_hash=encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex') and s.revocado_en is null and s.expira_en>now() and u.activo=true; if v_usuario is null then raise exception 'PERMISO_DENEGADO'; end if; if v_rol=any(p_roles) then return v_usuario; end if; if v_rol='RECEPCION' and 'LIDER'=any(p_roles) then return v_usuario; end if; raise exception 'PERMISO_DENEGADO'; end $function$
