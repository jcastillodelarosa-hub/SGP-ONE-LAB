# SGP_ONE — ESTADO ACTUAL Y CONTINUIDAD

> Documento maestro de continuidad técnica y funcional.
> Actualizado: **2026-10-19**
> Este documento debe revisarse antes de modificar SGP_ONE.

---

## 1. ESTADO EJECUTIVO

**Proyecto:** SGP_ONE  
**Objetivo:** gestión de producción para fabricación de ventanería de aluminio y vidrio.  
**Repositorio operativo:** `jcastillodelarosa-hub/SGP-ONE-LAB`  
**Rama:** `main`  
**Frontend visible:** **LAB v281**  
**Último hotfix backend:** **v282 — permiso RPC de arrastre**  
**Backend de datos:** Supabase directo.  
**Hosting operativo:** Firebase Hosting.  
**Último commit documental verificado:** `17b5fd6add2b8c0797c4181f987cb5a45837bbcb`.

### Estado de publicación al cierre
- JavaScript syntax check: **SUCCESS**.
- SGP ONE Tests: **SUCCESS**.
- Firebase Hosting: **SUCCESS**.
- GitHub Pages build/deployment: **SUCCESS**.
- Hotfix v282: **APLICADO Y PROBADO EN SUPABASE**.
- Validación final del hotfix desde navegador del usuario: **PENDIENTE**.
- Validación visual completa de Pendientes de aluminio v281 por roles: **PENDIENTE**.

### Regla de arquitectura vigente
SGP_ONE-LAB **no usa Gateway**. El LAB continúa con **Firebase Hosting + SDK Supabase local + Supabase directo**.

El Gateway se desarrolla y valida en el proyecto separado **SGP_ONE_GOOGLE**. No introducir Gateway, SQL Connect, Data Connect ni una migración de Supabase dentro del LAB hasta que exista una decisión explícita y una integración controlada.

---

## 2. ARQUITECTURA ACTUAL

### Frontend
- `index.html`
- `styles.css`
- `app.js`
- código auxiliar bajo `src/`
- SDK Supabase del navegador servido localmente como `./vendor/supabase.js`

### Backend
- Supabase proyecto SGP-ONE-LAB.
- Persistencia PostgreSQL.
- RPC operativas con patrón histórico `SECURITY DEFINER`.
- El navegador se conecta mediante el rol PostgreSQL `anon`.
- La autorización funcional se realiza dentro de las RPC mediante `p_token` y validación de rol SGP.

### Despliegue
- GitHub `main` → workflows de validación → Firebase Hosting.
- `scripts/verify-release.mjs` protege el paquete de publicación y evita reintroducir dependencias no aprobadas.
- Firebase Hosting es el entorno operativo del LAB.

### Seguridad conocida
Existen advertencias estructurales previas relacionadas con RLS deshabilitado en tablas públicas y el modelo histórico `SECURITY DEFINER + token propio`.

**No habilitar RLS globalmente como parte de una corrección funcional aislada.** Debe tratarse como un proyecto de endurecimiento separado porque un cambio transversal puede bloquear módulos operativos.

---

## 3. REGLAS TRANSVERSALES QUE NO DEBEN ROMPERSE

1. La identidad de una producción depende del contexto de línea; no asumir que un mismo ID en PANELES_2 y FRAMES_2 representa dos ventanas distintas.
2. La semana operativa debe provenir de la producción/programación, priorizando `semana_actual` y usando `semana_base` como respaldo cuando corresponda.
3. Estados productivos principales: `CORTE → MECANIZADO → PROCESADO → PICKING`.
4. `PROCESADO` significa mecanizado terminado.
5. `PICKING` significa material entregado a línea.
6. Picking de piezas utiliza exclusivamente piezas `PANEL`.
7. No inferir cantidades por reserva cuando no existe una fuente inequívoca.
8. No inventar acabados. Si no existe fuente inequívoca debe mostrarse **ACABADO POR CONFIRMAR**.
9. Los cambios de estado, auditorías, entregas parciales y PDT deben conservar trazabilidad.
10. No reutilizar el campo `auditado` de Picking para la validación de Pendientes de aluminio.
11. Una NC finalizada **no equivale** a PDT validado.
12. La autorización para mecanizar un PDT depende de la validación explícita del pendiente.

---

## 4. RESERVAS MÚLTIPLES Y RESERVA COMPARTIDA

Regla vigente desde v277/v278:

### MULTI-RESERVA
Una producción tiene más de una reserva asociada.

Esto **no significa automáticamente** que sea una RESERVA COMPARTIDA.

### RESERVA COMPARTIDA
Existe cuando al menos una reserva asociada no principal también actúa como reserva principal de otra producción/grupo, por prioridad asignada o por relación principal conocida.

### Consecuencias
- Todas las relaciones conocidas reserva ↔ acabado deben mantenerse disponibles internamente.
- MULTI-RESERVA controla la desambiguación de material.
- RESERVA COMPARTIDA controla la alerta/identificación visual.
- Picking debe poder manejar piezas PANEL de distintos acabados en órdenes multi-reserva.
- No modificar esta semántica al trabajar en Programación, Producción, Picking o Pendientes.

Estado v278: **IMPLEMENTADO, PUBLICADO, PROBADO Y VERIFICADO VISUALMENTE**.

---

## 5. PROGRAMACIÓN

### Funcionalidad vigente
- Programación semanal y diaria.
- Partes/prioridades como 1.1, 1.2, 1.3, etc.
- Calendario por fecha y turno.
- Totales por turno y día.
- Resumen por sistema/acabado.
- Proyecto / Retail.
- Reprogramación por reserva/orden.
- Búsqueda y detalle de órdenes.
- Semana asociada a producción/programación.

### Capacidades aprobadas
- PANELES_2: 180/día, 90/turno.
- FRAMES_2: 80/día, 40/turno.

### Horarios
- Lunes–sábado:
  - Turno 1: 07:00–19:00
  - Turno 2: 19:00–07:00
- Domingo:
  - Turno 1: 07:00–18:00
  - Turno 2: 18:00–05:00

### Estado
Operativa. No existe un cambio pendiente autorizado en este documento que justifique alterar su lógica base.

---

## 6. PRODUCCIÓN / MECANIZADO

### Operación
Los líderes pueden consultar reservas programadas, expandir órdenes, registrar observaciones/novedades y cambiar estado por orden.

Estados operativos:
- PROGRAMADA
- CORTE
- MECANIZADO
- PROCESADO
- REPROGRAMADO cuando corresponda al flujo

### Arrastre de pendientes
Desde v267:
- El turno entrante puede ver pendientes del turno anterior 5 minutos después de iniciar.
- T1: desde 07:05.
- T2: desde 19:05.
- Se reutiliza el `id_programacion` original.
- No se crea una programación duplicada.
- El turno original conserva trazabilidad de **NO CULMINADO** cuando corresponda.

### Hotfix v282 — 2026-10-19
Error observado:
`permission denied for function sgp_mecanizado_guardar_estado_arrastre`.

Causa:
una migración live del 2026-10-14 había revocado `EXECUTE` a `anon`, aunque el frontend llama esta RPC desde el navegador usando precisamente ese rol técnico.

Corrección:
- `PUBLIC` permanece revocado.
- `EXECUTE` concedido a `anon, authenticated, service_role`.
- No se cambió el cuerpo de la función.
- Continúa validando internamente los roles:
  `ADMINISTRADOR, COORDINADOR, LIDER MECANIZADO, LIDER, LIDER LINEA`.

Pruebas realizadas:
- `anon` + sesión ADMINISTRADOR sobre programación real: **14 órdenes recorridas correctamente**, dentro de transacción con ROLLBACK.
- `anon` + sesión CONSULTA: **PERMISO_DENEGADO**, comportamiento correcto.
- Migración versionada: `supabase/migrations/20261019_fix_mecanizado_arrastre_anon.sql`.

Estado:
- Supabase: **CORREGIDO Y PROBADO**.
- Navegador usuario: **PENDIENTE DE REPRUEBA**.

---

## 7. PICKING

### Reglas vigentes
- Solo piezas `PANEL`.
- Ordenamiento prioriza material más avanzado.
- Entrega completa o con faltantes.
- Auditoría independiente de la entrega.
- Si auditoría difiere: estado de auditoría con diferencia.
- Entregas parciales conservan trazabilidad.
- Partidas abiertas muestran reservas/partes pendientes.
- Las órdenes con mismo nombre pero diferente sistema no deben mezclar piezas.
- Semana visible en tarjetas y partidas abiertas.

### Auditoría
El campo `auditado` pertenece a este flujo y **no debe utilizarse como validación de PDT**.

### Estado
Operativo. Las modificaciones v279–v281 de Pendientes no deben alterar el reporte original de Picking.

---

## 8. PENDIENTES DE ALUMINIO — FLUJO V279–V281

Este es uno de los módulos con cambios recientes más importantes.

### Conceptos independientes

#### Estado NC
- Sin NC
- NC enlazada
- NC finalizada

#### Validación PDT
- ⚠ POR VALIDAR
- ✓ VALIDADO

#### Estado físico PDT
- PENDIENTE
- REPO_OK
- CORTE
- MECANIZADO
- PROCESADO
- PICKING

**Una NC finalizada no valida automáticamente el PDT y no debe convertirlo automáticamente en REPO_OK.**

### Reserva solución
- Si existe NC y la NC tiene `reserva_solucion`, esa es la reserva solución efectiva.
- Si el PDT no tiene NC, Coordinación puede registrar una reserva solución manual.
- La reserva manual no sustituye silenciosamente la reserva solución proveniente de una NC.

### Patinador
Antes de VALIDADO puede modificar:
- NC.
- Fabricación.
- Longitud.
- Acabado **cuando sea RESERVA COMPARTIDA**.

Después de VALIDADO estas correcciones quedan bloqueadas para el Patinador.

### Validadores
Pueden validar:
- ADMINISTRADOR.
- COORDINADOR.
- LIDER LINEA.
- SUPERVISOR DE PICKING.

Durante la validación se confirman/corrigen:
- fabricación,
- longitud,
- acabado,
- observación de validación.

La validación es la autorización para que Mecanizado pueda procesar el pendiente.

### Líder Mecanizado
No valida el PDT por definición funcional actual. Puede operar el estado físico una vez cumplida la validación requerida.

### Fuente de piezas
Las ventanas Modificar/Validar reutilizan las piezas PANEL reales de la orden, siguiendo el patrón de Picking → Reportar faltantes.

Si existe fuente de piezas para la referencia, el backend rechaza combinaciones de fabricación/longitud que no pertenecen a la orden.

### Historial
Se conserva trazabilidad de:
- creación,
- edición PDT,
- reserva solución,
- validación,
- cambios de estado físico.

### Tabla v281
Orden aprobado/restaurado:

`SEM. | OP | Reserva | Referencia | Acabado | Marca | Fabricación | Longitud | Cant. | NC | Enlace NC | Estado NC | Validación | Observación | Estado PDT | Acciones`

Acciones:
- Modificar.
- Validar.
- Ver detalle.
- Historial.
- Actualización de estado según permisos/flujo.

El menú Acciones se renderiza en un portal sobre `document.body` para evitar recortes por el scroll de la tabla.

### Estado
- Supabase v279/v280: **IMPLEMENTADO**.
- Frontend v281: **IMPLEMENTADO Y PUBLICADO**.
- Pruebas automáticas: **SUPERADAS**.
- Verificación visual completa por cada rol: **PENDIENTE**.

---

## 9. NC DE ALUMINIO

La tabla/fuente de NC continúa siendo la autoridad para:
- identificación/consecutivo de NC,
- estado de NC,
- reserva asociada,
- referencia,
- `reserva_solucion`.

Pendientes consume esa información, pero no debe rediseñar ni sobrescribir la lógica propia del módulo NC.

Caso utilizado en pruebas:
- NC `1004390`
- estado: Finalizada
- reserva: `8673439`
- referencia: `ES-SGD2020-084A`
- reserva solución: `8712867`

Estado: integración con Pendientes **VERIFICADA EN BACKEND**.

---

## 10. ENSAMBLE

La consulta de Ensamble muestra pendientes de mecanizado asociados a producción.

Después de v279:
- un PDT POR VALIDAR debe diferenciarse de un PDT listo;
- solo la combinación **VALIDADO + estado físico compatible** debe considerarse lista para mecanizado.

No rediseñar Ensamble como consecuencia de cambios en Pendientes sin revisar primero `sgp_consultar_ensamble`.

---

## 11. PORTADA / SALDOS DE PRODUCCIÓN

### Implementación actual
La portada llama la RPC:
`sgp_resumen_saldos_portada()`.

La RPC agrupa por:
`coalesce(semana_actual, semana_base)`

y suma directamente desde `sgp_producciones`:
- `saldo_ensamble`
- `saldo_empaque`

### Diagnóstico realizado 2026-10-19
Para SEM 43, la portada mostraba:
- Ensamble: **1.020**
- Empaque: **31**

Origen comprobado:

| Línea | Registros | Cantidad | Ensamblado | Saldo Ensamble | Saldo Empaque |
|---|---:|---:|---:|---:|---:|
| PANELES_2 | 90 | 883 | 174 | 709 | 22 |
| FRAMES_2 | 85 | 338 | 27 | 311 | 9 |
| Total actual portada | 175 | 1.221 | 201 | 1.020 | 31 |

### Problema identificado
La portada suma los saldos de PANELES_2 y FRAMES_2 como si fueran independientes.

En SEM 43:
- 175 registros de línea.
- 91 IDs de producción distintos.
- 84 producciones aparecen en ambas líneas.

Por tanto, **1.020 no debe interpretarse como un saldo consolidado de ventanas**; es la suma de los saldos operativos de ambas líneas.

Además, el valor depende del último Export diario cargado, por lo que no necesariamente representa el estado de planta en tiempo real.

### Decisión de diseño en curso
El usuario solicitó bocetos para mostrar **los saldos de ambas líneas por separado**, distinguiendo:
- semanas vencidas;
- semana actual.

Los bocetos fueron solicitados/aprobados conceptualmente, pero **NO existe todavía una implementación autorizada/publicada de la nueva portada**.

Antes de modificar la RPC o la portada se debe definir si los indicadores representarán:
1. saldos operativos separados PANELES_2 / FRAMES_2; o
2. ventanas consolidadas sin doble contabilización.

Estado: **DIAGNÓSTICO COMPLETADO / REDISEÑO PENDIENTE**.

---

## 12. RECEPCIÓN / AUDITORÍA DE RESERVAS

Reglas vigentes:
- fecha y turno de recepción;
- fotografías;
- reserva completa sí/no;
- registro estructurado de faltantes;
- pendientes hacia Bodega;
- reversión cuando aplique;
- semáforo por antigüedad;
- estados de reserva diferenciados visualmente.

Estados funcionales utilizados:
- Pendiente por Abastecimiento.
- Pendiente por Bodega.
- Recibida sin legalizar.
- Aluminio entregado / Entregada.

---

## 13. INFORMES

### NC aluminio
Reporte por fechas con:
- totales,
- seguimiento,
- número de cortes,
- peso proveedor/planta,
- referencias afectadas,
- salida PDF/imagen.

### Reporte de turno de Mecanizado
Desde v264:
- Programado.
- Ejecutado.
- Pendiente.
- % avance.
- avance por sistema.
- programación vs ejecución.
- pendientes siguiente turno.
- novedades.
- comentario general.
- salida PNG/PDF.

---

## 14. ROLES

Roles existentes:
- ADMINISTRADOR
- COORDINADOR
- LIDER MECANIZADO
- LIDER LINEA
- LIDER
- RECEPCION
- PATINADOR
- PICKING
- SUPERVISOR DE PICKING
- CONSULTA

La autorización tiene dos niveles:
1. acceso a módulo/ventana;
2. permiso de acción validado en backend.

No asumir que mostrar/ocultar un botón constituye seguridad suficiente. Las operaciones sensibles deben validarse también en RPC.

---

## 15. UI / UX VIGENTE

- Paleta principal azul.
- Evitar morado como color principal de controles.
- Texto blanco sobre botones azules cuando corresponda.
- Ventanas flotantes con cierre visible.
- Scroll funcional en móvil.
- Menú lateral móvil.
- Portada como vista inicial.
- Versión visible.
- Tablas extensas deben conservar legibilidad y evitar superposición.
- En Pendientes, columna Acciones sticky a la derecha.

---

## 16. MIGRACIONES RECIENTES CRÍTICAS

Versionadas en GitHub:
- `20261017_preservar_ubicacion_vidrio_ove_ausente.sql`
- `20261018_pdt_validation_workflow.sql`
- `20261018_pdt_compact_actions.sql`
- `20261019_fix_mecanizado_arrastre_anon.sql`

Importante: existen migraciones históricas aplicadas directamente en Supabase que no estuvieron inicialmente reflejadas en el repositorio. Para desarrollos nuevos, toda modificación DDL/RPC debe:
1. aplicarse de forma controlada en Supabase;
2. quedar versionada también en `supabase/migrations`.

---

## 17. VERSIONES RECIENTES

| Versión | Alcance principal | Estado |
|---|---|---|
| v264 | Reporte de turno Mecanizado | Implementado |
| v265–266 | Estabilización Supabase directo / SDK local / release guard | Implementado |
| v267 | Arrastre pendientes turno anterior | Implementado |
| v268 | Semana y filtros móviles Picking | Implementado |
| v269–274 | Correcciones semana/prioridad/arrastre | Implementado |
| v275 | Pendientes de aluminio | Implementado |
| v276 | Primer soporte reserva compartida; semántica luego corregida | Superado por v277 |
| v277 | MULTI-RESERVA vs RESERVA COMPARTIDA | Implementado |
| v278 | Corrección visual reserva compartida | Verificado |
| v279 | Validación formal PDT | Implementado |
| v280 | Acciones compactas / piezas reales / historial PDT | Implementado |
| v281 | Restauración columnas PDT + menú Acciones | Publicado; validación visual completa pendiente |
| v282 | Hotfix permiso RPC estado de arrastre | Backend aplicado/probado; prueba usuario pendiente |

**Nota:** v282 es un hotfix de backend. La versión visible del frontend continúa siendo **LAB v281** porque no fue necesario cambiar código funcional del navegador.

---

## 18. ERRORES RECIENTES Y LECCIONES

### Login / carga del SDK
Se estabilizó usando Supabase directo y SDK local. No reintroducir detección de Gateway ni dependencias CDN en el LAB.

### Reserva compartida
No confundir una orden con varias reservas con una RESERVA COMPARTIDA.

### Pendientes v280
Una modificación visual sustituyó columnas existentes. v281 restauró la tabla histórica y agregó Acciones sin eliminar información.

**Lección:** los cambios de UX deben ser aditivos salvo aprobación explícita de sustitución.

### Producción v282
Una RPC utilizada desde navegador perdió permiso `anon`.

**Lección:** al crear/reemplazar RPC invocadas desde el frontend, verificar conjuntamente:
- firma;
- `SECURITY DEFINER`;
- `search_path`;
- permisos `anon/authenticated`;
- validación interna del token/rol;
- prueba positiva y prueba negativa de autorización.

---

## 19. PENDIENTES ACTUALES PRIORIZADOS

### P1 — Verificación operativa
1. Reprobar desde navegador el cambio de estado de una reserva de arrastre después del hotfix v282.
2. Completar prueba visual/funcional de Pendientes v281:
   - Semana.
   - orden de columnas.
   - Acciones.
   - Modificar.
   - Validar.
   - Historial.
   - permisos por rol.

### P2 — Portada
3. Definir e implementar la nueva presentación de saldos separando PANELES_2 y FRAMES_2.
4. Mostrar claramente semanas vencidas y semana actual.
5. No presentar la suma PANELES + FRAMES como si fuera automáticamente un saldo consolidado de ventanas.
6. Definir visualmente la antigüedad/fuente del último Export si el indicador depende de una carga diaria.

### P3 — Seguridad técnica
7. Diseñar un plan independiente para RLS/permisos sin modificar el sistema operativo de forma transversal.
8. Auditar las RPC utilizadas por navegador para detectar inconsistencias similares de `GRANT EXECUTE`.

### P4 — Validación por roles
9. Completar pruebas de Patinador, Coordinador, Líder Línea, Supervisor Picking y Líder Mecanizado en el flujo PDT.

---

## 20. PRÓXIMOS PASOS RECOMENDADOS

1. Confirmar en navegador que v282 resolvió el cambio de estado en Producción.
2. Cerrar verificación visual de Pendientes v281.
3. Retomar el rediseño de saldos de portada con PANELES_2 y FRAMES_2 separados.
4. Antes de implementar la portada, aprobar un boceto definitivo y la definición exacta de cada indicador.
5. Ejecutar regresión de Programación, Producción, Picking y Pendientes después de cualquier cambio transversal.

---

## 21. PROTOCOLO OBLIGATORIO PARA PRÓXIMAS SESIONES

### Antes de modificar
1. Leer este documento.
2. Consultar el código actual de `main`.
3. Consultar Supabase cuando la funcionalidad dependa de tablas/RPC.
4. Identificar dependencias entre módulos.
5. Confirmar la regla de negocio vigente.
6. No asumir que algo está implementado por aparecer en conversaciones históricas.

### Durante el desarrollo
1. Aplicar el cambio mínimo necesario.
2. Preservar funciones operativas.
3. Mantener permisos backend además de controles visuales.
4. Versionar las migraciones.
5. Ejecutar pruebas positivas, negativas y de regresión.

### Al finalizar
Registrar claramente:
- qué se propuso;
- qué se implementó;
- qué se aplicó en Supabase;
- qué se publicó;
- qué pruebas pasaron;
- qué falta verificar por el usuario;
- errores conocidos;
- siguiente paso.

Nunca declarar **VERIFICADO** únicamente porque el pipeline terminó correctamente cuando la funcionalidad requiere una prueba visual u operativa del usuario.

---

## 22. RESUMEN DE CONTINUIDAD AL 2026-10-19

SGP_ONE continúa estable sobre **Firebase Hosting + Supabase directo**. El frente visible está en **LAB v281**. El flujo de Pendientes de aluminio ya incorpora validación formal, acciones compactas, piezas reales de la orden, NC/reserva solución e historial, pero falta cerrar la validación visual completa por roles.

El error de Producción `permission denied for function sgp_mecanizado_guardar_estado_arrastre` fue diagnosticado y corregido en Supabase mediante el hotfix backend v282, con pruebas positivas y negativas exitosas. Falta únicamente confirmar la operación desde el navegador real.

La portada mantiene todavía el cálculo histórico que suma `saldo_ensamble` y `saldo_empaque` de PANELES_2 y FRAMES_2. Se comprobó que esto puede duplicar conceptualmente producciones presentes en ambas líneas. El rediseño para mostrar saldos separados de semanas vencidas y semana actual está **pendiente de definición final e implementación**.

**Siguiente punto de continuidad recomendado:** cerrar prueba v282 y luego definir/implementar la nueva portada de saldos por línea.


---

## 30. CONTINUIDAD 2026-10-19 — v283 · CANTIDAD CANÓNICA DE PROGRAMACIÓN

### Objetivo
Evitar que Programación considere `sgp_mecanizado_programacion.cantidad_programada` como verdad vigente cuando la composición/cantidad real de una parte cambió posteriormente.

### Regla aprobada
- Fuente canónica vigente: `sgp_producciones.key_produccion + sgp_producciones.cantidad`.
- `cantidad_programada` se conserva como snapshot histórico y continúa siendo válida para reportes/calendario histórico.
- Una programación nueva debe persistir las `key_produccion` exactas que cubre.
- Los históricos ambiguos no se reconstruyen por inferencia.

### Implementación Supabase
Aplicadas:
- `lab_v283_cantidad_canonica_programacion`.
- `lab_v283_programacion_composicion_consumidores`.

Versionado en:
- `supabase/migrations/20261019_programacion_cantidad_canonica_v283.sql`.

Se agregó:
- `sgp_mecanizado_programacion_detalle`: composición persistida por `id_programacion + key_produccion`.
- `sgp_mecanizado_cobertura_programacion(token, semana)`: devuelve cantidad canónica, cubierta, pendiente y estado de cobertura.
- `sgp_mecanizado_programar`: valida contra saldo canónico y persiste composición exacta.
- `sgp_mecanizado_ordenes_programacion`: usa composición persistida cuando existe; conserva fallback legacy.
- `sgp_mecanizado_pendientes_turno`: arrastre usa composición persistida cuando existe; conserva fallback legacy.

Seguridad:
- tabla detalle con RLS habilitado;
- sin acceso directo para `public/anon/authenticated`;
- RPCs invocadas por navegador conservan `SECURITY DEFINER`, validación interna SGP y EXECUTE para `anon/authenticated/service_role`.

### Reconciliación histórica
Backfill automático únicamente cuando la composición actual era inequívoca y la suma canónica coincidía exactamente con el snapshot histórico.

Casos auditados SEM 43:
- 8689722 / 1.1: canónica 58, histórica 55 → `LEGACY_REVISAR`.
- 8689722 / 1.2: 54 = 54 → `PROGRAMADA`, detalle persistido.
- 8689722 / 1.3: 55 = 55 → `PROGRAMADA`, detalle persistido.
- 8689919 / 13: 35 vs 29 → `LEGACY_REVISAR`.
- 8690338 / 2.1: 55 vs 46 → `LEGACY_REVISAR`.
- 8690338 / 2.2: 65 = 65 → `PROGRAMADA`, detalle persistido.
- 8690348 / 3.1: 37 = 37 → `PROGRAMADA`, detalle persistido.
- 8690348 / 3.2: 38, sin programación → `SIN_PROGRAMAR`.
- 8690348 / 3.3: 39, sin programación → `SIN_PROGRAMAR`.

### Frontend
`app.js` carga `sgp_mecanizado_cobertura_programacion` junto con disponibles/programación y usa `cantidad_cubierta` para:
- saldo por reserva;
- saldo por parte/prioridad semanal;
- clasificación programada/parcial/pendiente.

La versión visible se actualizó a **LAB v283**.

### Pruebas
Se agregó `tests/programming-canonical-coverage.test.mjs` para impedir regresión al cálculo basado únicamente en `cantidad_programada`.

Estado al documentar:
- ANALIZADO: **COMPLETADO**.
- IMPLEMENTADO: **COMPLETADO**.
- APLICADO EN SUPABASE: **COMPLETADO**.
- VERSIONADO EN GITHUB main: **COMPLETADO**.
- PRUEBAS AUTOMÁTICAS: **SUPERADAS** en GitHub Actions tras corregir un test histórico acoplado literalmente a v281.
- PUBLICADO EN FIREBASE: **SÍ**. Workflow `Deploy SGP ONE to Firebase Hosting` run `39293869162`, pasos de release, tests y deploy completados con éxito.
- VERIFICACIÓN VISUAL/OPERATIVA: **PENDIENTE**.

### Riesgo residual
Los registros `LEGACY_REVISAR` mantienen compatibilidad histórica y no reciben composición inventada. Deben revisarse caso por caso si se desea reconstruir exactamente qué nuevas producciones pertenecen a una programación histórica.


---

## 31. CONTINUIDAD 2026-10-19 — v284 · COBERTURA DE PROGRAMACIÓN POR ORDEN

### Problema confirmado
v283 corrigió la cantidad canónica, pero un histórico con snapshot distinto a la composición actual podía mostrar una diferencia numérica como “sin programar” sin saber qué órdenes estaban realmente pendientes.

Ejemplo auditado:
- 8689722 / 1.1: snapshot 55, cantidad actual 58; las 14 órdenes actuales tienen evidencia de ejecución ligada al mismo id_programacion y están PROCESADAS. La diferencia de 3 no representa una orden nueva.
- 8689919 / 13 y 8690338 / 2.1: existe diferencia histórica pero no evidencia suficiente para inferir automáticamente cuáles órdenes quedaron fuera.

### Regla v284
La cobertura se determina por `key_produccion`, no por resta de cantidades.
- PROGRAMADA: key_produccion cubierta por una programación activa.
- PENDIENTE: key_produccion no cubierta cuando la composición ya es conocida.
- REVISAR HISTÓRICO: existe programación legacy pero no hay evidencia suficiente para reconstruir su composición.
- Nunca elegir órdenes por subset de cantidades ni por coincidencia numérica.

### Backend
Aplicado en Supabase:
- `lab_v284_cobertura_ordenes_base`
- `lab_v284_reconciliar_programacion_legacy`
- `lab_v284_backfill_evidencia_ejecucion`
- `lab_v284_revoke_public_cobertura`

RPC:
- `sgp_mecanizado_cobertura_ordenes(token, semana)`
- `sgp_mecanizado_reconciliar_programacion_legacy(token, id_programacion, keys[])`

La reconciliación manual está limitada a ADMINISTRADOR/COORDINADOR. Los RPC conservan SECURITY DEFINER, validación SGP y EXECUTE para anon/authenticated/service_role; PUBLIC quedó revocado.

Backfill seguro confirmado:
- 8689722 / 1.1 → 14 key_produccion, cantidad canónica actual 58, origen RECONSTRUIDA_EJECUCION.
- 8689722 / 1.2 y 1.3 permanecen CANONICA.
- 8690338 / 2.2 permanece CANONICA.
- 8690348 / 3.1 permanece CANONICA.
- 8689919 / 13 y 8690338 / 2.1 permanecen sin composición inventada y requieren reconciliación.

### Frontend
LAB v284:
- carga cobertura por orden;
- muestra PROGRAMADA / PENDIENTE por orden dentro de cada parte;
- bloquea programación de un histórico ambiguo hasta reconciliarlo;
- muestra “REVISAR HISTÓRICO” y permite al Coordinador seleccionar explícitamente las órdenes que ya pertenecían a la programación anterior;
- después de reconciliar, las no seleccionadas quedan pendientes y pueden programarse con el flujo normal.

### Pruebas y publicación
- JavaScript syntax check: SUPERADO.
- SGP ONE Tests: SUPERADO.
- Deploy Firebase workflow run 39298089120: SUPERADO.
- Verificación backend de privilegios: SUPERADA.
- Verificación visual/operativa en navegador: PENDIENTE.

### Estado
ANALIZADO: COMPLETADO.
IMPLEMENTADO: COMPLETADO.
APLICADO EN SUPABASE: COMPLETADO.
VERSIONADO EN GITHUB main: COMPLETADO.
PROBADO AUTOMÁTICAMENTE: COMPLETADO.
PUBLICADO EN FIREBASE: COMPLETADO.
VERIFICADO EN NAVEGADOR: PENDIENTE.

---

## Actualización 2026-10-20 — LAB v306: eficiencia y relaciones de vidrio

**Alcance:** SGP_ONE / Ensamble / Reporte de ubicaciones / Explorador de relaciones.
**Fuente operativa:** GitHub `main`, PR #11 de la rama `feat/lab-v306-glass-week-filter`; actualización preparada para `main`.
**Condición inicial:** historial del documento refleja LAB v281; para el estado presente debe consultarse el código `main` y la versión visible del frontend. 

### Implementación de v306

- Filtro por año/semana de producción, indexado exclusivamente por `key_produccion`, `semana_actual` (alternativamente `semana_base`) y `anio`. Usa las RPC autorizadas `sgp_picking_semanas` y `sgp_consultar_programacion_semana`.
- No altera los indicadores generales ni tablas de Ubicaciones: el filtro se aplica a la sección Eficiencia y a la red de relaciones.
- En la red: reserva, parte y orden muestran **ventanas**, deduplicadas por `key_produccion`; burro muestra **vidrios** según estado seleccionado.
- Seleccionar reserva, parte, orden o burro resalta las conexiones de su cadena completa. La exploración desde parte/orden sigue tanto hacia la reserva como hacia los burros, sin confundir un burro compartido con pertenencia de otras órdenes a la misma parte.
- Doble clic (o dos pulsaciones seguidas) sobre un burro abre detalle de reservas, partes, órdenes y estado de los vidrios; botón accesible desde panel lateral para móvil.
- La nueva pantalla usa datos de la RPC vigente `sgp_reporte_dispersion_vidrio` sin escrituras a Supabase.
- Pruebas: `tests/glass-week-filter-v306.test.mjs` y `tests/glass-relations-v306.test.mjs` con agrupación, semanas y relaciones compartidas.

### Estado de entrega

Código **IMPLEMENTADO** en el PR #11; pruebas automáticas de rama deben verificarse en GitHub Actions; **PUBLICADO y VERIFICADO funcionalmente en Firebase pendientes de evidencia**.
No se modificaron tablas, RPC, políticas RLS ni permisos. No afecta SGP_ONE_GOOGLE.
