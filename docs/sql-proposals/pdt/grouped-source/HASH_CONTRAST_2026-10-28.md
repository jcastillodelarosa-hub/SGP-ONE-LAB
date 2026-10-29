# Contraste del guard de cuerpos PDT — 28/10/2026

Estado: **huellas corregidas en rama; instalación productiva pendiente de autorización y preflight**. El PR #139 sigue en Draft. No se ejecutó SQL en producción.

En la primera lectura, ChatGPT comunicó que las diez primeras huellas del guard de `01_grouped_sources_REVIEW.sql` no coincidían; las tres de cierre acreditado sí. Esa respuesta inicial no incluía los diez valores reales. Por ello no se modificó el guard en aquel momento.

**Actualización posterior:** ChatGPT confirmó expresamente que las diez huellas instaladas coinciden con las exportaciones anteriores. Confirmó además PK `sgp_pdt_fuentes(id_detalle)`, índice activo `(id_entrega,id_pieza)` y cero filas con `id_pieza=''`. Sobre esa evidencia se sustituyeron únicamente las diez constantes incorrectas del guard por el MD5 de cada cuerpo exportado; las tres de cierre no cambiaron. El guard sigue abortando ante cualquier diferencia actual. La tabla siguiente documenta los valores **anteriores** del guard y sus reemplazos.

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

La confirmación posterior de ChatGPT cerró el contraste de huellas: los cuerpos instalados corresponden a las exportaciones, mientras el guard anterior contenía diez constantes erróneas. No hay evidencia de una diferencia funcional entre **instalado y exportado**. El contraste entre exportado y auxiliares agrupados, incluido el cambio intencional de relación 1:1 a conjunto de fuentes, se resume abajo. Una diferencia nueva o no explicada al ejecutar el guard sigue bloqueando la instalación.

Consulta opcional para una comprobación independiente futura de solo lectura, sin datos operativos ni tokens (exportar **todas** las filas y la columna `definicion` completa, sin truncarla):

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

## Contraste funcional de auxiliares

| Contrato instalado | Auxiliar agrupado | Conservación y diferencia intencional |
| --- | --- | --- |
| Despachadores públicos de validar y entregar | Despachadores nuevos | Mantienen la ruta original/V4 para detalles con `id_pieza` físico; solo encaminan al auxiliar agrupado cuando el detalle nuevo usa `id_pieza=''`. |
| Validadores original/V4 | `grouped_original_validar`, `grouped_nuevo_validar` | Conservan sesión/roles, bloqueo del PDT, estado activo, ausencia de movimientos, longitud/cantidad positivas, observación para corrección, PANEL, producción/reserva/perfil/acabado, historial y actualización atómica. Admiten una o varias fuentes elegibles y registran cada snapshot; la cantidad se inserta una vez por `id_detalle`. El original conserva su predicado directo; V4 conserva la comprobación maestro PANEL y línea `PANELES_2` por identidad de producción. |
| Entrega original/V4 | `grouped_original_entrega`, `grouped_nuevo_entrega` | Conservan permisos, clave idempotente, bloqueo de PDT/entrega/programación, identidad de evento, comprobación de fuente y `entrega <= avance neto`. V4 verifica la fuente física `f.id_pieza` contra el resolvedor; el original conserva la comprobación de `snapshot.key_produccion`. La línea agrupada usa `id_pieza=''` y `id_detalle` sin asignar unidades a una fuente arbitraria. |
| Avances, asignación, validación de entrega y cierre públicos | Sin redefinición | Se conservan sus cuerpos instalados. Trabajan con `id_detalle`, cantidades y estados; las pruebas aisladas cubren avance parcial, asignación, validación y cierre. |
| Cierre acreditado original/V4 | Auxiliares agrupados de acreditación | Conservan evento validado, reserva, sistema, acabado y suma de asignaciones. Sustituyen el JOIN multiplicador de fuentes por `EXISTS`, de modo que dos fuentes no duplican una cantidad. Los PDT físicos siguen en el cuerpo original/V4. |

Este contraste utiliza los cuerpos completos de las diez funciones exportadas y la confirmación de sus MD5 instalados; no certifica un despliegue. El guard, el esquema y los índices aún se vuelven a comprobar al ejecutar la migración en un entorno restaurado o en la ventana autorizada.

Pruebas focalizadas tras actualizar el guard: 13/13 huellas locales calculadas de los cuerpos exportados coinciden con el guard; Node 12/12; PostgreSQL 17.11 aislado, cuatro escenarios SQL transaccionales con ROLLBACK aprobados: original con dos fuentes, V4 con dos fuentes y rol denegado, fuente única y LEGACY cerrado, dos detalles agrupados en una entrega. Incluyen avance parcial, saldo, entrega, asignación y cierre sin suma multiplicada. La matriz LEGACY abierta/validada/con movimientos/cerrada de la ejecución aislada anterior permanece aplicable porque este commit solo cambia constantes de guard y documentación; la ruta física original/V4 no cambió. Esto no certifica datos productivos ni aplicación real.
