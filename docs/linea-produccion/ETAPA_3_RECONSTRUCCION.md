# SGP Línea de Producción — reconstrucción controlada (Etapa 3)

Estado: IMPLEMENTACIÓN EN RAMA, sin fusión ni despliegue.

## Alcance aprobado
Reconstruir el frontend de Línea de Producción bajo LP-01 Programación, LP-02 Seguimiento, LP-03 Operación, LP-04 Vidrio, LP-05 Dashboard y LP-06 Reportes. Ensamble y Empaque son procesos dentro de Seguimiento y Operación, no módulos principales. Preservar íntegramente Reporte de ubicaciones y su mapa de relaciones.

## Invariantes
- No borrar ni alterar datos históricos, tablas, RPC, políticas RLS o contratos Supabase.
- No tocar SGP_ONE_GOOGLE, LAC, Firebase ni main.
- No alterar funciones compartidas de Mecanizado, Picking o PDT; PR #116 modifica app.js, index.html y styles.css: revisar diferencias antes de tocar esos archivos.
- Reporte de ubicaciones debe conservar filtros, cálculos, KPIs, explorador de relaciones entre burros, órdenes y reservas y su comportamiento móvil.
- Identidad de producción y reservas compartidas intacta; Export es saldo oficial y Power BI la fuente separada de rendimiento de turno.

## Secuencia de integración
1. Identificar y encapsular los selectores, controladores y dependencias de Reporte de ubicaciones; establecer prueba de no regresión antes de retirar vistas antiguas.
2. Incorporar shell de navegación LP-01…LP-06 bajo el módulo existente sin duplicar accesos principales.
3. Sustituir gradualmente Planificador/Ensamble/Empaque antiguos, sin desconectar Reporte de ubicaciones.
4. Comprobar navegación, visibilidad por rol, PC y móvil; pruebas dirigidas de Reporte de ubicaciones y módulos compartidos.

## Condiciones de cierre de Etapa 3
- Las seis secciones están disponibles en la rama, con estados vacíos explícitos para las funciones pendientes.
- Reporte de ubicaciones funciona como antes y es accesible desde la nueva estructura.
- Pruebas reales dirigidas y evidencia del recorrido PC/móvil.
- No hay cambios de base de datos ni despliegue; entregar SHA y comparación de archivos.
