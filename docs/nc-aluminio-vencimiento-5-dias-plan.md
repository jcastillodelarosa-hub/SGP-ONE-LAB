# NC aluminio — vencimiento de 5 dias (preparacion, sin ejecutar)

## Regla aprobada
Una NC con estado del Excel `Sin Auditar` y mas de 5 dias calendario desde `creacion` se presenta como `ELIMINADA`, incluso con reserva solucion. Nunca borrar la NC ni modificar `activo` por esta regla.

## Dependencias auditadas
- `src/domain/nc-aluminum-importer.js`: conserva `estado`, `creacion` y `reserva_solucion`.
- `app.js`: `previewNcAluminum`, `applyNcAluminum`, `loadNcOperational`, `openNcMetric`, `loadNcAlReport`.
- RPC: `sgp_aplicar_nc_aluminio`, `sgp_consultar_nc_aluminio`, `sgp_resumen_carga_nc_aluminio`, `sgp_metricas_origen_nc_aluminio`, `sgp_resumen_nc_aluminio_linea`, `sgp_informe_nc_aluminio`.
- Vista: `sgp_nc_aluminio_reporte_base`; preserva estadisticas historicas.
- Historial: `sgp_nc_aluminio_cambios`; registrar una sola transicion por vencimiento.
- Seguridad: conservar `sgp_validar_sesion_rol`, grants y comportamiento RLS existente.

## Contrato de implementacion siguiente
1. Definir estado operativo derivado, sin sobreescribir el estado del Excel.
2. Evaluar edad con fecha local America/Bogota; >5 significa dia 6.
3. En carga diaria preservar la eliminacion ante reimportacion `Sin Auditar`.
4. Si Excel cambia a `Consultada` o `Finalizada`, restaurar estado operativo y conservar evento previo.
5. Separar historico de pendientes operativos; excluir ELIMINADA de semanas abiertas.
6. No contar NC ELIMINADA como FINALIZADA; mantener informes de peso/cortes.
7. Asegurar idempotencia de evento de vencimiento.
8. Prever evaluacion sin carga diaria: job controlado o calculo en consulta, sin escrituras desde RPC de lectura.

## Pruebas requeridas
- 5 dias permanece; 6 dias ELIMINADA; con/sin reserva solucion.
- CONSULTADA y FINALIZADA no vencen.
- Doble carga no duplica eventos.
- Reimportacion Sin Auditar no reactiva.
- Transicion a Consultada/Finalizada restaura estado operativo y conserva historial.
- Semana abierta sin NC pendientes deja de figurar; reportes historicos intactos.
- Roles permitidos y denegados; RLS/grants sin ampliaciones.
- Rollback definido antes de aplicar migracion.

## Evidencia de lectura 2026-10-22/23
716 NC, 15 Sin Auditar, 2 con antiguedad superior a cinco dias. Caso 1005539 trae Sin Auditar + reserva solucion 8741884 desde Excel. Datos sujetos a nuevas cargas.

## Limite de este PR
La migracion adjunta prepara exclusivamente columnas aditivas; no implementa aun la automatizacion de estados, las RPC ni el frontend. NO fusionar ni aplicar hasta completar estos componentes y ejecutar pruebas.
