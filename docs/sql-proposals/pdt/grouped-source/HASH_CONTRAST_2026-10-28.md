# Contraste del guard de cuerpos PDT — 28/10/2026

Estado: **bloqueo de instalación**. El PR #139 sigue en Draft. No se ejecutó SQL en producción.

ChatGPT consultó `md5(prosrc)` en Supabase `ocvxbwzqxbrfndkvjmfx`: las diez primeras huellas del guard de `01_grouped_sources_REVIEW.sql` no coinciden; las tres de cierre acreditado sí. El resultado comunicado no incluye los diez valores reales ni el `prosrc` de esa misma consulta. Por tanto, no está demostrado si los cuerpos instalados son idénticos a la exportación anterior. No cambiar el guard por huellas del archivo ni eliminarlo.

Se calculó MD5 sobre los bytes **entre** `AS $function$` y `$function$` de los dos archivos de evidencia entregados por el propietario, conservando el salto de línea inicial. Este método reproduce exactamente las tres huellas de cierre. Para las otras diez, produce:

| Función (firma abreviada) | Guard actual | Cuerpo exportado | Resultado |
| --- | --- | --- | --- |
| `public.sgp_aluminio_pendiente_registrar_avance_v1` | `ae75300b61654ce54434ed85feeec967` | `13b6a17f5b45428f40c0e06a57a1f763` | Difiere |
| `public.sgp_aluminio_pendiente_validar_detalles_v1` | `82225ac71db91d5418b9b79ab6eb7c2a` | `51bed910a19ee368c2584e2b7ececc17` | Difiere |
| `public.sgp_pdt_asignar_v2` | `0b92431c8f1c5b3318fe2a2d8d9c4a71` | `93bc8e38963f5b8d14f9f33c617d7fdf` | Difiere |
| `public.sgp_pdt_cerrar_v2` | `e20373f0e5d4ca5c0ececf282eccf014` | `5db5b7696f116ee6bf9979b5eee1e336` | Difiere |
| `public.sgp_pdt_entrega_registrar_v2` | `9d2141b4b0dd887cf3aeebdcdc168441` | `9a7d984c86d4d2165e8fa08e928c5322` | Difiere |
| `public.sgp_pdt_entrega_validar_v2` | `d38c460825e18eb62792c49e0a8ec331` | `5d008017d5d191112e4747c7d5366f23` | Difiere |
| `sgp_pdt_multiorigen.nuevo_sgp_aluminio_pendiente_validar_detalles_v1` | `322b893878514e207a5e022c0c79b200` | `e008a2ad547f83e195478102721ac565` | Difiere |
| `sgp_pdt_multiorigen.nuevo_sgp_pdt_entrega_registrar_v2` | `a4c027adcd55accc397cd91aa146ea38` | `42f76cf6eabfd5c47e8b5bffaa665384` | Difiere |
| `sgp_pdt_multiorigen.original_sgp_aluminio_pendiente_validar_detalles_v1` | `2c5f310a07c8926d077601db43f55185` | `641227c7727bd9586b2ef20323a23791` | Difiere |
| `sgp_pdt_multiorigen.original_sgp_pdt_entrega_registrar_v2` | `e45fbfc78b1ba0a66b1ae9adf409a069` | `ae9345ecee5dc46195774dbbce58468c` | Difiere |
| `public.sgp_pdt_cierre_acreditado` | `8f2dcf3592e780f04b2cf47b710e2f00` | Igual | Coincide |
| `sgp_pdt_multiorigen.nuevo_sgp_pdt_cierre_acreditado` | `09a67b14a879aed2622c849cec15f15b` | Igual | Coincide |
| `sgp_pdt_multiorigen.original_sgp_pdt_cierre_acreditado` | `e7106b3fb8b5c78d8eca938556352bd1` | Igual | Coincide |

La exportación de diez funciones declara que se armó a partir de dos CSV de SQL Editor. Por sí sola no prueba fidelidad byte a byte del `prosrc` actual. La discrepancia tampoco demuestra una diferencia funcional: MD5 cambia por espacios, saltos, comentarios o semicolones. Que las tres de cierre coincidan descarta un error universal del método de extracción. La huella `641227c7727bd9586b2ef20323a23791` del cuerpo exportado de la validación original también aparece en la evidencia previa del proyecto, pero no sustituye una comparación actual.

Para desbloquear: obtener en **una consulta de solo lectura** para esas diez firmas `oid::regprocedure`, `md5(prosrc)` y `pg_get_functiondef(oid)` desde el mismo snapshot; comparar cada cuerpo con el archivo exportado y con los controles copiados en los helpers agrupados (sesión/rol, producción, reserva, PANEL, perfil, acabado, idempotencia, asignación y estado). Si solo varía representación, registrar diferencias exactas y actualizar las huellas con prueba focalizada. Si varía comportamiento, adaptar únicamente los helpers afectados y repetir sus escenarios. Cualquier diferencia no explicada mantiene el guard y la instalación bloqueada.

Consulta exacta de lectura, sin datos operativos ni tokens (exportar **todas** las filas y la columna `definicion` completa, sin truncarla):

```sql
WITH firmas(firma) AS (VALUES
 ('public.sgp_aluminio_pendiente_registrar_avance_v1(text,uuid,uuid,integer,text,date,uuid,text)'),
 ('public.sgp_aluminio_pendiente_validar_detalles_v1(text,uuid,jsonb,text,text)'),
 ('public.sgp_pdt_asignar_v2(text,uuid,uuid)'),
 ('public.sgp_pdt_cerrar_v2(text,uuid,uuid)'),
 ('public.sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)'),
 ('public.sgp_pdt_entrega_validar_v2(text,uuid)'),
 ('sgp_pdt_multiorigen.nuevo_sgp_aluminio_pendiente_validar_detalles_v1(text,uuid,jsonb,text,text)'),
 ('sgp_pdt_multiorigen.nuevo_sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)'),
 ('sgp_pdt_multiorigen.original_sgp_aluminio_pendiente_validar_detalles_v1(text,uuid,jsonb,text,text)'),
 ('sgp_pdt_multiorigen.original_sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)')
)
SELECT f.firma, md5(p.prosrc) AS md5_prosrc, pg_get_functiondef(p.oid) AS definicion
FROM firmas f LEFT JOIN pg_proc p ON p.oid=to_regprocedure(f.firma)
ORDER BY f.firma;
```

Las pruebas aisladas anteriores continúan válidas para los cuerpos de fixture, pero no certifican compatibilidad con los cuerpos instalados. No se repitieron porque este cambio es documental.
