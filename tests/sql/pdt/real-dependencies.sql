DO $$ BEGIN CREATE ROLE service_role; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Reconstructed TEST dependencies, NOT a complete production schema export.
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION pg_stat_statements WITH SCHEMA extensions;
CREATE TABLE public.sgp_usuarios(id_usuario uuid PRIMARY KEY DEFAULT gen_random_uuid(),usuario text UNIQUE,nombre text,rol text,activo boolean DEFAULT true);
CREATE TABLE public.sgp_sesiones_app(id_usuario uuid REFERENCES public.sgp_usuarios,token_hash text,revocado_en timestamptz,expira_en timestamptz);
INSERT INTO sgp_usuarios(usuario,nombre,rol)
 SELECT role,'QA usuario',role FROM unnest(ARRAY['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','PATINADOR','RECEPCION','PICKING','SUPERVISOR DE PICKING','LIDER LINEA','CONSULTA']) role;
INSERT INTO sgp_sesiones_app SELECT id_usuario,encode(extensions.digest(usuario,'sha256'),'hex'),NULL,now()+interval '1 day' FROM sgp_usuarios;
INSERT INTO sgp_usuarios(usuario,nombre,rol) VALUES('QA_EXPIRED','QA usuario','COORDINADOR'),('QA_NO_ROLE','QA usuario',NULL),('QA_INACTIVE','QA usuario','COORDINADOR'),('QA_REVOKED','QA usuario','COORDINADOR');
INSERT INTO sgp_sesiones_app SELECT id_usuario,encode(extensions.digest(usuario,'sha256'),'hex'),CASE WHEN usuario='QA_REVOKED' THEN now() END,
 CASE WHEN usuario='QA_EXPIRED' THEN now()-interval '1 day' ELSE now()+interval '1 day' END FROM sgp_usuarios WHERE usuario LIKE 'QA_%';
UPDATE sgp_usuarios SET activo=false WHERE usuario='QA_INACTIVE';
CREATE TABLE public.sgp_prioridades(reserva text,prioridad text,id_linea text);
INSERT INTO sgp_prioridades VALUES('QA-RES','1','PANELES_2'),('QA-DUP','1','PANELES_2');
ALTER TABLE sgp_aluminio_pendientes ALTER COLUMN id_pendiente SET DEFAULT gen_random_uuid();
ALTER TABLE sgp_aluminio_pendientes ADD COLUMN fecha_repo_ok timestamptz, ADD COLUMN reserva_principal text,
 ADD COLUMN es_reserva_compartida boolean,ADD COLUMN origen text,ADD COLUMN causa text,ADD COLUMN observacion text,
 ADD COLUMN usuario_reporte text,ADD COLUMN marca text,ADD COLUMN ventanas_afectadas integer,ADD COLUMN auditado boolean;
ALTER TABLE sgp_aluminio_pendientes_historial ADD COLUMN estado_anterior text,ADD COLUMN estado_nuevo text;
ALTER TABLE qa_reservas ADD COLUMN produccion text DEFAULT 'QA-PROD',ADD COLUMN reserva_principal text DEFAULT 'QA-RES',
 ADD COLUMN es_reserva_compartida boolean DEFAULT false,ADD COLUMN semana_produccion integer DEFAULT 44;
CREATE OR REPLACE VIEW sgp_produccion_reservas_v AS SELECT * FROM qa_reservas;
ALTER TABLE sgp_picking_entregas ALTER COLUMN id_entrega SET DEFAULT gen_random_uuid();
ALTER TABLE sgp_picking_entregas ADD COLUMN observacion text,ADD COLUMN usuario_entrega text,ADD COLUMN fecha_entrega timestamptz,
 ADD COLUMN fecha_operativa date,ADD COLUMN turno_entrega text,ADD COLUMN usuario_validacion text,ADD COLUMN fecha_validacion timestamptz,ADD COLUMN observacion_validacion text;
CREATE TABLE public.sgp_picking_faltantes(id_faltante uuid PRIMARY KEY DEFAULT gen_random_uuid(),id_entrega uuid,id_pieza text,produccion text,
 perfil text,marca text,fabricacion text,longitud numeric,cantidad numeric,observacion text,nc text,reserva_pendiente text,acabado_pendiente text,
 ventanas_afectadas integer,auditado boolean,usuario_auditoria text,fecha_auditoria timestamptz);
CREATE TABLE public.sgp_picking_auditoria_diferencias(id_diferencia uuid PRIMARY KEY DEFAULT gen_random_uuid(),id_entrega uuid,id_pieza text,perfil text,
 marca text,fabricacion text,longitud numeric,cantidad numeric,ventanas_afectadas integer,observacion text,usuario_auditoria text,reserva_pendiente text,acabado_pendiente text);
