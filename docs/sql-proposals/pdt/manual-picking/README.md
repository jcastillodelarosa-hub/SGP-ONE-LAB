# Picking: alta manual de pendientes de aluminio

Solicitud Johan 2026-11-16: personal rol PICKING puede agregar pendientes de aluminio.

## Alcance mínimo
- + Nuevo PDT habilitado a PICKING, origen fijo PICKING.
- Servidor autoriza PICKING en catálogo, fuentes y consulta puntual NC.
- Registro permite PICKING únicamente cuando origen=PICKING.
- Sin permisos nuevos de validación, edición, entrega, asignación ni cierre.
- Líder de línea conserva ENSAMBLE/EMPAQUE; la UI deja de ofrecerle PICKING, que el servidor ya rechazaba.
- Resto del cuerpo de cuatro RPC conserva verificaciones, idempotencia, NC y trazabilidad sin cambios.
- Sin cambio de estilos, contenido de guía ni diseño. Bocetos se gestionan aparte.

## Aplicación pendiente, no ejecutada
Base main 9054025 / v464; candidata v465 reservada para este cambio. No aplicar automáticamente desde hosting.
1. Coordinar con cambios OPT y dueño de despliegue. Requerir CI verde.
2. Tomar respaldo fresco restaurable y verificar restauración antes de migrar; el snapshot de funciones en tests NO reemplaza un respaldo de datos.
3. Revalidar definiciones/ACL/advisors y roles actuales. install.sql falla ante drift.
4. Aplicar transacción a LAB exclusivamente y verificar 4 definiciones, ACL y SECURITY DEFINER/search_path sin cambios. No se migran datos.
5. Publicar UI con versión coordinada; comprobar entrada Picking y que no aparezcan nuevos permisos de validación/cierre.
6. Contención: rollback.sql restituye exactamente las funciones anteriores y conserva todos los reportes ya creados. Falla ante drift posterior; volver UI al despliegue previo.

## QA
- 10 pruebas unitarias dominio/manual/validación y alcance de roles: PASS local. Suite completa npm test y build/verify:release v465 PASS local.
- Cuerpos reales PL/pgSQL en PostgreSQL local PGlite: matriz permiso/denegación, tokens inválidos y token que finge ser rol, origen ENSAMBLE/EMPAQUE negado a Picking, guardas de drift y rollback exacto: PASS local.
- Identidad se simula mediante tabla token→rol explícita; no utiliza credenciales de producción.
- El test SQL comprueba autorización hasta guardas/datos faltantes; no reemplaza prueba integración real de inserción. Cuerpo de inserción no modificado.
- Smoke formulario real con RPC sintéticas PC/móvil incluye alta, NC opcional, máximo cantidad, origen fijo y otros roles. Ejecución local bloqueada por sockets Chromium; pendiente CI.
