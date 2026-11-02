# QA focalizada — reservas compartidas (PR #185)

Estado: **REVISIÓN / NO APLICADO**. Consultas de solo lectura contra Supabase el 2026-11-02; CI JavaScript y SGP ONE Tests en verde para commit `6e2853a`. No se ha ejecutado SQL de cambio ni pruebas funcionales sobre backend modificado.

## Regla aprobada
La primera reserva en `sgp_producciones.reserva_al` es propietaria del 100 % de las ventanas. Las siguientes son relaciones de materiales, sin duplicar cantidades.

## Datos reales contrastados (lectura)
- `8725215`, prioridad `11`: 6 producciones, **28 ventanas**; incluye `1121855 - Georges Molinard` de 12, cuyo `reserva_al` es `8725215,8725225`.
- `8725225`, prioridad `9.1`: 1 producción propia, **12 ventanas**.
- `8725225`, prioridad `9.2`: 3 producciones propias, **15 ventanas**.
- Por tanto, **8725225 conserva 27 ventanas propias**; el aviso de relación con 1121855 no debe sumarle 12 adicionales.
- `sgp_mecanizado_programar` contiene cuatro filtros de alcance por `pr.reserva`; todos deben aplicar reserva principal.
- `sgp_mecanizado_disponibles` filtra por acabado predominante y omite la producción compartida de acabado diferente; el SQL propuesto elimina esa exclusión.

## Validaciones antes de publicar
1. Ejecutar el SQL de REVIEW en PostgreSQL aislado con funciones, grants y datos sintéticos compatibles; confirmar creación, firma, SECURITY DEFINER y search_path.
2. Validar lectura: 8725215=28; 8725225=27, más aviso informativo de la orden compartida sin contabilizarla.
3. Validar guardado: 8725215 prioridad 11 permite 28 en su composición; secundaria rechaza 1121855; las otras prioridades no cambian.
4. Validar detalle y cobertura, concurrencia, partes parciales, cancelación y reprogramación; ninguna producción puede quedar doblemente contabilizada.
5. Comprobar que la pantalla mantiene el aviso secundario y muestra los 28 pendientes antes de guardar; no aceptar 16 como total de la parte.
6. Guardar definiciones originales de ambas RPC y ACL, disponer de SQL de reversión, confirmar que no hay otras migraciones concurrentes.
7. Autorizar expresamente aplicación SQL productiva, luego fusionar/publicar frontend y verificar con sesión autorizada.

## Consulta de control (solo lectura)
```sql
WITH x AS (
 SELECT pr.reserva, pr.prioridad, sp.key_produccion, sp.cantidad,
        trim(split_part(coalesce(sp.reserva_al,''),',',1)) principal
 FROM public.sgp_prioridades pr
 JOIN public.sgp_producciones sp ON sp.key_produccion=pr.key_produccion
 WHERE pr.reserva IN ('8725215','8725225') AND pr.id_linea='PANELES_2'
)
SELECT reserva,prioridad,count(*) ordenes,
       sum(cantidad) cantidad_vinculada,
       coalesce(sum(cantidad) FILTER (WHERE reserva=principal),0) cantidad_propia
FROM x GROUP BY reserva,prioridad ORDER BY reserva,prioridad;
```

**No declarar VERIFICADO en producción basándose únicamente en estas lecturas o CI.**
