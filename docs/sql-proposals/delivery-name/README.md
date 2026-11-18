# Nombre de quien entregó — candidata LAB v473

Estado: IMPLEMENTADO EN RAMA, NO APLICADO EN SUPABASE, NO PUBLICADO.
Base: main 9df26561. Reconstrucción acotada porque el commit previo cef19d81 no estuvo disponible en los ejecutores ni GitHub.

Recepción de Picking muestra `Entregado por <nombre>` desde `nombre_entrego`.
Si no hay nombre devuelve `Nombre no disponible`; no utiliza ni muestra el login como sustituto.
La identidad `usuario_entrega` permanece sin cambio en datos y contrato para trazabilidad.
SQL agrega solo `nombre_entrego` a `sgp_picking_recepcion_cola(text)`, consultando el índice único de usuario existente.
No modifica filas, permisos, validaciones, áreas de auditoría ni cantidades.

## Despliegue específico, sujeto a autorización
1. Validar respaldo privado y recuperación exigida para el cambio. La mera existencia del .backup no prueba restauración.
2. Revisar función viva contra hash/ACL/owner capturados en baseline.json (lectura 18 noviembre 2026).
3. Aplicar install.sql una vez. Las guardas bloquean otra línea base y modificaciones concurrentes.
4. Verificar hash y ACL, nombre para una entrega conocida con sesión autorizada, rechazo sin sesión.
5. Preparar/revisar artefacto frontend LAB v473; comprobar versión vigente de main y subir número si cambió.
6. Publicar únicamente con autorización; comprobar Hosting y recepción PC/móvil con nombres y sin login.
7. Reversión: frontend previo primero; rollback.sql restaura definición exacta, con guardas. No se revierten datos porque no se alteran.

## Evidencias
- Pruebas unitarias/renderer con nombre, vacío, ausente, valor inválido, XSS y acciones de auditoría: PASS.
- SQL PGlite sintético: PASS, nombres, usuarios ausentes, validación sesión, cantidades parciales, contrato previo y reversión exacta.
- npm test: 1430 PASS / 10 omitidas / 0 fallidas.
- build:vendor, verify:release, git diff --check: PASS.
- No se probó navegador ni se ejecutó RPC productiva con sesión. No se publicó ni se escribió en producción.

Ejecutar SQL local: `PGLITE_MODULE=/ruta/a/pglite/dist/index.js node tests/delivery-name/sql.mjs`.
