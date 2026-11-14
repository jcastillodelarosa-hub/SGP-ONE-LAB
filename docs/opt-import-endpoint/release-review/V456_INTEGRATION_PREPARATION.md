# Integración local v456 — preparación, no publicación

Estado 2026-11-14: IMPLEMENTADO EN RAMA LOCAL `review/opt-v456-integration`. Sin push, PR, migración alojada, recuperación real ni importaciones. `git ls-remote origin refs/heads/main` confirmó ab10248937e78e20b6b38c3da07ba9fc4a598b14 en esta revisión; no equivale a comprobar Hosting. v456 es candidata provisional y debe cotejarse nuevamente con main/Hosting antes de publicar.

## Composición y conflictos
- Retail 2b3589058b5bf9d8a13f00e09ca79b0ea48831a0, sin modificar su rama.
- SQL a0e46915eaadbf0be4682f64cbad9298940a92a6, descendiente de Retail.
- UI 10a6394477469a9d69c65cd916829a3018469c9a, base ab102489 (preparación importada 498a302).
- Etiquetas ad8addc84fa5c58c4fe333ee0f26553ae5753365, base ab102489, rama intacta.

Merges locales 977cbe9 y 0de5353 conservan las cuatro historias. Conflictos de versión: solo 455 frente a456 en index.html (cachés y sello) y scripts/build-release-info.mjs; se conservó456. Se preservaron ambos bloques de continuidad sin borrar antecedentes. En CSS se conservaron íntegros los bloques distintos de Project data y metadata de selección. La lista de artefactos es la unión sin duplicados; incluye etiquetas, Project data y ruta Retail. No hubo conflicto de funciones de negocio, SQL Retail o registro.

Se regeneró exclusivamente en la integración la procedencia Retail sobre127 archivos: cc654bba2ba1e8eb1abfc418b7b965b5e2bb685180998f87b5f04c346c25e560. Es un hash del árbol integrado, NO identidad de v6 desplegada ni garantía de rendimiento. El conjunto es sobreinclusivo y ahora incluye módulos UI nuevos. Cualquier cambio posterior de sus entradas exige regeneración y revisión del bundle final.

## Verificaciones proporcionadas
15 pruebas de dominio (resumen, filtro/orden y etiquetas), DOM Project data y workflow PASS. Lector SQL y contención en PostgreSQL embebido PASS con fixtures sintéticos: retiro repetible, vuelta al lector aprobado, metadata privada e históricos intactos, permisos conservados. build:opt-vendor, build:vendor y verify:release PASS v456. Chromium PC1440×1000/móvil390×844 del resumen integrado PASS; captura inspeccionada, controles y scroll horizontal conservados. No se repitieron extracción original, CPU, concurrencia Retail ni suites independientes ya válidas. No se certifica sesión productiva ni rendimiento del bundle alojado.

## SQL Project data: orden y precondiciones
Estos archivos siguen siendo propuestas; no son una migración aplicada. Empaquetar mediante el mecanismo de migraciones del proyecto, tras aprobación explícita.

1. Leer `pg_get_functiondef` de `public.sgp_opt_resumen_documental_v1(text,jsonb,text,text)` y SHA256 UTF8; comparar con baseline4809da617dff4279be9729b6df88d4a7e9b5c6c103e03efdbaafc97145c61875 o guardia6073f58c1c2500c20ceff653b16a5dbc4e054e8e86a8a05203b4f1140504e27c. Guardar propietario, proacl, prosecdef, proconfig. No inferir equivalencia ante definición nueva: detener revisión. No expandir grants; confirmar que actor y scope siguen operativos.
2. Aplicar `docs/sql-proposals/opt-shared/project_data_store_REVIEW.sql` ANTES del lector. Almacén privado append-only, RLS forzada, sin acceso de aplicación. Recuperación SECURITY INVOKER solo por propietario autorizado; EXECUTE revocado de PUBLIC/anon/authenticated/service_role. Confirmar catálogo de ACL y RLS, sin escribir filas reales como prueba.
3. Aplicar `project_data_document_reader_REVIEW.sql`. Reemplaza la firma ya existente preservando ACL/configuración. Hash esperado a80734f680f5cffc6b5eef94b595fefc3aa19debc1ab6fb04debb52551ff38fb. Mantiene actor, scope y admisión documental; solo añade metadata verificada. Los campos inline antiguos se excluyen. No instalar el adaptador provisional descartado ni aplicar la guardia histórica después del lector.
4. Recuperación metadata-only por lote revisado: comprobar bytes PDF originales, hash de documento y manifiesto, identidad documental y hash del extractor. Revisar independientemente extracción completa; el hash del PDF solo acredita identidad, no exactitud de la tabla. Ejecutar por mantenimiento propietario autorizado, nunca navegador/service_role. Límite1–20 por transacción. Replay idéntico es idempotente; payload distinto rechaza todo el lote. No reimportar ni alterar evidencia histórica, piezas, asignaciones, cortes o avances. No incluir PDF, IDs ni datos reales en el repositorio público.
5. Verificar lecturas reales autorizadas y denegadas con sesiones aprobadas, metadata ausente, referencias completas y otros resúmenes antes de publicación. Esta aceptación alojada no se ejecutó aquí.

Consulta de catálogo propuesta, solo lectura, sin contenido de documentos:

```sql
SELECT encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') AS fingerprint,
 pg_get_userbyid(p.proowner) AS owner,p.proacl,p.prosecdef,p.proconfig
FROM pg_proc p
WHERE p.oid='public.sgp_opt_resumen_documental_v1(text,jsonb,text,text)'::regprocedure;
```

## Contención Project data preparada y probada
Aplicar, solo con autorización operativa, `project_data_containment_REVIEW.sql`. Acepta únicamente el lector aprobado anterior y es idempotente si ya está contenido. Retorna al hash6073f58c… omitiendo Project data tanto privado como inline, conserva resúmenes anteriores y controles. Pausar recuperación; NO borrar almacén ni restaurar ciegamente baseline con paso libre inline. Verificar ausencia del campo en respuesta real y ACL intacta. Reanudar solo tras decisión revisada aplicando de nuevo el lector aprobado; el lote privado sigue disponible sin reprocesar ni reimportar.

## Retail: gates separados, no activados por esta integración
Seguir `RETAIL_BOUNDED_RELEASE.md`, `SEPARATE_RETAIL_OPTION.md` y `READ_ONLY_PUBLICATION_GATES.md` como revisiones posteriores a notas históricas. Mantener v6 existente sin reemplazo. Confirmar timeout efectivo PostgREST alojado antes de habilitar v3: lock_timeout250ms y statement_timeout1s declarados no prueban por sí solos hoisting real. No hacer importación como sonda. La evidencia local no certifica hardware alojado.

Orden futuro Retail: SQL contexto/v3 revisado y ACL → endpoint separado verificado con JWT/allowlist/orígenes → comprobaciones autorizadas → configuración selectiva `optRetailMode=candidate` y UI integrada. Hoy el valor omitido continúa `legacy`: publicar UI sin activación no habilita v3. Revisión del artefacto final debe comprobar esa configuración explícitamente. Solo RETAIL+INDICE va al endpoint separado; Proyecto y rutas existentes mantienen v6.

Pausa futura: `optRetailMode=paused` y reemplazo autorizado SOLO del endpoint separado por artefacto retirement. UI sola no detiene clientes antiguos; dejar terminar/reconciliar invocaciones en curso. Retirada funcional no equivale a eliminación física. No cambiar automáticamente a legacy para documentos inciertos, no reintentar ni reenviar a v6. Conservar datos y controles. La aceptación de endpoint inerte y límites alojados sigue pendiente; no crear recursos para probarlo sin autorización.

## Entrega y siguiente acción
Library UI libfile_adcda119bc84819195d1fde09d71864f y SQL libfile_cf5eb197eabc81918d40a30d851f781e continúan en versión1 según lectura actual. Reintento del helper autorizado falló en tools/list por red ANTES de transferir; no hay resultado incierto ni una actualización confirmada. Los dos parches finalizados se conservan en /workspace; no sustituirlos por este paquete integrado sin aviso. El nuevo paquete de integración incluye únicamente código/propuestas/fixtures sintéticos.

Siguiente acción: entregar artefactos mediante Library cuando su ruta soportada vuelva a estar disponible y revisar la candidata integrada/gates con el dueño. Publicación requiere autorización expresa, configuración alojada verificable y comprobación del estado de las OPT inciertas exclusivamente en lectura; ninguna importación está autorizada por este documento.
