# v411: pruebas de la UI vigente y contratos heredados

La hoja de Empaque sustituye los controles manuales anteriores. Estas pruebas sirven el artefacto real sin reescritura de módulos ni rutas alternativas. Ningún workflow, política, SQL o prueba API se elimina o modifica.

| Suite browser | Cobertura UI retirada porque ya no existe | Sustitución UI actual | Contrato conservado |
| --- | --- | --- | --- |
| powerbi | Ejecutado manual, importación legacy, pérdida/reintento de respuesta, conciliación/cierre y descarga desde esa ruta | Hoja/detalle/cierre consultivo Empaque; ausencia de comandos; auditoría y asignaciones intactas. Se mantienen probes del endpoint: origen, payload normalizado, token inválido y XLSX corrupto | powerbi/postgres.py y pruebas Node del handler/parser |
| cierres-integrados | Formulario manual, revocación al guardar, importación, motivos, reapertura, recierre y descarga desde controles retirados | Ambas etapas: detalle, revisión de cierre sin mutación, etapas permanecen abiertas; producción/plan/auditoría intactos | cierres-integrados/isolated.py, ámbitos temporales y roles SQL/API |
| continuidad | Capacidad/SALE, avance manual, siguiente turno/arrastre y recibo de NOTA desde formulario antiguo | Consulta T1/T2 con motor legado, sin abrir/cerrar; auditoría/turnos/plan/Export intactos | continuidad/postgres.py y xlsx-admission.py |
| sin-actividad | Confirmación/cancelación, cierre vacío, reintento/reapertura/recierre mediante botones retirados | Revisión consultiva de turno vacío T1/T2; sin controles de cierre/apertura, sin mutaciones | sin-actividad/postgres.py |
| apertura | Avisos y fallback manual del motor anterior | Consulta de Empaque en T1/T2 no abre ni cierra bajo contrato legado; sin controles manuales | apertura/postgres.py; motor de horario Ensamble tiene sus pruebas propias |
| roles | Diálogo de confirmación individual y cierre vacío Empaque desde UI | Supervisor Empaque puede consultar/revisar sin cerrar; permanece ABIERTO, auditoría intacta | roles/postgres.py, hardening.py, activation.py, compatibility.py, xlsx.py |
| fuentes | Botón antiguo de consulta de materiales | Contexto real en detalle compartido de ambas etapas; saldo NULL no se vuelve cero; homónimos/identidad duplicada sin crédito; sesión vencida rechazada por PostgreSQL | fuentes/postgres.py |

Roles conserva además la UI nativa de administración de usuarios/roles, revocación, permisos por etapa y navegación de líderes. La suite específica de hoja comprueba filtros, ordenación, observaciones, detalle, ausencia de vidrio y presentación PC/móvil. Estos cambios no afirman que el nuevo cierre por Export o la programación/incorporación Empaque ya estén habilitados.

Límite: las garantías de escritura heredadas se verifican a nivel SQL/API, no con botones que la aplicación vigente ya no presenta. No se declara equivalencia end-to-end de esos controles retirados.
