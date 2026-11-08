# Hoja de Empaque v411

Reutiliza la tabla y el detalle de Ensamble, con filtros y ordenación por columna.
La información corresponde a la etapa EMPAQUE: saldo de empaque, Disponible,
observaciones y afectaciones. Se muestran Abiertas, Programadas y Otras.

- Abiertas: `0 < saldo_empaque < cantidad`. Prevalecen sobre Programadas.
- Programadas: órdenes operativas persistidas para Empaque y el período seleccionado.
- Otras: resto de órdenes disponibles. Cada producción se muestra una sola vez.
- Sin botón ni detalle de vidrio/ubicaciones. Las NC siguen visibles como afectaciones.
- Conserva protección de borradores ante fallos de conexión y reintentos.

## Alcance pendiente

El plan compartido actual no distingue etapas, por lo que no se copian sus cantidades
como objetivos de Empaque. La planificación e incorporación nueva por etapa necesitan
su conexión de backend. El automatismo y la incorporación de v410 siguen exclusivos
de Ensamble. Empaque permite revisión local e informes históricos; no ejecuta un
cierre por Export ni registra avance manual.
