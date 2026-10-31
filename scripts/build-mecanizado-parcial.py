"""Build REVIEW migration from exact, read-only captured catalog. Never connects to DB."""
import hashlib,json,pathlib,re
ROOT=pathlib.Path(__file__).resolve().parents[1]
CAT=json.loads((ROOT/'tests/mecanizado-parcial/catalog.json').read_text())
FUN={x['signature']:x['definition'] for x in CAT['functions']}
PDT=json.loads((ROOT/'tests/mecanizado-parcial/catalog-pdt-real.json').read_text())
FUN.update({x['signature']:x['definition'] for x in PDT['functions']})
changed={}
def edit(signature,fn):
    original=FUN[signature]
    result=fn(original)
    assert result!=original,signature
    changed[signature]=result
def once(s,a,b):
    assert s.count(a)==1,(a,s.count(a))
    return s.replace(a,b)
def inject(s,code):
    return re.sub(r'\bbegin\b',lambda m:m[0]+'\n'+code,s,count=1,flags=re.I)

# The historical branch keeps its existing duplicate guard; parts get quantitative coverage.
edit('sgp_mecanizado_prevenir_detalle_duplicado()',lambda s:inject(s,"""
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.key_produccion,742));
 if exists(select 1 from sgp_mecanizado_parcial.partes pt where pt.id_programacion=new.id_programacion) then
  if not exists(select 1 from sgp_mecanizado_parcial.partes pt
    join public.sgp_mecanizado_programacion mp using(id_programacion)
    join public.sgp_producciones sp on sp.key_produccion=pt.key_produccion
    where pt.id_programacion=new.id_programacion and pt.key_produccion=new.key_produccion
      and pt.cantidad=new.cantidad_snapshot and mp.cantidad_programada=pt.cantidad
      and new.reserva_snapshot=mp.reserva and new.produccion_snapshot=sp.produccion) then
   raise exception 'DETALLE_DE_PARTE_INCONSISTENTE'; end if;
  if new.cantidad_snapshot+sgp_mecanizado_parcial.asignada(new.key_produccion)>
   (select cantidad from public.sgp_producciones where key_produccion=new.key_produccion) then
   raise exception 'CANTIDAD_SUPERA_SALDO'; end if;
  return new;
 end if;
 if exists(select 1 from sgp_mecanizado_parcial.partes where key_produccion=new.key_produccion) then
  raise exception 'USAR_PROGRAMACION_POR_PARTES';
 end if;
"""))

# Quantity consumers retain historical quantities, but use part quantities on new records.
edit('sgp_mecanizado_ordenes_programacion(text,uuid)',lambda s:once(s,"'cantidad',sp.cantidad,","'cantidad',coalesce((select cantidad from sgp_mecanizado_parcial.partes where id_programacion=d.id_programacion),sp.cantidad),"))
edit('sgp_mecanizado_cobertura_programacion(text,integer)',lambda s:once(s,'sum(sp.cantidad),0)::int cantidad_cubierta','sum(coalesce((select cantidad from sgp_mecanizado_parcial.partes where id_programacion=mp.id_programacion),sp.cantidad)),0)::int cantidad_cubierta'))
edit('sgp_mecanizado_programacion_listar(text)',lambda s:once(s,'to_jsonb(p) ORDER BY',"to_jsonb(p)||coalesce((select jsonb_build_object('parte_id',pt.id_programacion,'key_produccion',pt.key_produccion,'parte_numero',pt.numero,'identificador_parte',p.produccion||'-P'||pt.numero) from sgp_mecanizado_parcial.partes pt where pt.id_programacion=p.id_programacion),'{}'::jsonb) ORDER BY"))
def carry(s):
    s=once(s,'round(coalesce(sp.cantidad,0))::int cantidad',"coalesce((select cantidad from sgp_mecanizado_parcial.partes where id_programacion=mp.id_programacion),round(coalesce(sp.cantidad,0)))::int cantidad")
    s=once(s,'partition by reserva,key_produccion order by',"partition by reserva,key_produccion,case when exists(select 1 from sgp_mecanizado_parcial.partes pt where pt.id_programacion=base.id_programacion) then id_programacion end order by")
    return once(s,"'id_programacion_origen',id_programacion,","'parte_id',(select pt.id_programacion from sgp_mecanizado_parcial.partes pt where pt.id_programacion=eligible.id_programacion),'identificador_parte',(select produccion||'-P'||pt.numero from sgp_mecanizado_parcial.partes pt where pt.id_programacion=eligible.id_programacion),'id_programacion_origen',id_programacion,")
edit('sgp_mecanizado_pendientes_turno(text,date,text)',carry)

# Part moves update the same header. Legacy transfers remain byte-for-byte in their branch.
edit('sgp_mecanizado_reprogramar_orden(text,uuid,text,date,text,integer,text)',lambda s:inject(s,"""
 if exists(select 1 from sgp_mecanizado_parcial.partes where id_programacion=p_id_programacion) then
  if p_produccion is distinct from (select produccion from public.sgp_mecanizado_programacion where id_programacion=p_id_programacion) then raise exception 'PRODUCCION_AJENA_A_PARTE'; end if;
  return public.sgp_mecanizado_parte_mover(p_token,p_id_programacion,p_fecha,p_turno,p_prioridad,p_motivo,false);
 end if;
"""))
def state(s):
    return inject(s,"""
 if exists(select 1 from sgp_mecanizado_parcial.partes where id_programacion=p_id_programacion) then
  perform public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA']);
  perform 1 from public.sgp_mecanizado_programacion where id_programacion=p_id_programacion for update;
  if p_produccion is distinct from (select produccion from public.sgp_mecanizado_programacion where id_programacion=p_id_programacion)
   or p_estado='REPROGRAMADO' then raise exception 'ESTADO_O_PRODUCCION_INVALIDA_PARA_PARTE'; end if;
  if exists(select 1 from public.sgp_picking_entregas where id_programacion=p_id_programacion) and p_estado<>'PROCESADO' then
   raise exception 'PARTE_CON_ENTREGAS_NO_PUEDE_RETROCEDER'; end if;
 end if;
""")
edit('sgp_mecanizado_guardar_estado_orden(text,uuid,text,text,text)',lambda s:once(state(s),'RETURN true;',"""
 if public.sgp_mecanizado_es_parte(p_id_programacion) then
  insert into public.sgp_mecanizado_ejecucion(id_programacion,estado,cantidad_procesada,observacion,usuario,actualizado_en)
  select p_id_programacion,new_state,case when new_state='PROCESADO' then cantidad else 0 end,p_observacion,u,now()
  from sgp_mecanizado_parcial.partes where id_programacion=p_id_programacion
  on conflict(id_programacion) do update set estado=excluded.estado,cantidad_procesada=excluded.cantidad_procesada,
  observacion=coalesce(excluded.observacion,public.sgp_mecanizado_ejecucion.observacion),usuario=u,actualizado_en=now();
 end if;
 RETURN true;
 """))

# Scope Picking to exact part and snapshot; never all orders belonging to the weekly priority.
def picking(s):
    s=once(s,'sum(sp.cantidad)::int cantidad_ventanas',"sum(coalesce((select cantidad from sgp_mecanizado_parcial.partes where id_programacion=b.id_programacion),sp.cantidad))::int cantidad_ventanas")
    s=once(s,"and sp.activa='SI'","and sp.activa='SI' and (not exists(select 1 from sgp_mecanizado_parcial.partes pt where pt.id_programacion=b.id_programacion) or sp.key_produccion=(select key_produccion from sgp_mecanizado_parcial.partes where id_programacion=b.id_programacion))")
    s=once(s,'sp.produccion,sp.proyecto,sp.cantidad,coalesce',"sp.produccion,sp.proyecto,coalesce((select cantidad from sgp_mecanizado_parcial.partes where id_programacion=p.id_programacion),sp.cantidad) cantidad,coalesce")
    s=once(s,"where pr.reserva=p.reserva and pr.id_linea='PANELES_2'", "where (not exists(select 1 from sgp_mecanizado_parcial.partes pt where pt.id_programacion=p.id_programacion) or sp.key_produccion=(select key_produccion from sgp_mecanizado_parcial.partes where id_programacion=p.id_programacion)) and pr.reserva=p.reserva and pr.id_linea='PANELES_2'")
    s=once(s,"select p.id_programacion,p.reserva,p.parte,", "select coalesce((select sum(en.cantidad) from sgp_mecanizado_parcial.entregas en join public.sgp_picking_entregas pe using(id_entrega) where en.id_programacion=p.id_programacion and pe.estado in ('PENDIENTE_VALIDACION','VALIDADA','AUDITADA_DIFERENCIA')),0) cantidad_entregada,(select pt.id_programacion from sgp_mecanizado_parcial.partes pt where pt.id_programacion=p.id_programacion) parte_id,(select p.produccion||'-P'||pt.numero from sgp_mecanizado_parcial.partes pt where pt.id_programacion=p.id_programacion) identificador_parte,p.id_programacion,p.reserva,p.parte,")
    return s
edit('sgp_picking_cola(text)',picking)

# Complete order coverage previously meant an entire production. Aggregate only new parts.
def coverage(s):
    # Keep the legacy implementation in a private function and merge per-key partial results.
    private=s.replace('public.sgp_mecanizado_cobertura_ordenes(', 'sgp_mecanizado_parcial.cobertura_legacy(',1)
    wrapper="""
CREATE OR REPLACE FUNCTION public.sgp_mecanizado_cobertura_ordenes(p_token text,p_semana integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=sgp_mecanizado_parcial.cobertura_legacy(p_token,p_semana);
 return coalesce((select jsonb_agg(x) from (
 select value x from jsonb_array_elements(result) j where not exists(select 1 from sgp_mecanizado_parcial.partes pt where pt.key_produccion=j.value->>'key_produccion')
 union all
 select jsonb_build_object('reserva',pr.reserva,'prioridad_semanal',pr.prioridad,'key_produccion',sp.key_produccion,'produccion',sp.produccion,
 'cantidad',sp.cantidad,'cantidad_programada',sgp_mecanizado_parcial.asignada(sp.key_produccion),
 'cantidad_pendiente',greatest(sp.cantidad-sgp_mecanizado_parcial.asignada(sp.key_produccion),0),
 'estado_orden',case when sgp_mecanizado_parcial.asignada(sp.key_produccion)>=sp.cantidad then 'PROGRAMADA'
 when sgp_mecanizado_parcial.asignada(sp.key_produccion)>0 then 'PARCIAL' else 'PENDIENTE' end,'origen_cobertura','PARCIAL_AGREGADA')
 from public.sgp_prioridades pr join public.sgp_producciones sp using(key_produccion)
 where exists(select 1 from sgp_mecanizado_parcial.partes pt where pt.key_produccion=sp.key_produccion)
 and pr.id_linea='PANELES_2' and sp.id_linea='PANELES_2'
 and (p_semana is null or coalesce(sp.semana_actual,sp.semana_base)=p_semana)
 ) rows),'[]');
end $$;
"""
    return private+';\n'+wrapper
edit('sgp_mecanizado_cobertura_ordenes(text,integer)',coverage)

# Reports count a production key once across P1/P2 and retain historical grouping elsewhere.
sig='sgp_picking_reporte_entregas_v1(text,date,date,text,text,integer,integer)'
edit(sig,lambda s:s.replace('count(DISTINCT (e.id_programacion,e.produccion,p.sistema))',"count(DISTINCT (coalesce((select pt.key_produccion from sgp_mecanizado_parcial.partes pt where pt.id_programacion=e.id_programacion),e.id_programacion::text||'|'||e.produccion),p.sistema))"))

edit('sgp_pdt_registrar_v4(text,text,jsonb,jsonb,uuid)',lambda s:s.replace('public.sgp_pdt_registrar_v4(', 'sgp_mecanizado_parcial.registro_legacy(',1)+';\n'+(ROOT/'docs/sql-proposals/mecanizado/parcial/registration.sql').read_text())
edit('sgp_picking_rechazar_entrega_completa_duplicada()',lambda s:inject(s,"if public.sgp_mecanizado_es_parte(new.id_programacion) then return new; end if;"))
edit('sgp_picking_recepcion_cola(text)',lambda s:once(s,"'cantidad_ventanas',coalesce(sp.cantidad,0)","'cantidad_ventanas',coalesce((select en.cantidad from sgp_mecanizado_parcial.entregas en where en.id_entrega=pe.id_entrega),sp.cantidad,0)"))

def assembly(s):
    old="left join lateral(select eo.estado,eo.observacion from public.sgp_mecanizado_ejecucion_orden eo where eo.produccion=p.produccion order by eo.actualizado_en desc nulls last limit 1)mo on true"
    new="""left join lateral(
      select eo.estado,eo.observacion from public.sgp_mecanizado_ejecucion_orden eo
      where eo.produccion=p.produccion and not exists(select 1 from sgp_mecanizado_parcial.partes where key_produccion=p.key_produccion)
      union all
      select case when sum(case when eo.estado='PROCESADO' then pt.cantidad else 0 end)>=p.cantidad then 'PROCESADO'
        when bool_or(eo.estado in ('MECANIZADO','PROCESADO')) then 'MECANIZADO'
        when bool_or(eo.estado='CORTE') then 'CORTE' else 'SIN INICIAR' end,
        string_agg(p.produccion||'-P'||pt.numero||': '||coalesce(eo.observacion,''),' | ' order by pt.numero)
      from sgp_mecanizado_parcial.partes pt join public.sgp_mecanizado_programacion mp using(id_programacion)
      left join public.sgp_mecanizado_ejecucion_orden eo on eo.id_programacion=pt.id_programacion and eo.produccion=mp.produccion
      where pt.key_produccion=p.key_produccion and mp.estado<>'CANCELADA'
      having count(*)>0
    )mo on true"""
    # Keep the historical latest-state branch single-row; the new aggregate is one row per production.
    new=new.replace("select eo.estado,eo.observacion from public.sgp_mecanizado_ejecucion_orden eo", "select eo.estado,eo.observacion from (select eo.* from public.sgp_mecanizado_ejecucion_orden eo where eo.produccion=p.produccion order by eo.actualizado_en desc nulls last limit 1) eo")
    return once(s,old,new)
edit('sgp_consultar_ensamble(text,integer,text)',assembly)

# Report rows expose explicit delivered windows. Planned part quantities are never delivery evidence.
sig='sgp_picking_reporte_entregas_v1(text,date,date,text,text,integer,integer)'
changed[sig]=once(changed[sig], 'SELECT e.id_entrega,e.id_programacion,e.produccion,e.completa,e.estado,e.observacion,', """SELECT (select pt.key_produccion from sgp_mecanizado_parcial.partes pt where pt.id_programacion=e.id_programacion) key_produccion_parte,
   (select pt.id_programacion from sgp_mecanizado_parcial.partes pt where pt.id_programacion=e.id_programacion) parte_id,
   (select e.produccion||'-P'||pt.numero from sgp_mecanizado_parcial.partes pt where pt.id_programacion=e.id_programacion) identificador_parte,
   (select en.cantidad from sgp_mecanizado_parcial.entregas en where en.id_entrega=e.id_entrega) cantidad_ventanas_entregadas,
   e.id_entrega,e.id_programacion,e.produccion,e.completa,e.estado,e.observacion,""")

# Real PDT/shared-reserve integration. Historical non-part branches retain their finish rule.
edit('sgp_picking_piezas_panel(text,uuid,text)',lambda body:inject(body,(ROOT/'docs/sql-proposals/mecanizado/parcial/picking-panel-branch.sql').read_text()))
def sources(body):
    body=once(body,"AND x->>'tipo_pieza'='PANEL'", "AND (p_origen<>'PICKING' OR NOT public.sgp_mecanizado_es_parte(program.id_programacion) OR x->>'key_produccion'=(SELECT key_produccion FROM sgp_mecanizado_parcial.partes WHERE id_programacion=program.id_programacion)) AND x->>'tipo_pieza'='PANEL'")
    return once(body,"AND upper(btrim(x->>'acabado'))=upper(btrim(program.acabado))", "AND (public.sgp_mecanizado_es_parte(program.id_programacion) OR upper(btrim(x->>'acabado'))=upper(btrim(program.acabado)))")
edit('sgp_pdt_multiorigen.fuentes(text,text,jsonb)',sources)
for signature,alias,finish in [
 ('sgp_pdt_multiorigen.nuevo_sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)','pe','d.acabado'),
 ('sgp_pdt_multiorigen.grouped_nuevo_entrega(text,uuid,uuid,integer,uuid)','pe','d.acabado'),
 ('sgp_pdt_multiorigen.nuevo_sgp_pdt_cierre_acreditado(uuid)','e','d.acabado'),
 ('sgp_pdt_multiorigen.grouped_nuevo_cierre_acreditado(uuid)','e','d.acabado'),
 ('sgp_pdt_multiorigen.nuevo_sgp_pdt_picking_v2(text,uuid)','pe','p.acabado_pendiente')]:
    edit(signature,lambda body,alias=alias,finish=finish:once(body,'upper(btrim(mp.acabado))=upper(btrim('+finish+'))', 'sgp_mecanizado_parcial.material_pdt(p.id_pendiente,'+alias+'.id_entrega,'+finish+')'))
# A homonymous production without parts cannot inherit the state of another key's part.
sig='sgp_consultar_ensamble(text,integer,text)'
changed[sig]=once(changed[sig],'eo.produccion=p.produccion order by eo.actualizado_en',"eo.produccion=p.produccion and not exists(select 1 from sgp_mecanizado_parcial.partes pt where pt.id_programacion=eo.id_programacion) order by eo.actualizado_en")
# Quantity and material recovery are independent dimensions.
sig='sgp_picking_cola(text)'
changed[sig]=once(changed[sig],'select coalesce((select sum(en.cantidad)',"select (select count(*) from sgp_mecanizado_parcial.contextos_pdt src join public.sgp_aluminio_pendientes ap using(id_pendiente) join public.sgp_picking_entregas original on original.id_entrega=src.id_entrega where original.id_programacion=p.id_programacion and ap.estado='PENDIENTE') pdt_abiertos,coalesce((select sum(en.cantidad)")

for signature,alias,finish in [
 ('sgp_pdt_multiorigen.original_sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)','pe','d.acabado'),
 ('sgp_pdt_multiorigen.grouped_original_entrega(text,uuid,uuid,integer,uuid)','pe','d.acabado'),
 ('sgp_pdt_multiorigen.original_sgp_pdt_cierre_acreditado(uuid)','e','d.acabado'),
 ('sgp_pdt_multiorigen.grouped_original_cierre_acreditado(uuid)','e','d.acabado'),
 ('sgp_pdt_multiorigen.original_sgp_pdt_picking_v2(text,uuid)','pe','p.acabado_pendiente')]:
    def legacy_material(body,alias=alias,finish=finish):
        body=once(body,'mp.reserva=p.reserva','(mp.reserva=p.reserva OR public.sgp_mecanizado_es_parte(mp.id_programacion))')
        return once(body,'upper(btrim(mp.acabado))=upper(btrim('+finish+'))','sgp_mecanizado_parcial.material_pdt(p.id_pendiente,'+alias+'.id_entrega,'+finish+')')
    edit(signature,legacy_material)

sig='sgp_picking_recepcion_cola(text)'
changed[sig]=once(changed[sig],"'id_entrega',pe.id_entrega", "'parte_id',(select id_programacion from sgp_mecanizado_parcial.partes where id_programacion=pe.id_programacion),'identificador_parte',(select pe.produccion||'-P'||numero from sgp_mecanizado_parcial.partes where id_programacion=pe.id_programacion),'id_entrega',pe.id_entrega")
changed[sig]=once(changed[sig],"where s.produccion=pe.produccion and s.id_linea='PANELES_2'", "where s.produccion=pe.produccion and s.id_linea='PANELES_2' and (not public.sgp_mecanizado_es_parte(pe.id_programacion) or s.key_produccion=(select key_produccion from sgp_mecanizado_parcial.partes where id_programacion=pe.id_programacion))")

def audit(body):
    body=once(body,'v_finish text;', 'v_finish text; v_nuevo uuid;')
    body=once(body,' for f in select value from jsonb_array_elements',"""
+ if public.sgp_mecanizado_es_parte(e.id_programacion) then
+  select pt.key_produccion,mp.reserva,public.sgp_es_reserva_compartida(pt.key_produccion)
+  into strict v_key,v_principal,v_shared from sgp_mecanizado_parcial.partes pt
+  join public.sgp_mecanizado_programacion mp using(id_programacion) where pt.id_programacion=e.id_programacion;
+ end if;
+ for f in select value from jsonb_array_elements""".replace('\n+','\n'))
    body=once(body,"  if coalesce((f->>'ventanas_afectadas')::int,0)<1", "  if public.sgp_mecanizado_es_parte(e.id_programacion) and (f->>'ventanas_afectadas')::integer>(select cantidad from sgp_mecanizado_parcial.partes where id_programacion=e.id_programacion) then raise exception 'VENTANAS_AFECTADAS_SUPERAN_PARTE'; end if;\n  if coalesce((f->>'ventanas_afectadas')::int,0)<1")
    body=once(body,"  v_diff:=true;", "  if public.sgp_mecanizado_es_parte(e.id_programacion) and (nullif(d->>'id_pieza','') is null or (d->>'cantidad') is null or (d->>'cantidad')::numeric<=0 or (d->>'cantidad')::numeric<>trunc((d->>'cantidad')::numeric) or (d->>'cantidad')::numeric>(select cantidad from public.sgp_aluminio where id_pieza=d->>'id_pieza')) then raise exception 'CANTIDAD_MATERIAL_INVALIDA'; end if;\n  v_diff:=true;")
    body=once(body,"  v_diff:=true;", "  if public.sgp_mecanizado_es_parte(e.id_programacion) and coalesce((d->>'ventanas_afectadas')::integer,1)>(select cantidad from sgp_mecanizado_parcial.partes where id_programacion=e.id_programacion) then raise exception 'VENTANAS_AFECTADAS_SUPERAN_PARTE'; end if;\n  v_diff:=true;")
    body=once(body,"  if coalesce((f->>'ventanas_afectadas')::int,0)<1", """  if public.sgp_mecanizado_es_parte(e.id_programacion) and not exists(
+   select 1 from public.sgp_picking_faltantes pf where pf.id_faltante=(f->>'id_faltante')::uuid
+   and pf.id_entrega=p_id_entrega and pf.id_pieza is not distinct from nullif(f->>'id_pieza','')
+  ) then raise exception 'FALTANTE_AJENO_A_ENTREGA'; end if;
+  if coalesce((f->>'ventanas_afectadas')::int,0)<1""".replace('\n+','\n'))
    target="and (reserva=e.reserva or reserva=(select pf.reserva_pendiente from public.sgp_picking_faltantes pf where pf.id_faltante=(f->>'id_faltante')::uuid));"
    body=once(body,target,target[:-1]+" and (not public.sgp_mecanizado_es_parte(e.id_programacion) or exists(select 1 from sgp_mecanizado_parcial.contextos_pdt src where src.id_pendiente=public.sgp_aluminio_pendientes.id_pendiente and src.id_entrega=p_id_entrega));")
    target="greatest(coalesce((d->>'ventanas_afectadas')::int,1),1),true\n  );"
    body=once(body,target,target[:-1]+" returning id_pendiente into v_nuevo;\n  if public.sgp_mecanizado_es_parte(e.id_programacion) then insert into sgp_mecanizado_parcial.origenes_pdt values(v_nuevo,p_id_entrega); end if;")
    return body
edit('sgp_picking_validar_recepcion(text,uuid,jsonb,jsonb,text)',audit)

out=['-- REVIEW ONLY: requires separate production authorization.\nbegin;\nset local lock_timeout=\'5s\';\n']
for sig in changed:
    md5=hashlib.md5(FUN[sig].encode()).hexdigest()
    out.append(f"do $guard$ begin if md5(pg_get_functiondef('{sig}'::regprocedure))<>'{md5}' then raise exception 'CATALOGO_CAMBIO: {sig}'; end if; end $guard$;\n")
out.append((ROOT/'docs/sql-proposals/mecanizado/parcial/core.sql').read_text())
out.append((ROOT/'docs/sql-proposals/mecanizado/parcial/pdt-context.sql').read_text())
out.append("create table sgp_mecanizado_parcial.respaldo_funciones(firma text primary key,definicion text not null,instalada text); alter table sgp_mecanizado_parcial.respaldo_funciones enable row level security; revoke all on sgp_mecanizado_parcial.respaldo_funciones from public,anon,authenticated;\n")
for sig,definition in changed.items():
    out.append(f"insert into sgp_mecanizado_parcial.respaldo_funciones values('{sig}',pg_get_functiondef('{sig}'::regprocedure),null);\n")
    out.append(definition+';\n')
    out.append(f"update sgp_mecanizado_parcial.respaldo_funciones set instalada=md5(pg_get_functiondef('{sig}'::regprocedure)) where firma='{sig}';\n")
out.append((ROOT/'docs/sql-proposals/mecanizado/parcial/lifecycle.sql').read_text())
out.append("revoke all on all functions in schema sgp_mecanizado_parcial from public,anon,authenticated;\nnotify pgrst,'reload schema';\ncommit;\n")
target=next((ROOT/'supabase/migrations').glob('*_mecanizado_programacion_parcial.sql'))
target.write_text(re.sub(r'(?m)^[ \t]+$','','\n'.join(out)))
print(target.relative_to(ROOT))
