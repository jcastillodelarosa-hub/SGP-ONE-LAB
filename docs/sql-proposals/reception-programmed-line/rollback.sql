-- Applies only to the reviewed function fingerprint. Rollback is the exact inverse.
do $patch$
declare
 f regprocedure := 'public.sgp_recepcion_listar(text,integer)'::regprocedure;
 body text;
 new_body text;
 old_owner oid;
 old_acl aclitem[];
 before_fragment constant text := $before$))) AND (r.estado='RECIBIDA' OR NOT EXISTS (
      SELECT 1
      FROM public.sgp_seguimiento_aluminio s
      LEFT JOIN LATERAL (
        SELECT CASE WHEN count(DISTINCT ln.id_linea)=1 THEN min(ln.id_linea) END AS id_linea
        FROM public.sgp_lineas ln
        WHERE regexp_replace(upper(trim(s.linea_prog)), '[[:space:]_-]+', '', 'g') IN (
          regexp_replace(upper(trim(ln.id_linea)), '[[:space:]_-]+', '', 'g'),
          regexp_replace(upper(trim(ln.nombre)), '[[:space:]_-]+', '', 'g')
        )
      ) identificada ON true
      WHERE s.reserva=r.reserva AND s.anio=r.anio
        AND coalesce(s.semana_prog,s.semana)=r.semana_prog
        AND coalesce(s.activo,'SI')='SI'
      HAVING count(*) > 0 AND count(identificada.id_linea)=count(*)
        AND count(DISTINCT identificada.id_linea)=1
        AND min(identificada.id_linea)<>'PANELES_2'
    ))) )x),'[]'::jsonb);end $function$$before$;
 after_fragment constant text := $after$)))) )x),'[]'::jsonb);end $function$$after$;
begin
 select pg_get_functiondef(p.oid), p.proowner, p.proacl
 into strict body, old_owner, old_acl from pg_proc p where p.oid=f;
 if md5(body) <> 'abb0f16d4f28cdcd5e6471845b5e6b50' OR strpos(body,before_fragment)=0 then
   raise exception 'Unexpected reception function definition; no changes applied';
 end if;
 new_body := replace(body,before_fragment,after_fragment);
 if md5(new_body) <> '39021e316617f02e35c1049c28ea9eb0' then
   raise exception 'Unexpected patched reception function; no changes applied';
 end if;
 execute new_body;
 if not exists (
   select 1 from pg_proc p where p.oid=f
     and md5(pg_get_functiondef(p.oid))='39021e316617f02e35c1049c28ea9eb0'
     and p.proowner=old_owner and p.proacl is not distinct from old_acl
 ) then
   raise exception 'Reception function, owner or grants do not match the approved contract';
 end if;
end;
$patch$;
