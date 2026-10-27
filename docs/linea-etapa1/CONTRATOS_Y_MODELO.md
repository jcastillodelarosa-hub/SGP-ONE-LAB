# Etapa 1 — motor operativo Ensamble/Empaque

Base verificada: main `06b1794b6d83574742f152b2873821830b41cf15`, LAB v362,
PR116 fusionado. Los checkpoints heredados que aún dicen Draft son históricos.
No UI, integración runtime ni nueva versión. No se inicia Etapa2.

## Inventario y nivel de evidencia

| Contrato | Fuente / parámetros vistos | Estado |
|---|---|---|
| sgp_linea_plan_consultar | planner-operations-v326.js: p_token,p_desde,p_hasta,p_linea | llamada comprobada en main; cuerpo/ACL actuales pendientes |
| sgp_linea_plan_programar | mismo: p_token,p_key_produccion,p_fecha,p_turno,p_cantidad,p_prioridad | igual |
| sgp_linea_plan_mover | mismo: p_token,p_asignacion,p_fecha,p_turno,p_cantidad,p_prioridad | igual |
| sgp_linea_plan_registrar | mismo: p_token,p_asignacion,p_cantidad,p_observacion | igual; NO asumir que ya registra acumulados en vez de incrementos |
| sgp_linea_plan_arrastrar | existencia confirmada por propietario | firma, cuerpo y disparador no disponibles localmente |
| sgp_linea_plan_explorador_v327 | SQL versionado: (text,integer,text), consulta autenticada | cuerpo de repo disponible; instalación actual pendiente |
| sgp_consultar_ensamble | app.js: token,semana,linea; respuesta filas | reutilizable para contexto, no evidencia de ejecución Empaque |
| sgp_linea_plan_asignaciones/ejecuciones | existencia y ausencia de etapa confirmadas por propietario; nota 22/10 registra RLS | estructura/constraints/ACL actuales pendientes |
| sgp_producciones | importador/consultas: key, línea, saldos/ensamblado/empacado | fuente oficial Export, solo lectura para este motor |
| PDT v4 y LEGACY/V2 | PR116 fusionado; docs/sql-proposals/pdt/multiorigin | reutilizar sin modificar contratos; fusión no prueba aplicación SQL |

El propietario confirma SECURITY DEFINER de las RPC existentes. Eso NO prueba
validación de sesión, rol real, acceso por etapa, search_path seguro o ACL mínima.
No hay herramienta Supabase autenticada disponible en esta sesión. No se declara
verificado el backend instalado. PREFLIGHT_READONLY.sql contiene exclusivamente
catálogos requeridos para cerrar ese contraste, sin filas operativas ni secretos.
Las dependencias de pg_depend no abarcan todas las referencias PL/pgSQL/dinámicas.

Fuentes que se conservan: app.js, planner-operations-v326.js,
planner-readonly-v326.js, production-line-tabs.js, src/domain/glass-relations-graph.js,
glass-explorer-insights.js y Reporte de ubicaciones/generación/descarga existentes.
Ninguna se modifica. Sin acceso ni cambios a GOOGLE/LAC.

## Separación de etapas y compatibilidad

No añadir una etapa por defecto a tablas instaladas ni reclasificar sus filas.
No envolver ni reemplazar RPC actuales en esta etapa. Propuesta aditiva privada
sgp_linea_operativa_v1, sin puertos/servicios nuevos y sin escrituras del navegador.
En futuras RPC v2 se exigirá etapa explícita. Programación legacy continúa igual.
No se leerán automáticamente asignaciones antiguas como si fueran ENSAMBLE:
recuperar su semántica y acordar un adaptador individual, si realmente hace falta.
No programar dos veces una misma carga por convivir ambos motores: antes de
integrar, resolver propiedad de asignaciones existentes y corte de transición.

## Reglas aprobadas y entidades

Clave de orden-turno = (etapa,fecha operativa Colombia,turno,key_produccion).
Nunca nombre de producción ni reserva como identidad única; PANEL/FRAME separados.

- Sale: compromiso validado por Coordinador por esa clave. No saldo Export ni
  ejecución, ni recálculo desde Picking/vidrio. Cada cambio requiere motivo/auditoría.
- Ejecución: valor acumulado reemplazable, no incremento repetible. Historial
  conserva valor anterior/nuevo y delta derivado. Antes del cierre el Líder
  corrige (reducción exige motivo); después solo Coordinador con motivo.
- Turno: abierto/cerrado/en revisión. Líder cierra etapa independientemente,
  observación general obligatoria y justificación por cada orden bajo Sale.
  Sale pendiente impide cierre. Snapshot congelado y versionado por revisión.
- Corrección postcierre: snapshot previo no se reescribe; queda EN_REVISION y se
  registra autorización. Reapertura Coordinador + motivo, nuevo cierre Líder
  produce una nueva revisión y reporte. El informe previo permanece reproducible.
- Arrastre: propuesta del remanente max(Sale-ejecutado,0) al turno siguiente,
  incluso sin cierre. Un enlace por origen/destino; reintentar actualiza el
  mismo enlace. No se añade nuevamente como ejecución, ni crea Sale validado.
  Una corrección de origen actualiza la propuesta y exige revalidación del Sale
  destino; nunca modifica silenciosamente un compromiso ya validado.
- Fecha/turno explícitos: T2 pasa a fecha siguiente T1, incluyendo cambio de año.
  El calendario horario/festivos debe contrastarse; no inferir turno por hora UTC.

Entidades de propuesta SQL: turnos, ordenes_turno, eventos, cierres, arrastres,
cortes_export y conciliaciones. Sale/ejecutado visibles son proyecciones auditadas;
los eventos son la fuente de correcciones. Los cierres guardan snapshot completo,
revisión, actor, motivos, referencias a cortes/evidencias y versión de contrato.
El SQL de esta etapa es ESQUELETO: sin RPC/guards de inmutabilidad todavía y con
FK de producción pendiente de contrastar. NO es un motor persistente listo para
instalar. Los checks SQL no sustituyen contratos servidor.

## Contratos futuros de comandos (PROPUESTOS, no instalados)

Todo comando: UUID idempotente, etapa/fecha/turno/key, revisión esperada y payload.
Actor/scope se obtienen de sesión servidor, NUNCA del JSON enviado por navegador.
Respuesta: ok, revision, id_evento, duplicate, estado/proyección; errores con código,
sin escrituras parciales. No hay fallback a una escritura legacy al fallar.

| Operación | Autorización / garantías |
|---|---|
| Sale validar/cambiar | Coordinador/Administrador, motivo, turno abierto |
| Acumulado sustituir | Líder autorizado para etapa; revisión esperada; motivo si disminuye |
| Corregir postcierre | Coordinador/Administrador, motivo, nueva revisión sin borrar cierre |
| Cerrar | Líder con scope de etapa, snapshot completo, observación y razones por faltante |
| Reabrir | Coordinador/Administrador, motivo y vínculo al cierre anterior |
| Arrastrar | worker autorizado o rol operativo según contrato confirmado; destino siguiente y propuesta sin validar |
| Conciliar Export | Coordinador/Administrador, corte/evidencia explícitos |

Modelo puro utiliza un actor de prueba y evidencia confiable inyectada por el
caller. NO implementa autenticación ni autoriza confiar en esos campos desde HTTP.
No heredar la equivalencia RECEPCION->LIDER de validadores legacy.

Todas las futuras mutaciones deben bloquear primero turno(s), luego orden(es),
siempre en orden canónico; cierre y escritura de ejecución comparten ese lock.
Bloquear además agregado de producción para consumo Empaque en turnos distintos.
Idempotencia: UUID único y actor+solicitud normalizada asociados. Mismo UUID con
contenido distinto rechaza. Optimistic revision evita lost updates; bloqueo SQL
resuelve carreras reales. El modelo serial demuestra conflicto, NO concurrencia PG.
Pruebas futuras: dos sesiones, cierre vs ejecución, dos Empaques contra suministro,
arrastre vs corrección y nueva importación vs conciliación, sin deadlocks/pérdidas.

## Export y conciliación

Export es fuente oficial inmutable para este motor. Conservar corte/importación,
fecha efectiva y snapshot por key/etapa. NO actualizar saldo_ensamble/saldo_empaque
ni ensamblado/empacado desde ejecución SGP. No sumar ambos acumulados.

La conciliación necesita evidencia de qué movimientos locales incorpora cada
corte. Coincidencia de cantidades/fecha de importación no demuestra inclusión.
Si no puede reconstruirse, mostrar oficial y local separados, proyección NULL
SIN_CONCILIAR. Con mapeo completo:

saldo_proyectado = saldo_oficial - suma(deltas locales NO incluidos en ese corte).

Corrección negativa aumenta proyección; delta incluido no se descuenta dos veces.
Una proyección negativa es discrepancia, no se recorta a cero. Reconciliar una
corrección y su original por separado cuando pertenezcan a cortes distintos.
No identificar eventos solo por fecha de pared: se requiere marca de corte,
watermark o conciliación explícita auditada. Selección del corte y mapeo se guardan
versionados; cambiar importación no borra registros ni recalcula cierres pasados.
Pendiente externo: formato/identificador real de lotes Export y forma comprobable
de inclusión. No inventar el mapeo a partir del Export actual.

## Ensamble -> Empaque y PDT

Empaque admite parciales sobre unidades efectivamente ensambladas elegibles,
menos consumo ya registrado en TODOS los turnos de la producción. La evidencia
servidor debe conciliar oficial/local, bloqueos y versiones. No usar solo Sale,
porcentaje de vidrio, estado general Mecanizado o auditoría Picking como cantidad.
Sin evidencia cuantitativa o impacto de bloqueo verificable: rechazar incremento.

PDT cuenta PIEZAS; producción cuenta UNIDADES. No restar cantidad PDT de ventanas.
El resolvedor futuro debe determinar unidades elegibles sin doble descuento de
bloqueos superpuestos; hasta disponer de relación cuantitativa, disponibilidad
queda desconocida. El modelo exige evidencia neta y revisión de bloqueos.
Vincular por etapa+producción+PDT sin modificar estado del PDT. Resolver bloqueo
ENSAMBLE no resuelve EMPAQUE; eventos de reposición conservan contratos LEGACY/V2.
Corrección descendente de Ensamble que deje Empaque ya consumido sin soporte es
riesgo de integridad: futura RPC debe bloquearla/escalarla mediante conciliación;
el modelo puro exige prueba confiable del saldo elegible posterior antes de
aceptarla. El resolvedor servidor todavía no está implementado. No usar el módulo en runtime.

## Regresión / criterios por ejecución corta

1. Cerrar metadatos instalados: firmas/cuerpos, defaults, roles reales/ACL,
   triggers y tablas. Identificar arrastre existente y no crear un worker duplicado.
2. Probar dominio con fixtures: Sale por etapa, acumulados, auditoría, revisiones,
   cierre independiente, remanentes antes de cierre, madrugada y conciliación.
3. Revisar DDL propuesto aislado: RLS/no acceso, constraints, rollback de instalación,
   reversión vacía y rechazo con datos. No aplicarlo a Supabase.
4. Tras NUEVA autorización: implementar RPC con locks, autorizaciones y adaptadores;
   validar carreras reales y regresión de contratos anteriores. Esa es otra etapa.

Invariantes de regresión: los archivos de UI/reportes/grafo/Mecanizado/PDT/Export
no cambian; sin nueva importación runtime del módulo puro. Verificar comparación
Git por rutas, no solo tests verdes. Reportes de cierre futuros se generan desde
snapshot y no consultas actuales; no sustituir ni alterar descargas de vidrio.
No pruebas visuales nuevas: no hay cambios de interfaz en esta etapa.
