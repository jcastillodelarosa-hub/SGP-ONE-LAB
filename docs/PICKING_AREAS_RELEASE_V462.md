# Recepción por áreas · LAB v462 candidata

Implementado en rama sobre main 12dc927, no instalado ni publicado.
Paneles requiere Verticales y Zocalero; cada área confirma faltantes o sin faltantes.
Otras líneas tienen una revisión por defecto, configurable por Administrador.
Usuario real y fecha/turno por área; no se atribuyen revisiones a registros antiguos.
Reporte conserva una recepción consolidada, con detalle de cada revisión.

Pruebas locales: 1348 Node aprobadas, 10 omitidas; DOM modal/config y 17 controles
reporte aprobados; SQL sintético 15 grupos aprobados. Revisión independiente sin
bloqueo crítico. CI PostgreSQL17 multisesión y navegador PC/móvil aprobados; repetir tras cada cambio.
Auth/PDT de pruebas son sintéticos. No acreditan sesión real en planta.

SQL y rollback: docs/sql-proposals/picking-audit-areas/README.md.
Publicar primero frontend compatible (fallback sólo RPC ausente); verificar activo.
Instalar SQL después, con CI y respaldo vigente; conservar
historial y no repetir regularización de semanas 45/46.
