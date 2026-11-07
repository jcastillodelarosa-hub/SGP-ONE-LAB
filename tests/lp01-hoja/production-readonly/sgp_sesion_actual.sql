CREATE OR REPLACE FUNCTION public.sgp_sesion_actual(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare u sgp_usuarios%rowtype;
begin
 select x.* into u from sgp_sesiones_app s join sgp_usuarios x on x.id_usuario=s.id_usuario
 where s.token_hash=encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex')
 and s.revocado_en is null and s.expira_en>now() and x.activo=true;
 if u.id_usuario is null then return jsonb_build_object('valida',false); end if;
 return jsonb_build_object('valida',true,'usuario',u.usuario,'nombre',u.nombre,'rol',u.rol);
end $function$

