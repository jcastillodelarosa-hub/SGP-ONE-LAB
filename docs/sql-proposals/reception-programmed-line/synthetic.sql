with sgp_recepcion_reservas(reserva,estado,anio,semana_prog,expected) as (values
('X','PEND',2026,47,false),('Y','PEND',2026,47,true),('Z','RECIBIDA',2026,47,true),('U','PEND',2026,47,true),('M','PEND',2026,47,true),('N','PEND',2026,47,true),('O','PEND',2026,47,true),('A','PEND',2026,47,true),('B','PEND',2026,47,false),('C','PEND',2026,47,true),('D','PEND',2026,47,true),('E','PEND',2026,47,true)),
sgp_lineas(id_linea,nombre) as (values ('PANELES_2','Paneles 2'),('FRAMES_2','Frames 2'),('STARTERS_Y_RECEPTORS','Starters y Receptors'),('OBRA_1','Ambigua'),('OBRA_2','Ambigua')),
sgp_seguimiento_aluminio(reserva,linea_prog,activo,anio,semana_prog,semana) as (values 
('X',' starters-y_receptors ','SI',2026,47,47),('Y','FRAMES_2','SI',2026,47,47),('Z','Frames 2','SI',2026,47,47),('U',null,'SI',2026,47,47),('M','Frames 2','SI',2026,47,47),('M','Paneles 2','SI',2026,47,47),('O','Frames 2','SI',2026,46,46),('A','Dot not assigned','SI',2026,47,47),('B','Frames 2','SI',2026,47,47),('B','FRAMES_2','SI',2026,47,47),('C','Ambigua','SI',2026,47,47),('D','Frames 2','NO',2026,47,47),('E','Frames 2','SI',2025,47,47)),
sgp_producciones(reserva_al,id_linea,activa,excluida_export,anio,semana_base) AS (values ('Y, Q','PANELES_2','SI',false,2026,47))
select count(*) cases, count(*) filter(where ((EXISTS (SELECT 1 FROM sgp_producciones prod WHERE prod.anio=r.anio AND prod.semana_base=r.semana_prog AND prod.id_linea='PANELES_2' AND prod.activa='SI' AND NOT prod.excluida_export AND trim(split_part(prod.reserva_al,',',1))=r.reserva) OR NOT EXISTS (SELECT 1 FROM sgp_producciones prod WHERE prod.anio=r.anio AND prod.semana_base=r.semana_prog AND prod.id_linea='PANELES_2' AND prod.activa='SI' AND r.reserva=ANY(string_to_array(replace(prod.reserva_al,' ',''),','))) AND (r.estado='RECIBIDA' OR NOT EXISTS (
      SELECT 1
      FROM sgp_seguimiento_aluminio s
      LEFT JOIN LATERAL (
        SELECT CASE WHEN count(DISTINCT ln.id_linea)=1 THEN min(ln.id_linea) END AS id_linea
        FROM sgp_lineas ln
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
    )))) is not distinct from expected) passes, array_agg(reserva) filter(where ((EXISTS (SELECT 1 FROM sgp_producciones prod WHERE prod.anio=r.anio AND prod.semana_base=r.semana_prog AND prod.id_linea='PANELES_2' AND prod.activa='SI' AND NOT prod.excluida_export AND trim(split_part(prod.reserva_al,',',1))=r.reserva) OR NOT EXISTS (SELECT 1 FROM sgp_producciones prod WHERE prod.anio=r.anio AND prod.semana_base=r.semana_prog AND prod.id_linea='PANELES_2' AND prod.activa='SI' AND r.reserva=ANY(string_to_array(replace(prod.reserva_al,' ',''),','))) AND (r.estado='RECIBIDA' OR NOT EXISTS (
      SELECT 1
      FROM sgp_seguimiento_aluminio s
      LEFT JOIN LATERAL (
        SELECT CASE WHEN count(DISTINCT ln.id_linea)=1 THEN min(ln.id_linea) END AS id_linea
        FROM sgp_lineas ln
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
    )))) is distinct from expected) failures from sgp_recepcion_reservas r;
