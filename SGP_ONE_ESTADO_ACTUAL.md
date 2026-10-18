# SGP_ONE — DOCUMENTO MAESTRO DE CONTINUIDAD

## 1. INFORMACIÓN GENERAL
- Proyecto: SGP_ONE
- Objetivo: Sistema de gestión de producción de ventanería en aluminio y vidrio.
- Repositorio: GitHub
- Hosting: Firebase
- Versión de package.json: 0.1.0 (no equivale necesariamente a la versión publicada)
- Última revisión documental: 2026-10-14

## 2. ARQUITECTURA
### Estructura comprobada en GitHub (rama main)
- Interfaz: `index.html`, `styles.css`.
- Aplicación: `app.js`.
- Código organizado: `src/modules`, `src/services`, `src/domain`, `src/data`, `src/config`.
- Módulo identificado: `src/modules/mecanizado.js`.
- Servicios: seguimiento de aluminio, maestro de piezas, importación de producciones y cliente Supabase.
- Dominio: importadores de aluminio, vidrio, accesorios, NC y producciones.
- Hosting configurado: `firebase.json`.
- Persistencia: existen cliente Supabase y migraciones SQL; verificar esquema y despliegue real.
- Documentación: `docs/architecture.md`, `docs/migration-plan.md`, `docs/supabase-setup.md`.
- Pruebas: archivos en `tests/`, ejecutables potencialmente con `npm test`; no ejecutadas en esta revisión.

### Reglas documentadas en `docs/architecture.md`
- Jerarquía: SGP ONE → línea de producción → sublínea física → proceso.
- Identidad de producción: `ID + ID_LINEA`.
- Logística de reserva: `PENDIENTE_ABASTECIMIENTO → PENDIENTE_BODEGA → ALUMINIO_ENTREGADO`.
- Proceso productivo: `CORTE → MECANIZADO → PROCESADO → PICKING`.
- `PROCESADO` significa mecanizado terminado; `PICKING` significa material entregado a línea.
- El patinador reporta lo entregado y pendiente; la línea confirma independientemente la recepción.
- La clasificación de piezas PANEL / FRAME / COVER / REFUERZO / MUNTIN aplica únicamente a `PANELES_2` y `FRAMES_2`.
- Seguimiento Aluminio usa clave `ID|RESERVA`; relación con producción por `ID`.
- Apps Script permanece operativo durante la migración y validación de módulos.

### Información aún por documentar:
- Estructura del código.
- Tecnologías y servicios.
- Base de datos.
- Integraciones.
- Autenticación y permisos.
- Dependencias entre módulos.

## 3. MÓDULOS DEL SISTEMA
- Programación de producción.
- Mecanizado.
- Auditoría de reservas.
- Entregas y picking.
- Pendientes de aluminio.
- Ensamble.
- Novedades y no conformidades.

Para cada módulo registrar:
- Funcionalidades existentes.
- Funcionalidades verificadas.
- Funcionalidades pendientes.
- Errores conocidos.
- Dependencias.

## 4. REGLAS DE NEGOCIO
### Entregas y picking
- PICKING: entrega registrada.
- CON PENDIENTES: existen órdenes o cantidades pendientes.
- POR VALIDAR: entrega pendiente de auditoría.
- PDT CORRECCIÓN: diferencia identificada durante la auditoría de picking.
- Las entregas parciales deben conservar trazabilidad por orden y producción.
- Las definiciones y transiciones deben verificarse contra las decisiones aprobadas.

### Auditoría de reservas
- Registrar fecha y turno de recepción.
- Permitir fotografías de la reserva.
- Identificar si la reserva está completa.
- Registrar los pendientes cuando esté incompleta.

## 5. CAMBIOS PENDIENTES DE VERIFICAR
- Sistema y acabado en partidas abiertas.
- Fecha de primera entrega.
- Contador de días abierta.
- Fecha y turno al entregar.
- Estados de entrega y picking.
- Alineación de encabezados.
- Desplazamiento en ventanas y dispositivos móviles.

## 6. HISTORIAL DE DECISIONES
Para cada decisión registrar:
- Fecha.
- Módulo.
- Requisito aprobado.
- Motivo.
- Estado de implementación.

## 7. ERRORES Y CORRECCIONES
Para cada incidencia registrar:
- Descripción.
- Cómo reproducirla.
- Causa identificada.
- Corrección aplicada.
- Resultado de pruebas.

## 8. CONTROL DE VERSIONES
- Revisión documental inicial: 2026-10-14. No se han modificado archivos funcionales.
- Estado de despliegue: no verificado.
- Rama activa:
- Último commit verificado:
- Versión publicada:
- Fecha de despliegue:
- Pruebas realizadas:

## 9. PRÓXIMAS ACTIVIDADES
1. Inspeccionar `app.js`, `src/modules/mecanizado.js` y las migraciones para verificar implementaciones y transiciones de estado.
2. Reconstruir las reglas de negocio aprobadas.
3. Actualizar el estado de cada módulo.
4. Priorizar los desarrollos pendientes.

## 10. PROTOCOLO DE CONTINUIDAD
Antes de desarrollar:
1. Consultar este documento.
2. Revisar el código actual de GitHub.
3. Identificar dependencias y reglas existentes.
4. No asumir implementaciones no verificadas.

Después de desarrollar:
1. Registrar modificaciones realizadas.
2. Identificar archivos afectados.
3. Documentar pruebas y resultados.
4. Registrar errores y pendientes.
5. Actualizar este documento.
6. Dejar identificado el siguiente paso.

Nunca declarar una funcionalidad como implementada o publicada sin verificarlo.


## 11. CONTINUIDAD 2026-10-17 — REPORTE DE TURNO MECANIZADO (LAB v264)
- Implementado control **Generar reporte de turno** en Producción de Mecanizado.
- Fuente del reporte: programación del día/turno + ejecución de reserva/orden + novedades existentes. No altera estados ni programación.
- Reporte incluye: Programado, Ejecutado, Pendiente, % avance, avance compacto por sistema (Programadas/Completas/En proceso), Programación vs Ejecución con Parte, pendientes del siguiente turno, novedades y comentario general.
- Se agregó persistencia del comentario general por fecha + turno en tabla `sgp_mecanizado_reportes_turno`.
- Salidas implementadas: vista previa, PNG y PDF horizontal.
- Archivos modificados: `app.js`, `index.html`, `styles.css`.
- Versión visual incrementada: LAB v264.
- Pendiente de verificación funcional: validar en Firebase con datos reales que los totales ejecutados por orden coincidan con la operación y que la exportación PDF/PNG funcione en PC y móvil.
- Observación de seguridad detectada durante revisión: existen tablas operativas con RLS deshabilitado. No se modificó RLS en esta sesión para evitar bloquear el sistema sin diseñar previamente sus políticas.


## 12. CONTINUIDAD 2026-10-18 — ESTABILIZACIÓN DE CONEXIÓN (LAB v265)
- Incidencia: la consola del navegador mostraba 404 recurrente para `/sgp-gateway/` y podía mostrar 404 para `/vendor/supabase.js`.
- Causa comprobada: `src/services/supabase-client.js` intentaba detectar un gateway Firebase no configurado en `firebase.json`.
- Corrección: se eliminó la detección/uso de `/sgp-gateway/` y se dejó Supabase directa como única ruta de datos, respetando el backend actual del LAB.
- `/vendor/supabase.js` se mantiene como dependencia local del navegador y el workflow la genera mediante `npm run build:vendor` antes del despliegue.
- Versión visible actualizada a **LAB v265** y cache-busting de `styles.css` / `app.js` actualizado a 265.
- Dependencias funcionales preservadas: autenticación de aplicación, RPC, RLS, tablas Supabase y módulos consumidores del cliente.
- Estado: implementado en `main`; publicación Firebase depende del workflow automático; verificación final en navegador pendiente.


## 13. CONTINUIDAD 2026-10-18 — CARGA MULTIHOST DEL SDK SUPABASE (LAB v266)
- Incidencia verificada: en GitHub Pages la aplicación solicitaba `/vendor/supabase.js` desde la raíz del dominio y recibía 404; el archivo `vendor/supabase.js` se genera durante el workflow de Firebase y no existe como archivo versionado en `main`.
- Dependencia afectada: inicialización del cliente Supabase; por ello autenticación y módulos que consultan datos podían quedar en “Validando…” / “Cargando…”.
- Corrección: `src/services/supabase-client.js` intenta primero `vendor/supabase.js` con ruta relativa (compatible con Firebase y con el subdirectorio de GitHub Pages) y, si no existe, usa fuentes CDN de respaldo fijadas a Supabase JS 2.76.1.
- Se conserva Supabase directa como backend; no se modifican tablas, RPC, estados ni reglas de negocio.
- Versión visible incrementada a **LAB v266** y cache-busting de `styles.css` / `app.js` actualizado a 266.
- Estado al registrar: implementado en código; publicación y verificación en navegador pendientes del workflow.


## 14. CONTINUIDAD 2026-10-18 — ESTABILIZACIÓN LAB v266
- Decisión: **v266 se estabiliza sin incrementar versión**, porque no se agrega funcionalidad; se corrige su paquete de publicación para recuperar acceso estable.
- Supabase permanece como backend. El Gateway se desarrolla exclusivamente en `SGP_ONE_GOOGLE`; no se incorpora Gateway, SQL Connect ni Data Connect al LAB. Esta separación sigue el acuerdo del proyecto paralelo: Supabase permanece y el Gateway se valida aparte antes de integrarlo.
- Se elimina del workflow del LAB la generación y bundle de SQL/Data Connect y se retira Firebase SDK como dependencia runtime del LAB.
- El navegador utiliza exclusivamente el SDK Supabase local `./vendor/supabase.js`, generado antes del deploy. Se eliminan fallbacks CDN para que la operación no dependa de dominios externos bloqueables.
- Se agrega `scripts/verify-release.mjs`: bloquea el despliegue si faltan archivos críticos, si falta `vendor/supabase.js`, si reaparecen Gateway/CDN/SQL Connect/Data Connect en el cliente o workflow, o si la versión deja de ser LAB v266.
- Firebase Hosting queda como entorno operativo del LAB; GitHub Pages deja de considerarse publicación operativa.
- No se modifican RPC, tablas, datos, estados ni reglas funcionales.
- Verificación requerida después del deploy: abrir Firebase Hosting, confirmar LAB v266, ausencia de 404 de `vendor/supabase.js`, estado “Sin sesión”, realizar login y confirmar navegación/permisos.


## 15. CONTINUIDAD 2026-10-18 — LAB v267 · ARRASTRE DE PENDIENTES ENTRE TURNOS
- Regla aplicada: el arrastre se habilita **5 minutos después del inicio del turno entrante**: 07:05 para TURNO 1 y 19:05 para TURNO 2 (zona America/Bogota).
- Las órdenes/producciones no culminadas permanecen en su programación original y se muestran adicionalmente arriba del turno entrante en “Pendientes del turno anterior”.
- El arrastre reutiliza el `id_programacion` de origen; no crea una programación nueva ni elimina la original.
- La culminación desde el turno entrante continúa guardándose sobre la ejecución/orden original, conservando historial de cambios.
- La vista del turno original conserva la marca **NO CULMINADO** cuando el PROCESADO ocurrió después del corte del turno + 5 minutos.
- Si el pendiente sigue sin PROCESADO, el RPC puede seguir mostrándolo en turnos posteriores; no se pierde por no haber culminado en el primer arrastre.
- Se modificó `sgp_mecanizado_pendientes_turno` en Supabase y `app.js`; no se modificaron tablas ni otros módulos.
- Estado: implementación aplicada en Supabase y GitHub. Publicación Firebase y prueba visual pendientes de confirmar.


### Corrección v267 — permiso RPC de arrastre
- Durante la prueba real del 2026-10-18 se confirmó que el frontend no mostraba ningún arrastre aunque existían órdenes de TURNO 2 del 2026-10-17 en estado PROGRAMADA/CORTE.
- Causa raíz: `sgp_mecanizado_pendientes_turno(text,date,text)` no tenía permiso EXECUTE para el rol PostgREST `anon`. El SGP usa sesión propia mediante `p_token`, por lo que las RPC operativas equivalentes sí están expuestas a `anon` y validan internamente el token/rol.
- Se aplicó migración `grant_anon_mecanizado_pendientes_turno` concediendo únicamente EXECUTE a `anon`. La función mantiene `SECURITY DEFINER` y continúa validando `p_token` con `sgp_validar_sesion_rol`.
- Verificación SQL: `has_function_privilege('anon', ..., 'EXECUTE') = true`.
- No requiere nuevo despliegue Firebase: la corrección es inmediata en Supabase.
- Pendiente: refrescar Producción del 2026-10-18 y verificar visualmente el bloque “Pendientes del turno anterior”.


## 16. CONTINUIDAD 2026-10-18 — LAB v268 · PICKING SEMANA + FILTROS MÓVILES
- Se agrega indicador grande `SEM xx` en cada tarjeta normal de Picking.
- Se agrega el mismo indicador de semana en cada “Partida abierta de entrega”, tomando la semana de la reserva/parte cargada por `sgp_picking_cola`.
- No se cambia la lógica de entregas, auditoría, piezas PANEL, estados ni partidas abiertas; el cambio es de presentación sobre los datos ya existentes.
- En móvil, la barra de filtros de Picking pasa a una cuadrícula de 2 columnas: búsqueda ocupa el ancho completo, semana y estado quedan visibles lado a lado, y Actualizar ocupa el ancho completo.
- Se eliminan en móvil las restricciones de ancho que estaban comprimiendo los selectores hasta hacerlos prácticamente invisibles.
- Versión visible: LAB v268.
- Estado: implementado en GitHub; publicación Firebase y verificación visual pendientes.


## 17. CONTINUIDAD 2026-10-18 — LAB v269 · ARRASTRE SOLO DE ÓRDENES NO PROCESADAS
- Se corrigió `sgp_mecanizado_pendientes_turno`: una orden con estado actual `PROCESADO` ya no puede aparecer en “Pendientes del turno anterior”.
- El arrastre se evalúa por producción/orden, no por el estado agregado de la reserva. Si una reserva tiene órdenes procesadas y otras en CORTE/MECANIZADO/PROGRAMADA, solo se arrastran las no procesadas.
- Se conserva la regla de habilitación 5 minutos después del inicio del turno.
- Se agregó `semana` a la respuesta del RPC desde `sgp_producciones.semana_actual/semana_base`.
- Producción muestra ahora `SEM xx` junto a la reserva dentro del bloque de arrastre.
- No se modificaron Picking, programación original ni estados históricos.
- Estado: RPC aplicado en Supabase; frontend implementado en GitHub como LAB v269; publicación Firebase y verificación visual pendientes.
