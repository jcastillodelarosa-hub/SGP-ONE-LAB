# Corrección de indicadores de mecanizado — LAB v360 propuesta

Estado: **IMPLEMENTADO EN RAMA**, probado localmente; no PUBLICADO ni VERIFICADO en
producción. Especificación: texto adjunto del propietario, 26/10/2026.
Base: main `275e5dc127609869d5174ab41cb9baadd24d3b0c`, PR104 fusionado.
Rama independiente: `fix/mecanizado-base-received-progress`. Un único PR Draft.

## Causa del error y nuevo denominador

PR104 usaba exclusivamente asignaciones de `sgp_mecanizado_programacion`, filtradas
y conciliadas como si fueran el universo programado. Una producción base aún sin
asignación quedaba fuera, junto a sistemas sin presencia en la carga visible.

Ahora el denominador proviene de `producciones` de la RPC existente
`sgp_consultar_programacion_semana(p_token,p_anio,p_semana)`, utilizada previamente
por la aplicación para identificar semanas de producción. Se exige key_produccion,
id_linea, anio, semana_actual/semana_base, sistema y cantidad. Se valida línea
PANELES_2/año/semana y se deduplica por identidad real. **No se sustituye por la suma
de asignaciones**, ni se modifica sgp_producciones. Si el contrato de respuesta no
acredita estos campos, el resumen falla con aviso en lugar de calcular un cero.

El año base es explícito en la sección, independiente de las fechas calendario de
la carga operativa. El filtro existente de semanas/sistema permanece. Un traslado
no cambia la pertenencia de una producción a su base anual/semanal.

## Fuentes y reglas de conciliación

| Indicador | Fuente y tratamiento |
|---|---|
| Programadas | Producciones de la consulta base por año/semana; cantidad por key_produccion, línea y sistema. Incluye órdenes no asignadas. |
| Recibidas | RPC `sgp_recepcion_listar(p_token,p_semana:null)`: estado RECIBIDA, fecha verificable y completa=true. Se acredita cada cantidad base una vez, no la cantidad agregada de la reserva repetida por producción. No se usa ok_export ni la existencia de una asignación como prueba de recepción. |
| Compartidas | RPC `sgp_reservas_asociadas_listar(p_token,p_semana:null,p_linea:PANELES_2)`. Principal y material compartido requerido; no referencias asociadas irrelevantes. Todas las recepciones completas acreditan una producción una sola vez. Estado mixto sin asignación cuantitativa de ventanas queda pendiente. MULTI-RESERVA de texto mantiene primera reserva como principal. |
| Procesadas | `sgp_mecanizado_ejecucion` (estado/cantidad_procesada) y `sgp_mecanizado_ejecucion_orden` (estado), por UUID de asignación y producción. Se contrastan cantidades y claves con cobertura canónica y relaciones del maestro, nunca solo nombre. PROCESADO con contador legacy0 acredita la asignación; contador positivo contradictorio no se ignora. |
| Reprogramaciones | RPC segura existente de reprogramaciones, sin SELECT directo de tabla privada. Orígenes/destinos, reserva/sistema y año de origen verificados; solo asignación activa. Parciales admiten encabezado original o ya reducido si las sumas concilian, sin doble resta ni doble avance. |
| Detalle de asignación | `sgp_mecanizado_cobertura_ordenes` y vista `sgp_produccion_reservas_v`. Una parte sin cantidades por producción verificables queda pendiente, no se reparte proporcionalmente. |

No existe evidencia en el contrato consultado de una cantidad de ventanas recibidas
por producción para una reserva incompleta: sus faltantes son piezas/perfiles.
**No se convierten perfiles a ventanas.** En ese caso recibidas es desconocido («—»),
con explicación. Recepción parcial por sistema sí se calcula al recibir algunas
producciones completas y otras pendientes. No se inventa una cantidad para completar
el boceto ni se presupone que toda reserva auditada incompleta equivale al total.

Si procesadas supera recibidas se conservan las cantidades observadas, se advierte
y se suspende la representación anidada de esa fila. Si un agregado no puede
atribuirse de forma inequívoca a producciones, procesadas queda «—»; se conserva la
cantidad acreditada parcial como referencia separada, no como total definitivo.
Las producciones base nunca se eliminan para hacer cuadrar la desigualdad.
No hay min()/recortes silenciosos de recepción o ejecución para forzar consistencia.

## Barra aprobada y métricas

Una barra por sistema: contenedor gris100%, azul de recibidas/programadas y verde
anidado dentro del azul. El verde ocupa procesadas/recibidas del contenedor azul,
equivalente a procesadas/programadas respecto al gris. No son segmentos acumulados.
Cantidades y porcentajes quedan fuera de los rellenos para ser legibles aun pequeños.
Solo se dibujan colores con datos conciliados: programadas≥recibidas≥procesadas.

Unidades / Porcentaje / Gráfico comparten exactamente los mismos datos. Todos
incluyen sistema, base, recibidas, procesadas, pendientes, % recibido y % procesado.
Indicadores superiores y totales usan sumas, no promedios de porcentajes. Pendientes
= base − procesadas; desconocido no equivale a cero. Cero base → porcentaje «—».
No se agrega barra redundante de totales. Responsive PC/móvil, con scroll local de
las pestañas de PR107 y sin overflow de página.

## Contraste obligatorio — 2026, semana44, Paneles2

**Origen de la referencia: revisión de Supabase comunicada por el propietario. No
es una nueva consulta autenticada ejecutada por Codex.**

| Sistema | Referencia Supabase suministrada |
|---|---:|
| ES-EL400 | 707 |
| ES-MX4000 | 158 |
| ES-SGD2020 | 227 |
| NC-300 | 14 |
| Total | 1106 |

Se reproduce esta referencia en pruebas sin asignaciones de mecanizado, incluyendo
NC-300. Consolidado externo1107 frente a referencia1106: diferencia1 en ES-SGD2020
(228 externo frente a227 base). No se añade esa unidad. Un aviso de revisión fechado
y separado de los cálculos permanece visible para ese alcance. No es una comparación
automática con un Export nuevo ni un procedimiento para aprobar incorporaciones.

Anterior636 frente a referencia1106: diferencia aritmética470. La causa estructural
es el denominador reducido a asignaciones; **no se afirma sin lectura de detalle que
las470 unidades sean todas exclusivamente no asignadas**, pues también había filtros
/exclusiones y los cortes de datos pueden diferir. Los577 procesados anteriores y
los694 recibidos del boceto no se adoptan como cifras validadas.

Las capturas usan referencia base1106 y **recepción/ejecución sintéticas650/440** para
comprobar geometría/interacciones; no son cifras productivas. Llevan marca visible
de prueba local. No se mezclan fixtures con las lecturas reales de la aplicación.

## Lectura real disponible y bloqueo de aceptación productiva

`evidence/source-access.json`: la consulta directa con la clave publishable existente
a sgp_producciones devuelve200 con0filas para ese alcance. Eso **no acredita base
vacía**, dado el contraste del propietario y RLS. No se amplía permiso ni se usa
service_role. La aplicación utiliza la RPC existente con sesión SGP; una respuesta
base vacía contradictoria con las relaciones productivas conocidas produce error.

No hay conector Supabase/credencial de sesión SGP de planta en esta ejecución.
**Pendiente antes de integrar/publicar:** contrastar definición y payload reales de
sgp_consultar_programacion_semana y recepción para confirmar que la primera devuelve
la base actual requerida de sgp_producciones con los campos anteriores y reproduce
1106. Sus firmas y la envoltura producciones se reutilizan del código vigente; no
se ha demostrado aquí el cuerpo SQL instalado ni los totales actuales de R/P.

Para esa revisión se prepara exclusivamente
`docs/sql-proposals/mecanizado/BASE_PROGRESS_READONLY_PREFLIGHT.sql`: transacción READ
ONLY, definición de cuatro funciones necesarias y agregado por sistema de la base,
termina ROLLBACK. **No ejecutado por Codex. No es migración ni debe instalarse.** No
consulta usuarios, sesiones ni tokens. No pide repetir funciones PDT ya verificadas.
Si el payload no cumple el contrato, no publicar con un fallback a asignaciones;
adaptar a la fuente real autorizada o resolver ese contrato separadamente.

## Pruebas y evidencia

- `npm test`: **312/312** aprobadas;25 nuevas de base no asignada, recepción completa
  /parcial/desconocida, ejecución completa/parcial, compartidas, MULTI-RESERVA,
  año/semana/línea/sistema, duplicados, traslados completos/parciales, encabezado
  reducido, contradicciones, no recortes y referencia1106 con NC-300.
- `python tests/mecanizado-base-progress/browser.py`: PC1366×1000 y móvil390×844.
  Estructura real de index.html, resumen, puente y agregador; RPC/REST sintéticas y
  todo tráfico externo bloqueado. Prueba geometría de capas, tres modos, totales,
  año/multisemana/sistema, lectura fallida sin resultados antiguos, reintento,
  respuestas tardías, sesión cambiada y casos contradictorio/incompleto.
  Siete solicitudes iniciales del nuevo puente (tres REST + cuatro RPC, una de base);
  otra semana agrega solo su consulta base; filtros locales no refetchean todo.
- `tests/issue103/browser.py` mantiene CLI y redirige al contrato actual, sin borrar
  los artefactos históricos del desarrollo anterior. Los tests del agregado antiguo
  se mantienen como compatibilidad; se marca deprecated para no reutilizarlo como base.
- Regresión PDTv2 PC/móvil y navegación LEGACY/V2/contraste aprobadas; calendario
  **26/10/2026T1=8+57=65** aprobado. Evidencia original de Issue99 preservada.
- `verify:release` LABv360, sintaxis JS/Python/YAML y diff --check aprobados.
- Hashes `evidence/preservation.json`: guardado de programación, Recepción,
  Ensamble/Picking, PDT y CSS global de PR107 sin cambios funcionales.
- Capturas: `units-{1366,390}.png`, `chart-{1366,390}.png`,
  `partial-{1366,390}.png`, `inconsistent-{1366,390}.png`, `shell-{1366,390}.png`.
  Resultados en `evidence/browser.json`; CI y SHA final se registran en el PR.

Cache30s aislada por sesión y revisión, base además por año/semana. Lecturas agrupadas
/paginadas existentes, hasta tres semanas en paralelo. Se rechaza una respuesta global
posiblemente truncada (1000filas) en vez de tratar un prefijo como total. No N+1.
Las lecturas no son una transacción serializable: cambios concurrentes requieren
refresco y pueden generar advertencias, nunca ajustes de datos desde el resumen.

## Límites

Sin migraciones, DML, grants/RLS, cambios productivos, fusión ni despliegue.
No se implementa conciliación Export/carga semanal; la futura aprobación de
incorporaciones seguirá reservada a Coordinador/Administrador. Tampoco se modifica
Ensamble, Empaque, Picking ni otros repositorios. LABv360 es una propuesta de rama.
Siguiente paso único: revisión ChatGPT del PR Draft, incluyendo el contrato de lectura
pendiente; no integrar ni publicar hasta contar con aceptación de datos reales.
