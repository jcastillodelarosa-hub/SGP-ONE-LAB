# Orden compartida — propuesta en desarrollo

Base `d45c5ed28a3cbafbb08179bdfaa138afaed8464c` (LAB v394). No instalada,
activada ni publicada. No cambia hojas/PDA, PR206, sesión, roles existentes,
pins, HOLD o política. El incremento NC previo permanece respaldado en stash.

## Contrato preparado

- Lectura y escritura por `key_produccion` canónica (incluye línea), compartidas
  entre Ensamble y Empaque. Etapa de entrada acredita permiso; etapa del evento
  conserva quién y desde dónde actuó. Sin fecha/turno ficticios ni requisito ABIERTO.
- CREATE/CORRECT/SOLVE/CONFIRM/LINK_NC con revisión común, UUID de reintento,
  actor, reloj servidor y auditoría antes/después. No modifica Disponible/Export.
- Ventanas informadas por actor autorizado, independientes de piezas.
  Accesorio importado opcional solo por ID y key exacta; claves ambiguas excluidas.
  Faltante manual sin fuente se identifica como tal, sin inventar vínculo.
- NC por consecutivo exacto. Escribir referencia no acredita asociación.
  LINK_NC explícito coteja huella actual, guarda evidencia y snapshot; finalizada
  nunca acredita solución ni recepción física. La consulta actual es independiente
  del snapshot histórico. Se reutiliza la lógica de fuente/reintento del bloque NC guardado.
- Reportes anteriores se leen en `legacyReports` sin migrarlos, clonarlos ni
  sumar sus cantidades al conjunto nuevo. Conservan etapa/turno originales.
- Observación reutiliza las RPC globales de PR203 sin nuevos permisos; comprobada
  escritura desde supervisor Ensamble y lectura desde supervisor Empaque.
- Tecno conserva decimal exacto y añade `rounded` con techo aprobado; no crea
  reportes TECNO ni valida unión de ventanas por sumar causas.

## Permisos y activación pendiente de revisión específica

`01_definition_REVIEW.sql`: nuevo esquema privado `sgp_lp_shared_order`, cuatro
 tablas con RLS, dos helpers privados y estas tres RPC públicas:

- `public.sgp_lp_shared_order_read_v1(text,text,text)`
- `public.sgp_lp_shared_order_command_v1(text,text,text,jsonb)`
- `public.sgp_lp_shared_nc_lookup_v1(text,text,text,text)`

Owner postgres, search_path vacío, EXECUTE revocado de PUBLIC/anon/authenticated/
service_role por defecto. `02_activate_REVIEW.sql` concede solo esas tres a anon
 y activa únicamente `sgp_lp_shared_order.config.writes`. Preserva contención
 global y de afectaciones; CONFIRM exige además physical y rol vigente
 COORDINADOR/LIDER LINEA. No cambia matriz de roles ni ACL históricas. La nueva
 consulta NC es acotada a la orden autorizada LP y admite sus líderes, sin
 modificar el lector semanal antiguo. Esto requiere revisión de instalación.

`03_contain_REVIEW.sql` desactiva únicamente el nuevo escritor y revoca esas tres
 RPC de anon. Conserva todos los datos y auditoría. Ningún script fue ejecutado
 contra producción. Huellas esperadas en `activation-manifest.json` proceden del
 PostgreSQL aislado, no acreditan instalación productiva.

## Evidencia y siguiente paso

`tests/lp01-shared-order/contracts-result.json`: PostgreSQL sintético con auth
 capturada, turnos cerrados, etapas compartidas, CAS/reintentos, NC, accesorios,
 revocación, nota global, rollback de auditoría y permisos privados.
Pruebas Node: transporte/identidad, borrador conserva revisión y UUID incierto,
 techo decimal. No sesión productiva ni aceptación en planta.

**Vistas todavía no conectadas al contrato nuevo.** Se conserva API de montaje
`mountTrackingAffectations({host,row,target,cause,scope,client,getToken,isCurrent})`;
`target` será opcional, `scope.stage` seguirá como ámbito de autorización.
No se han modificado archivos de hojas/PDA ni la estructura visual en este corte.
La guía original `libfile_8eb9eaa8a3388191b3ce358f9a22661a` fue resuelta por
prepare_materialize; devolvió transferencia, no workspace_path. El helper vigente
falló con `download failed` a destino `/workspace/approved-guide/SGP_Guia_Visual_27_Bocetos.html`.
Sin archivo local ni inspección de píxeles; no se reintentó ni eludió restricción.
Pendiente inspección B10 y conexión de las cinco pestañas existentes; luego pruebas
PC/móvil integradas, CI del candidato completo y coordinación de versión/integración.
