# PDT unificado — controles de publicación y aceptación

Estado: implementación propuesta en PR de controles; **sin autorización de
publish**. PR #146 está fusionado. El workflow solo permite `preflight` y
`publish` desde `main`; este PR ejecuta pruebas estáticas. La variable de entorno
`PDT_PUBLISH_ENABLED` debe permanecer ausente o distinta de `true` hasta la
aprobación separada de la ventana y de la evidencia reciente.

| ID | Control implementado | Evidencia necesaria en la ventana |
| --- | --- | --- |
| W01–W03 | Rama main, ancestro y siete SQL fijados a f830dd4; inputs y secreto obligatorios | Run preflight en main vigente |
| W04 | Token GCS reducido a lectura; identidad de archivo/generación/hash, manifiesto y recuperación privados enlazados; snapshot, hash, cantidades, catálogo, sin red; antigüedad ≤6 h | Nuevo respaldo/restore verificado y sus campos exactos; run exitoso correspondiente |
| W05 | build:vendor, verify:release, npm test y huella de frontend antes de SQL | Resultado verde del run de publicación |
| W06 | Captura de catálogo productivo en transacción READ ONLY comparada con la captura verificada: RPC, definiciones, RLS, permisos, columnas, índices, políticas, roles y dependencias | Ninguna diferencia; si hay drift, generar otra recuperación compatible y revisar |
| W07 | Siete fases secuenciales con ON_ERROR_STOP; resumen por fase; siguiente fase/corte no corre si falla una | Siete PASS del mismo run |
| W08 | `clock_timestamp()` evaluado por PostgreSQL en el INSERT de activación; retorno UTC efectivo | Registrar el valor devuelto y coordinar operaciones |
| W09 | Commit main, huella del frontend probado y URL del deploy Firebase live | URL/revisión reales y huella sin cambios tras deploy |
| W10 | Smoke de backend READ ONLY tras deploy | Login de roles reales y ciclo PDT supervisado; no usar datos QA falsos en producción |
| W11 | Aviso de contención ante fallo, sin rollback automático después de corte | Decidir recuperación según si corte está activo y si hubo nuevas escrituras |
| W12 | Concurrencia global sin cancelación, entorno productivo y variable bloqueante | Confirmar reviewers y restricciones de rama del entorno antes de poner la variable en true |
| W13 | No se promueve a VERIFICADO por un run verde | Recorrido PC y móvil, Recepción/Picking/Mecanizado/Producción, históricos/NC/Export con acta |

El repositorio no versiona `package-lock.json`; el workflow mantiene
`npm install --no-package-lock` y prueba el artefacto emitido antes de escribir.
Crear y verificar un lockfile sería una mejora separada, no un motivo para omitir
las pruebas previas ni para publicar con un artefacto distinto del probado.

## Secuencia de autorización y ejecución

1. Fusionar este PR solo tras revisión. Mantener
   `PDT_PUBLISH_ENABLED` desactivada. Ejecutar `preflight` en main, entorno
   `supabase-backup`, con el `SUPABASE_DB_PASSWORD` ya validado. No escribe.
2. Obtener un **nuevo** respaldo privado y restauración aislada PostgreSQL17.11.
   Confirmar que su recovery-verified.json corresponde al mismo objeto,
   generación, SHA256, snapshot, cantidades y catálogo. El run anterior
   40872064831 sirve como antecedente, no como respaldo vigente.
3. Configurar en el entorno protegido `pdt-unified-production` el secreto
   `SGP_PDT_DATABASE_URL` para el pooler productivo PostgreSQL con TLS y permisos
   de instalación; configurar también
   `FIREBASE_SERVICE_ACCOUNT_SGP_ONE_LAB`. No reutilizar el URL en logs.
   Confirmar required reviewers y acceso exclusivo desde main.
4. Aprobar una ventana coordinada con operaciones. Proporcionar al workflow el
   run URL, objeto `gs://`, SHA256 y generación/tamaño/SHA256 del
   recovery-verified.json **del mismo respaldo**. Habilitar
   `PDT_PUBLISH_ENABLED=true` en ese entorno solo durante la ventana; aprobar
   explícitamente su job. El guard de catálogo debe pasar antes de la primera
   escritura. Si el respaldo tiene más de seis horas, detenerse.
5. Revisar los siete `PDT_PHASE_PASS`, el UTC efectivo del INSERT de corte,
   commit, huella del frontend y URL/revisión Firebase. Ejecutar aceptación de
   login/roles y alta→validación→avance→Picking→cierre con operadores autorizados,
   más PC/móvil, históricos y NC. Registrar evidencia; hasta entonces el estado
   es PUBLICADO/PENDIENTE DE VERIFICAR, nunca VERIFICADO automáticamente.
6. Volver a desactivar `PDT_PUBLISH_ENABLED` al cerrar la ventana.

## Fallos y recuperación coordinada

- Antes del corte: detener nuevas operaciones, leer fases que pasaron y el
  estado de `sgp_pdt_manual.corte_operativo`. Si está vacío y no hubo escrituras
  con los nuevos contratos, revisar y aplicar los SQL REVIEW de rollback en orden
  06→05→04→03→02→01 y luego la reversión #139 solo si sus guards lo permiten.
  Una fase fallida no autoriza a saltarse los guards.
- Después del corte: conservar backend y todas las escrituras posteriores.
  **No** restaurar la base completa ni ejecutar rollback automático que revele
  históricos. Si Firebase falló, contener operaciones y publicar el frontend
  compatible desde el mismo commit/artefacto tras revisión. Si el backend falló,
  reparar hacia delante con SQL revisado sobre el estado actual; conciliar primero
  PDT/entregas nuevos. Documentar cada decisión y volver a probar el recorrido.
- Ante un fallo del smoke o de PC/móvil, mantener el estado BLOQUEADO PARA
  ACEPTACIÓN, abrir incidente controlado y preservar el registro de corte y la
  evidencia del run. No confundir ese estado con una restauración aprobada.
