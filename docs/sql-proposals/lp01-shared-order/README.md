> Corrección dirigida PR208: estado NC de pendientes hidratado por el lector
> existente, con concurrencia limitada, revocación y descarte al desmontar.
> NC vidrio queda por verificar hasta disponer de relación canónica segura.
> La evidencia previa de enlace exitoso queda superada por `nc-scope.py`;
> no acredita disponibilidad actual de enlace. No hay SQL productivo ejecutado.

# Orden compartida — propuesta en desarrollo

Base `a068e14083bb92db6e72c71934d8cf240ef345ff` (LAB v396). No instalada,
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
- NC escrita se conserva por verificar. No se acredita una relación canónica
  entre la fuente NC y producción/línea: orden, OVE y texto de línea no bastan.
  Consulta devuelve fuente/huella nulas tanto para números existentes como ausentes;
  LINK_NC rechaza en servidor. No se exponen orden, estado ni existencia ajenos.
  Para habilitar vínculo falta definir una relación canónica auditada y revisarla;
  no se crea ni se infiere aquí. NC finalizada no acredita recepción física.
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

**Vistas conectadas localmente al contrato nuevo; no activadas en producción.** Se conserva API de montaje
`mountTrackingAffectations({host,row,target,cause,scope,client,getToken,isCurrent})`;
`target` es opcional, `scope.stage` sigue como ámbito de autorización.
No se han modificado archivos de hojas/PDA ni la geometría visual en este corte.
La guía original `libfile_8eb9eaa8a3388191b3ce358f9a22661a` fue resuelta por
prepare_materialize; devolvió transferencia, no workspace_path. El helper vigente
falló con `download failed` a destino `/workspace/approved-guide/SGP_Guia_Visual_27_Bocetos.html`.
Sin archivo local ni inspección de píxeles; no se reintentó ni eludió restricción.
Pendiente inspección de píxeles B10 original, acople de distintivos por el hilo
de hojas y CI del candidato completo al congelar. La conexión PC/móvil de las
cinco pestañas ya pasó en aislamiento, según la evidencia siguiente.

## Conexión funcional local — 06/11/2026

Las cinco pestañas existentes ya usan el servicio compartido a través de la API
original `mountTrackingAffectations`. No hay selector de turno ni fallback de
escritura al contrato antiguo. Si falta el backend nuevo, los reportes anteriores
siguen visibles y el guardado compartido queda deshabilitado. La nota global sigue
independiente. Se conserva la geometría existente, sin rediseño.

Chromium + PostgreSQL sintético PC1440/móvil390: registro, pérdida de respuesta y
reintento mismo UUID, vínculo NC, nota desde Ensamble visible en Empaque,
corrección desde Empaque visible en Ensamble, Accesorios y techo Tecno PASS.
`tests/lp01-shared-order/browser-result.json` y `evidence/shared-*.png`.
`tests/lp01-order-details/browser.py` adaptada al backend compartido ausente y
techo aprobado: nota CAS/reintento, cinco pestañas, panel B10 inferior y sin
sobresalir en móvil PASS. No equivale a prueba productiva.

La lectura Library directa del PDF maestro `libfile_2f0d0baa08f481919c5a2e27786f5d96`
página14 devolvió texto y `image_asset_pointer`, sin bloque de píxeles renderizado.
No se afirma inspección original; se siguió la especificación del coordinador y
se inspeccionaron las capturas sintéticas propias.

### Integración mínima para el hilo de hojas

Sin modificar `lp01-operation.js` aquí: al refrescar el resumen de fila, consultar
`sharedOrderTransport({client,getToken,key,line,stage}).read()` y pasar el resultado
junto al snapshot nativo a `sharedOrderSummary(nativeSnapshot,sharedSnapshot)` de
`src/domain/lp01-shared-order-summary.js`. Si hay reportes compartidos y heredados
posiblemente coincidentes, devuelve cantidad desconocida, no suma ni valida unión.
El adaptador siempre deja total/disponible desconocidos; no acredita el antiguo
consolidado contra el conjunto nuevo. Este acople de distintivos está pendiente.

Se adaptaron las pruebas de contexto obligatorio en `native-app.py`,
`unassigned-app.py`, B10, pending-ui y visual-focus. Conservan origen nativo,
revocación, borrador y protección frente a respuestas tardías. El guardado sin
turno se prueba contra PostgreSQL aislado sin modificar turnos/asignaciones;
el escritor nativo anterior conserva su prueba de turno real abierto.
`lp01-b12-b13/browser.py` queda con el dueño de hojas: su rama de coordinador
no se ejecuta en la lista actual de usuarios, y no se modifica aquí.
No se reintentó crear PR tras la denegación reiterada; pendiente autorización
específica. Este delta permanece local hasta coordinación.
