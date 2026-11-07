# Handoff mínimo de integración · NO ejecutable / no aplicado

No se editan `sgp_lp_operacion_comando`, importador, CERRAR ni el planificador.
Este documento no autoriza instalación, activación, permisos ni nuevos endpoints.

## INCORPORAR post-v406

Base recibida del parent: comando candidato MD5
`ee5acef7b560bf3864d4e419e9925a4b`, todavía contenido. El rebase debe exigir el pin
exacto y preservar su filtro de exclusión, permisos, CAS, orden de locks y recibo.

1. Tras autorización `u`, CAS y lock NOWAIT del planificador, **antes** del primer
   INSERT en asignaciones, si `plan_control.enabled=true`:
   `plan_iniciar_cambio(u,'INCORPORAR',btrim(p_cmd->>'observation'),rid,
   jsonb_build_array(jsonb_build_object('date',d,'shift',t)),p_cmd)`.
2. El replay propio del comando ya debe haber devuelto su recibo antes de este punto.
   Un recibo de plan preexistente sin el recibo del comando es inconsistente: no
   repetir altas ni fingir commit. Rechazar y revisar.
3. Después de crear la asignación/orden y actualizar revisión, **antes** de su
   auditoría/RETURN, `plan_finalizar_cambio(res)` devuelve `{requestId,result,
   planVersions:[{date,shift,versionId}]}`. Añadir `planVersions` al recibo del
   comando si el nuevo contrato lo declara. Todo sigue en la misma transacción;
   fallo del audit final revierte asignación, versión y ambos recibos.
4. Con bandera false no se llama a estos helpers; el cuerpo anterior conserva
   comportamiento. No habilitar INCORPORAR planificado sin revisar sus dependencias.

Los helpers aceptan actor solamente porque son privados y el caller servidor ya
lo acredita. No exponer `plan_iniciar_cambio` como RPC ni aceptar `u` del navegador.
No usar un GUC para atribuir identidad ni motivo.

## Planificador

Firmas privadas preparadas, **sin GRANT ni fachada pública**:

- `plan_programar(token,key,date,shift,quantity,priority,motive,requestId)`
- `plan_mover(token,assignmentId,date,shift,quantity,priority,motive,requestId)`

El servidor deriva actor mediante sesión/rol y verifica acceso LP individual/de
rol/temporal. Llama a las funciones originales; no cambia su saldo/capacidad,
semana/reserva/origen o algoritmo de split. Motivo es texto humano no vacío y el
UUID se conserva para reintentar la misma solicitud; cambiar payload con mismo
UUID se rechaza. Nunca almacenar el token en plan_recibos ni payload.

Mínimo UI futuro: campo motivo en programar/mover y petición durable, también en
programDirect/moveDirect/programGroup y recorridos de drag/drop que los utilizan.
La firma legacy no acepta motivo. Preparar una fachada revisada con permisos
existentes antes de cambiar llamadas; no inventar sobrecargas activas o atajos.
La bandera permanecerá false hasta que esa integración esté lista y aprobada.

No se implementa una cancelación nueva sin el cuerpo/contrato autoritativo. El
trigger conserva evidencia de cancelaciones externas y bloquea comparación hasta
una acreditación posterior explícita, sin atribuir un motivo histórico falso.

## Importación y cierre

Cierre obtiene `plan_comparar(d,t,realizedRows)` **dentro** de su transacción final,
con los locks fuente conservados hasta INSERT/COMMIT. Debe reautorizar unión de
plan/Export, guardar snapshot y comparación exactos y mantener motivos/CAS/archivo,
no filtrar objetivos que falten en el universo importado.

Actuales pins import/close son incompatibles con INCORPORAR post-v406. El rebase es
separado, no se modifica ni aplica la cadena anterior. LP-EXPORT-CLOSE-3/lector
runtime actuales permanecen contenidos, sin autoridad de este plan anunciada.
