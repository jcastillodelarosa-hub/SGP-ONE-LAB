"""Synthetic PostgreSQL 17 fixture using captured column/default/function definitions.
No production rows, secrets or network. Shared metadata/PDT piece validation are bounded stubs.
"""
import json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
c=json.loads((ROOT/'tests/mecanizado-parcial/catalog.json').read_text())
auth=json.loads((ROOT/'tests/mecanizado-parcial/catalog-auth.json').read_text())
columns=c['columns']+auth['columns']+json.loads((ROOT/'tests/mecanizado-parcial/catalog-consumers.json').read_text())['columns']
out=["do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; create role authenticated; create role service_role; end if; end $$; create schema extensions; create extension pgcrypto with schema extensions; create schema sgp_pdt_multiorigen; create schema sgp_pdt_compat_91; set check_function_bodies=off;"]
tables={}
for col in columns:
    tables.setdefault(col['table_name'],{})[col['column_name']]=col
for name,cols in tables.items():
    defs=[]
    for col in cols.values():
        default=col['column_default']
        if default and ('nextval' in default): default=None
        defs.append('"'+col['column_name']+'" '+col['udt_name']+(' default '+default if default else '')+(' not null' if col['is_nullable']=='NO' else ''))
    out.append('create table public.'+name+'('+','.join(defs)+');')
for con in c['constraints']:
    if con['table'] in tables and 'FOREIGN KEY' not in con['definition']:
        out.append('alter table public.'+con['table']+' add constraint '+con['name']+' '+con['definition']+';')
out.append('alter table public.sgp_producciones add primary key(key_produccion);')
out.append("create table public.sgp_seguimiento_aluminio(id text,reserva text,activo text,linea_prog text,vent_cant_vidrio numeric); create view public.sgp_produccion_reservas_v as select sp.key_produccion,sp.produccion,sp.reserva_al reserva_principal,sp.reserva_al reserva,false es_reserva_compartida,sp.semana_actual semana_produccion,sp.acabado acabado_reserva from public.sgp_producciones sp;")
out.append("create table sgp_pdt_multiorigen.eventos(id_evento uuid primary key,usuario text,solicitud jsonb,respuesta jsonb,creado_en timestamptz);")
out.append("""
create function public.sgp_es_reserva_compartida(text) returns boolean language sql as $$ select false $$;
create function public.sgp_reservas_por_produccion_json(text) returns jsonb language sql as $$ select '[]'::jsonb $$;
create function sgp_pdt_multiorigen.actor(p_token text,p_origen text) returns text language sql as $$ select public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','PICKING']) $$;
create function sgp_pdt_multiorigen.registrar(text,text,jsonb,jsonb,uuid,uuid default null) returns jsonb language plpgsql as $$ begin raise exception 'FIXTURE: PDT pieces require separate restored integration'; end $$;
""")
# Functions referenced at runtime in this scope; all bodies are from live read-only capture.
names={'sgp_consultar_ensamble','sgp_mecanizado_prevenir_detalle_duplicado','sgp_mecanizado_ordenes_programacion','sgp_mecanizado_cobertura_programacion','sgp_mecanizado_programacion_listar','sgp_mecanizado_pendientes_turno','sgp_mecanizado_reprogramar_orden','sgp_mecanizado_guardar_estado_orden','sgp_picking_cola','sgp_mecanizado_cobertura_ordenes','sgp_picking_reporte_entregas_v1','sgp_pdt_registrar_v4','sgp_picking_rechazar_entrega_completa_duplicada','sgp_picking_recepcion_cola','sgp_validar_sesion_rol','sgp_mecanizado_programar','sgp_mecanizado_validar_prioridad_nueva','sgp_mecanizado_programada_al_insertar','sgp_mecanizado_programada_al_actualizar','sgp_mecanizado_reprogramar_reserva','sgp_mecanizado_guardar_estado_arrastre','sgp_mecanizado_detalle_reserva','sgp_picking_validar_jornada_insert'}
for f in c['functions']:
    if f['signature'].split('(')[0] in names: out.append(f['definition']+';')
for f in auth['functions']:
    if f['signature'].startswith('sgp_pdt_compat_91.'): out.append(f['definition']+';')
for t in c['triggers']:
    if t['name'] in {'sgp_mecanizado_prevenir_detalle_duplicado','sgp_mecanizado_validar_prioridad_nueva','trg_sgp_picking_no_duplicar_completa','trg_sgp_mecanizado_programada_insert','trg_sgp_mecanizado_programada_update','trg_sgp_picking_validar_jornada_insert'}:
        out.append(t['definition']+';')
out.append("grant usage on schema public to anon,authenticated; grant select,insert,update,delete on all tables in schema public to anon,authenticated;")
out.append("""
insert into public.sgp_usuarios(id_usuario,usuario,nombre,password_hash,rol,activo)
values('00000000-0000-0000-0000-000000000001','qa-coordinador','QA','fixture','COORDINADOR',true),
('00000000-0000-0000-0000-000000000002','qa-consulta','QA','fixture','CONSULTA',true),
('00000000-0000-0000-0000-000000000003','qa-picking','QA','fixture','PICKING',true);
insert into public.sgp_sesiones_app(id_usuario,token_hash,expira_en)
select id_usuario,encode(extensions.digest(usuario,'sha256'),'hex'),now()+interval '1 day' from public.sgp_usuarios;
insert into public.sgp_capacidad_linea(id,linea,proceso,capacidad_turno,capacidad_dia) values(1,'PANELES 2','MECANIZADO',90,180);
insert into public.sgp_mecanizado_arrastre_activacion(id,activado_en) values(true,'2026-01-01');
""")
print('\n'.join(out))
