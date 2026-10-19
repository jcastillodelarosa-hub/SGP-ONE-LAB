-- LAB post-v281 · Hotfix permisos RPC de arrastre en Producción
-- 2026-10-19
--
-- Contexto:
-- El frontend usa Supabase con el rol de base de datos "anon" y autoriza
-- operaciones mediante p_token + sgp_validar_sesion_rol dentro de las RPC.
-- La migración live "mecanizado_arrastre_estado_reservas_sin_parte"
-- había revocado EXECUTE a anon para esta función, aunque el frontend
-- continuó invocándola desde el navegador.
--
-- Seguridad:
-- No se concede a PUBLIC. La función sigue siendo SECURITY DEFINER y
-- valida los roles SGP permitidos internamente.

revoke execute on function public.sgp_mecanizado_guardar_estado_arrastre(text,uuid,text,text) from public;
grant execute on function public.sgp_mecanizado_guardar_estado_arrastre(text,uuid,text,text)
to anon, authenticated, service_role;
