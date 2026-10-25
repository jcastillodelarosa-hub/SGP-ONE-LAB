-- Synthetic dependency fixture, NOT a Supabase backup and NOT a schema equivalence claim.
DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE public.sgp_producciones(key_produccion text PRIMARY KEY,produccion text,sistema text);
CREATE TABLE public.sgp_aluminio_pendientes(
 id_pendiente uuid PRIMARY KEY, key_produccion text,produccion text,perfil text,cantidad integer,
 estado text DEFAULT 'PENDIENTE',estado_repo text DEFAULT 'PENDIENTE',fecha_cierre timestamptz,
 validacion_estado text DEFAULT 'POR_VALIDAR',fabricacion text,longitud numeric,reserva text,acabado_pendiente text,
 id_pieza text,nc text,validado_por text,fecha_validacion timestamptz,observacion_validacion text,
 usuario_estado text,fecha_estado timestamptz,usuario_cierre text,fecha_reporte timestamptz DEFAULT now()
);
CREATE TABLE public.sgp_aluminio(id_pieza text PRIMARY KEY,id_carga text,fila_origen integer,key_produccion text,
 produccion text,codigo_sap text,sistema text,activo text,tipo_pieza text,fabricacion text,longitud numeric,acabado text,
 cantidad integer,marca text,uso text);
CREATE TABLE public.sgp_aluminio_pendientes_historial(id bigserial PRIMARY KEY,id_pendiente uuid,usuario text,tipo_evento text,
 observacion text,datos_anteriores jsonb,datos_nuevos jsonb);
CREATE TABLE public.qa_reservas(key_produccion text,reserva text,acabado_reserva text);
CREATE VIEW public.sgp_produccion_reservas_v AS SELECT * FROM public.qa_reservas;
CREATE TABLE public.sgp_nc_aluminio(consecutivo text,cod_nc text,activo boolean,estado text,responsable text,creacion timestamptz,fecha_actualizacion timestamptz);
CREATE TABLE public.sgp_mecanizado_programacion(id_programacion uuid PRIMARY KEY,reserva text,sistema text,acabado text);
CREATE TABLE public.sgp_picking_entregas(id_entrega uuid PRIMARY KEY,id_programacion uuid,produccion text,completa boolean,estado text);
CREATE FUNCTION public.sgp_validar_sesion_rol(token text,roles text[]) RETURNS text LANGUAGE plpgsql AS $$
BEGIN IF token IS NULL OR NOT token=ANY(roles) THEN RAISE EXCEPTION 'Rol no autorizado'; END IF; RETURN token; END $$;
CREATE FUNCTION public.sgp_aluminio_pendiente_resolver(p_token text,p_id uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN UPDATE public.sgp_aluminio_pendientes SET estado='RESUELTO',fecha_cierre=now() WHERE id_pendiente=p_id; RETURN '{"ok":true}'; END $$;
CREATE FUNCTION public.sgp_aluminio_pendiente_estado(p_token text,p_id uuid,p_estado text) RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN UPDATE public.sgp_aluminio_pendientes SET estado_repo=p_estado WHERE id_pendiente=p_id; RETURN '{"ok":true}'; END $$;

CREATE FUNCTION public.sgp_picking_entrega_orden(p_token text,p_id uuid,p_produccion text,p_completa boolean)
RETURNS jsonb LANGUAGE sql AS 'SELECT ''{"ok":true,"fixture":1}''::jsonb';
CREATE FUNCTION public.sgp_picking_entrega_orden(p_token text,p_id uuid,p_produccion text,p_completa boolean,p_faltantes jsonb)
RETURNS jsonb LANGUAGE sql AS 'SELECT ''{"ok":true,"fixture":2}''::jsonb';
CREATE TABLE qa_picking_defs AS SELECT oid,md5(pg_get_functiondef(oid)) digest FROM pg_proc WHERE proname='sgp_picking_entrega_orden';
