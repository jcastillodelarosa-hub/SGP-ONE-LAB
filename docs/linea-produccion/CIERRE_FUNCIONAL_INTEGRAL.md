# Cierre funcional integral — alcance preparado y límites

2026-11-03, America/Bogota. Base GitHub verificada934340c, mismo Draft183.
No se reconstruye el módulo. Los cambios posteriores a0b14083 de Hosting se
conservan íntegros. Sin consulta nueva a Supabase ni datos/identidades reales.

## Matriz vigente

| Área | Implementación reutilizada y evidencia | Estado y límite |
|---|---|---|
| Consulta, avance acumulado, notas, afectaciones, validación y auditoría | SQL01/08, módulos Seguimiento/Operación; [flujo cuatro ámbitos](../../tests/lp01-ambitos-import/README.md) | IMPLEMENTADO/VERIFICADO PG sintético. Último80→90 deja90;288=90+90+90+18. No aplicado |
| Permisos, período, nocturno, revocación y concurrencia | SQL08/08R; [9 grupos SQL](../../tests/lp01-ambitos-temporales/README.md), importador3C apply=false | VERIFICADO AISLADAMENTE. Asignaciones reales aprobadas pendientes; duty no amplía rol |
| Apertura manual, SALE/capacidad, arrastre y contención | [motor conservado](SALE_CONTINUIDAD_CONTENCION.md), SQL01/08 | VERIFICADO AISLADAMENTE. P1 completa no cierra P2–P4; raíz/antigüedad/afectaciones preservadas. Sin reparto inferido |
| XLSX, cierre normal, SIN ACTIVIDAD y reapertura | SQL06/08, adaptador y handler compartidos; [integración existente](../../tests/lp01-cierres-integrados/README.md) | IMPLEMENTADO/VERIFICADO PG y handler. Originales reales probados previamente solo contra catálogo sintético; no correspondencia productiva |
| UI con ámbitos temporales y cierres por etapa | [nuevo recorrido PC/móvil](../../tests/lp01-cierres-integrados/browser.py), [resultado](../../tests/lp01-cierres-integrados/evidence/browser-sql08.json) | Prueba nueva completa la brecha entre navegador anterior a08 y backend temporal. No simula resultados RPC ni guardados; transporte/auth bootstrap local sintético |
| PDT/Mecanizado | SQL07, inspector de origen; [campos faltantes](../../tests/lp01-origen/README.md) | Asociación privada sintética verificada. BLOQUEADO EN FUENTE: raíz/etapa acreditada, versiones inmutables y unión neta antes/después. Cero crédito mientras falten; no inferir ventanas de piezas |
| Export | Planificador y lector servidor existentes; [contrato](../../tests/lp01-export-reader/README.md) | BLOQUEADO EN FUENTE: official_inclusion_hash, LP_event_ids_and_revisions, per_root_complete_inclusion_scope. PENDIENTE_EVIDENCIA/apply=false; sin doble descuento ni reset |
| Vidrio contextual | Enlace/OVES/ubicaciones y04/05 opcional; [contratos capturados](../../tests/lp01-operacion/evidence/postgres.json) | Implementado delimitadamente. Traslado no se inventa donde la fuente lo agrupa con Otros. B17 sin aprobación; ubicaciones no equivalen a NC |
| Dashboard y reportes | Indicadores locales del turno y CSV/XLSX/versiones de cada etapa existentes | Implementado delimitadamente. Consolidado multietapa, histórico semanal/sistema y PDF/imagen no completos; requieren fuente/contrato contrastado. No sumar Ensamble+Empaque como ventanas únicas |
| Publicación/recuperación | [workflow y artefacto sellado](../../tests/lp01-publish/PUBLICACION_CONTROLADA.md) | PREPARADO, NO PUBLICADO. Inspect41707119884 GET exitoso observado; resumen/retención pendiente de revisión, política no certificada. No ejecutar publish/recover |
| Apertura automática | [principal A](principal-a/DISENO.md) | BLOQUEADA por perímetro PUBLIC; no worker/roles/grants/credenciales. No reabrir diagnóstico |

## Qué cierra esta entrega

La prueba nueva reutiliza ClosureDB, las dos fixtures XLSX anonimizadas y el
handler HTTP existentes. Instala los SQL01/06/08 exactos en PostgreSQL17.11 nuevo
sin red, con fuentes, sesiones y ámbitos sintéticos. Recorre ambas etapas en
1440/390: consulta, corrección acumulada, revocación posterior al render con
rechazo SQL y auditoría intacta, archivo de otra etapa denegado, diferencia sin
motivo denegada, importación/cierre real, original idéntico, reapertura coordinador,
segunda versión sin destruir la primera, etapa opuesta abierta, sin cambios de
Export o asignaciones. Los resultados HTTP provienen de PostgreSQL, no de stubs.

Límite visual existente: el detalle de reporte muestra el snapshot JSON completo;
en móvil genera un documento extenso. Se clasifica como mejora de presentación,
no como un reporte consolidado terminado. Las capturas y el chequeo de ancho
no certifican ergonomía en planta.

Se reutilizan SIN ACTIVIDAD, continuidad, locks, revisiones, reintentos y
concurrencia previos; no se repite su batería. [SQL08 y fuentes](../../tests/lp01-cierres-integrados/evidence/browser-sql08.json)
registra límites exactos. No hay cambios al adaptador, SQL01–08/08R ni lógica de
aplicación; no se encontró una incompatibilidad que justifique reimplementarlos.
Las capturas muestran datos QA; no contienen responsables ni archivos de planta.
[Huellas de conservación](../../tests/lp01-cierres-integrados/evidence/verification-integral.json):
SQL01–08/08R, módulos, parser/handler y lectores idénticos a934340c. CI base934340c
observada: sintaxis, tests, diseño PostgreSQL, LP y validate PASS; no se atribuye
a este cambio. CI nueva pendiente tras push. Solo se ejecutó la prueba focalizada
nueva; una segunda pasada corrigió el encuadre de capturas, sin batería general.

## Bloqueos y siguiente acción exacta

No se puede declarar el módulo integral terminado ni habilitado: faltan evidencia
de origen PDT/Export, asignaciones reales, runtime autorizado y fuentes históricas.
Los componentes independientes descritos arriba ya están implementados o probados;
repetirlos no aporta evidencia para esos campos ausentes.

Siguiente acción: recibir por canal privado la matriz/catálogo/períodos aprobados y
su pin; ejecutar el importador3C con apply=false y revisar su diff. En paralelo,
los mantenedores de origen deben aportar un expediente PDT con identidad/versiones/
unión neta y la inclusión exacta de eventos/revisiones en un corte Export. No pedir
otra vez los XLSX, las reglas de acumulados o las aprobaciones B10–B16.

Decisiones/casos estrictamente pendientes: convención de medianoche/festivos no
observados, distribución entre raíces solo con evidencia inequívoca y autorización
del runtime/orígenes del servicio XLSX. Para completar histórico/consolidado, acreditar
su fuente/unidad/alcance y permisos; no elegir KPIs ni inferir movimientos históricos.
Tabla/Kanban, B17 y B27 no se implementan en este cierre de operaciones críticas.

## Aplicación y reversión posteriores

[Plan actualizado](INSTALACION_Y_RECUPERACION.md): punto de recuperación existente
acreditado antes de instalar; orden01→06→08 con verificaciones y escrituras
contenidas,07 aditivo sin emisor,04 opcional. Pre-COMMIT: rollback atómico; tras uso:
contener con02 y corregir hacia adelante, preservando archivos/cierres/auditoría.
08R no debe eliminar vigencias activas para eludir revocaciones. No crear respaldo,
restaurar datos ni retirar controles como parte de esta entrega.

Requieren autorización separada: instalación SQL, eventual ajuste de ACL/roles,
ámbitos reales, configuración/runtime/secretos, pruebas con escritura productiva,
activación de puentes/escrituras/jobs, merge, inspección autenticada de Hosting y
publicación/recuperación. No se ejecuta ninguna de esas operaciones aquí.
