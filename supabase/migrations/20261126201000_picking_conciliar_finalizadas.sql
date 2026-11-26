-- Add a read-only, order-specific flag to the existing Picking contract.
-- Keep the current function, role gate, grants, and delivery records intact.
do $patch$
declare
  source text := pg_get_functiondef('public.sgp_picking_cola(text)'::regprocedure);
  output_anchor constant text := $$'estado_mecanizado',z.estado_mecanizado,'reserva_compartida'$$;
  output_new constant text := $$'estado_mecanizado',z.estado_mecanizado,'finalizada_sin_saldo',z.finalizada_sin_saldo,'reserva_compartida'$$;
  select_anchor constant text := $$public.sgp_es_reserva_compartida(pr.key_produccion) reserva_compartida,$$;
  select_new constant text := $$coalesce(upper(btrim(sp.estado_produccion))='FINALIZADA'
                 and sp.saldo_ensamble=0 and sp.saldo_empaque=0,false) finalizada_sin_saldo,
               public.sgp_es_reserva_compartida(pr.key_produccion) reserva_compartida,$$;
begin
  if strpos(source,output_new)>0 and strpos(source,select_new)>0 then return; end if;
  if strpos(source,'finalizada_sin_saldo')>0
     or cardinality(string_to_array(source,output_anchor))<>2
     or cardinality(string_to_array(source,select_anchor))<>2 then
    raise exception 'No coincide el contrato vigente de sgp_picking_cola; revisar antes de aplicar';
  end if;
  execute replace(replace(source,output_anchor,output_new),select_anchor,select_new);
end
$patch$;
