# OPT UI v459 — publicación autorizada

Base remota 2ad7054 (v457); UI 2f3ebf0. Rama release/opt-ui-v459 exclusiva OPT. PR270 sigue draft/no fusionado, no incluido. La candidata combinada 865b942 permanece aislada. Versión 459 evita colisión con candidata alertas 458.

## RPC aplicada en LAB

add_opt_import_observation_v1 aplicada en ocvxbwzqxbrfndkvjmfx el 2026-11-14 con autorización expresa de Johan transmitida por coordinación. SQL: docs/sql-proposals/opt-shared/import_observation_REVIEW.sql; SHA256 6d96574820140fe4d8f365781fa95e29f4b20b01b258b17b7b5145a362c5f826. Crea solo sgp_opt_import_observacion_v1(text,jsonb), lectura STABLE, SECURITY DEFINER postgres, search_path vacío. ACL postgres/anon/authenticated EXECUTE; service_role false y PUBLIC sin EXECUTE. Fingerprint MD5 definición alojada c58d44050064a364d20394e7cc2690a1.

Preflight inspeccionó actor, validate_scope, bound, in_scope, sesión/roles/accesos y PK sources(origen,source_key), sin deriva respecto del contrato revisado. Roles configurados: ADMINISTRADOR, COORDINADOR, LIDER MECANIZADO; ventana mecanizado. Sesión inválida rechazada PDT_SESION_NO_VALIDA después de instalación. No se extraen tokens ni se simula sesión productiva positiva.

La consulta exige identidad/hash PDF/origen/consecutivo exactos, asignación vinculada dentro del ámbito y evidencia exacta del índice y scope. Responde solo identidad aportada y estado. NOT_OBSERVED nunca habilita retry. No devuelve información de otras reservas. Sin sesión local del usuario no se concilia su diario; la confirmación positiva requiere acción manual y coincidencia exacta, conserva historial. Sin RPC las vistas funcionan y la comprobación conserva los pendientes ante error.

Conteos y fingerprints MD5 de filas JSON ordenadas antes/después idénticos:

| Tabla | Filas | Huella |
| --- | ---: | --- |
| documents | 9 | 3a9c58bae3cd362bb9e18136dd1da52f |
| sources | 9 | b38a1bd6c8567f18ae9c2e3fbbfd56d2 |
| approvals | 9 | 90ce27d4fb99d72902aa8d21ee8fcb9f |
| pieces | 3007 | 9e0a9a03bbbc3c316302fc5bbd28152f |
| assignments | 1754 | 9b4b40873d2eca6a3f7f2a998d460165 |
| cuts | 0 | d41d8cd98f00b204e9800998ecf8427e |
| events | 0 | d41d8cd98f00b204e9800998ecf8427e |
| document_summaries | 9 | ac135a8b33a23edb2860d1fab7b41110 |
| document_plans | 9 | bd7a6914d474679cdf797e4193687ff9 |
| project_data_metadata | 9 | b5a074f4b660ae51d3f4081a1ec96aed |

Lectura actual: 0 fuentes Retail, 0 consecutivos terminados 213/215; no importación/reintento. Frames sin asignación permanece Revisar vínculo, sin porcentaje inventado.

## Validación y contención

QA previa de UI 2f3ebf0 reutilizada: 9 Node, 10 suites DOM, SQL sintético y Chromium PC/móvil con tráfico solo localhost. Cambio posterior solo versión/documentación; verify:release v459 y diff pasan. CI/merge/Hosting deben quedar registrados en entrega, no se afirman por este documento previo al push.

Rollback frontend: restaurar artefacto anterior verificado v457 mediante flujo autorizado. Contención RPC: revocar EXECUTE anon/authenticated o retirar solo función después de revisar dependencias; nunca borrar pendientes, piezas, asignaciones, cortes o metadata. No cambios Edge v6/Retail ni medidas. La migración no añade permisos de tabla ni roles de aplicación.

## Corrección dirigida CI

El primer CI de PR271 detectó harness nativo obsoleto: mock interceptaba opt-import aunque Retail usa opt-retail-import-v3 desde v457, y esperaba contador combinado anterior. Se corrigieron solo esas dos expectativas. Recorrido import-upload local PC/móvil PASS: dos envíos sintéticos secuenciales, rechazo definitivo separado, bloqueo local, duplicado, logout y segundo usuario sin PDF; cero escrituras reales.
