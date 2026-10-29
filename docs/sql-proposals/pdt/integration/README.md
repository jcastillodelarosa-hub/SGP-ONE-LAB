# PDT unificado — instalación y reversión REVIEW

Estado: **implementado en rama y probado con fixtures PostgreSQL 17; no aplicado ni publicado**. Integra los contratos de PR #139 y #141 sin modificar sus ramas, datos históricos ni `main`.

## Contratos

El despacho manual de validación y cierre se ejecuta solo para `id_pendiente` presentes en `sgp_pdt_manual.detalles`; el resto delega al despacho de #139 para agrupados, V4 y LEGACY. Los guards de 02 y 03 fijan los cuerpos de #139 contrastados en aislamiento. Se conservan autorizaciones, avances, Picking, cierre e idempotencia. El listado actual combina PDT manuales y los nuevos de todas las fuentes; la fecha de creación manual procede de `sgp_pdt_manual.reportes.fecha`.

El año de `sgp_producciones` es inmutable. SQL REVIEW 05 rechaza un año de Export diferente al de una producción existente y añade protección para cualquier `UPDATE anio`. Permite cambiar `semana_actual` dentro del mismo año. El reporte original de un PDT manual conserva su período. Ambos cuerpos productivos de Export y sus huellas se documentan en [EXPORT_BODY_CONTRAST.md](EXPORT_BODY_CONTRAST.md).

El corte operativo es un instante UTC único, no deducido de la semana: `06_operational_cutover_REVIEW.sql` crea una configuración privada y una RPC de lectura con sesión/rol. El frontend filtra los listados operativos por `fecha_reporte >= desde`, tanto PDT manuales como los nuevos de otras fuentes. Una fecha ausente no pasa el filtro. Los históricos siguen físicamente en Supabase para auditoría. Si la RPC de corte falla, el listado falla cerrado.

## Secuencia propuesta

1. En una restauración productiva compatible, cotejar huellas, permisos, columnas y contratos. Probar el ciclo creación → validación → avances → Picking → cierre, con LEGACY históricos aún presentes y roles reales.
2. En una ventana de publicación aprobada, instalar #139 `01_grouped_sources_REVIEW.sql`, seguido de manual `01`, `02`, `03`, `04`, `05`, y `06_operational_cutover_REVIEW.sql`. Detenerse ante cualquier preflight fallido.
3. Registrar el instante efectivo de publicación y el administrador en `06_ACTIVAR_REVIEW.sql`, reemplazando sus dos marcadores; ejecutar solo con autorización productiva y control de operaciones. Publicar el frontend coordinadamente.
4. Verificar desde PC y móvil que solo figuren PDT desde el corte, que el alta manual aparezca, y que los PDT históricos sigan disponibles por vía de auditoría. Confirmar Export de semana dentro del mismo año y rechazo de año distinto. No migrar ni archivar PDT anteriores.

## Reversión

Antes de activar el corte, `06_ROLLBACK_REVIEW.sql` lo elimina. Después de activarlo, ese rollback aborta para evitar que reaparezcan históricos; requiere reparación hacia delante o reversión de frontend coordinada. `05_ROLLBACK_REVIEW.sql` restaura el escritor Export y retira el guard de año; seguir con 04→03→02→01 solo si sus guards permiten retirar datos nuevos. #139 solo puede restaurar PK/índice antiguos si no existen detalles agrupados nuevos. Si hubo escrituras, conservar contratos y conciliar transacciones posteriores; no sobrescribirlas con un backup completo.

## Evidencias y pendientes

PostgreSQL 17 sintético: siete regresiones SQL de manuales, agrupados, V4, LEGACY y programación; pruebas focalizadas de rechazo 2026→2027, semana ordinaria, repetición, rechazo JSON, excepción SQL, año ausente, protección ante `UPDATE anio` y rollback. La RPC de corte se instaló en QA; una activación de prueba leyó el instante configurado y revirtió la transacción. Node: listado único, corte y fallo cerrado. **Pendiente antes de solicitar publicación:** restauración productiva compatible, prueba funcional con roles reales y fecha efectiva acordada con planta. No se ha aplicado SQL ni desplegado.

## Publicación directa — decisión operativa 2026-10-29

Por solicitud expresa del responsable funcional se preparó el workflow independiente `.github/workflows/pdt-unified-direct-release.yml` (PR #151). No solicita seis campos de respaldo, no crea respaldo y no comprueba recuperación aislada ni vigencia de seis horas. Este procedimiento reemplaza, para esta publicación, el intento manual con `pdt-unified-production-release.yml`; no elimina el workflow histórico.

La ejecución directa requiere `main`, aprobación del entorno protegido `pdt-unified-production`, variable de entorno `PDT_PUBLISH_ENABLED=true`, secreto `SUPABASE_DB_PASSWORD` válido en ese mismo entorno, validación de candidato SQL fijado y preflight de lectura. Después instala las siete fases SQL, activa el corte operativo, despliega Firebase Hosting `sgp-one-lab` y verifica backend. No cambia RLS ni utiliza `service_role`.

**Bloqueo observado:** run 40939589210 falló en `PDT_PREFLIGHT_AUTHENTICATION_FAILED` al autenticar PostgreSQL desde `pdt-unified-production`. El nuevo workflow no corrige ese secreto: comprobarlo sin mostrar, copiar ni sustituir credenciales sin autorización. No reintentar una publicación sabiendo que la autenticación falla.

**Riesgo aceptado expresamente:** sin respaldo ni recuperación verificada, una interrupción entre fases SQL puede dejar cambios parcialmente aplicados; la activación y el despliegue pueden requerir reparación coordinada. No ejecutar automáticamente un rollback sobre datos nuevos. El responsable pidió priorizar implementación sin respaldo adicional. El merge del workflow no ejecuta SQL ni despliega por sí solo.

**Estados a registrar por separado:** workflow implementado en rama, fusionado en `main`, publicación ejecutada, verificación real de Supabase y Firebase. No declarar `PUBLICADO` por CI estática o por merge.

## Registro de ejecución directa — 2026-10-29

Con autorización expresa del propietario se aplicaron mediante la conexión Supabase existente, sin usar el secreto de PostgreSQL de GitHub Actions, las siete fases SQL versionadas en main: agrupados 01, manuales 01–05 e integración 06. Cada llamada de migración devolvió `success: true`. Proyecto `ocvxbwzqxbrfndkvjmfx`.

La activación se ejecutó posteriormente con reloj de la propia base de datos: `desde=2026-10-29 19:42:11.72216+00`, `activado_por=Jcastillo`. Se verificó previamente que el contrato de corte estaba instalado y aún sin activar. No se generó nuevo respaldo. Esta es una ejecución autorizada excepcional, no un permiso permanente para omitir controles.

**Estado al registrar:** SQL APLICADO, corte APLICADO. El frontend requiere despliegue Firebase y verificación independiente; no declarar PUBLICADO/VERIFICADO hasta comprobar el resultado del workflow de Hosting y la experiencia funcional.
