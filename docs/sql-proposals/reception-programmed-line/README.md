# Alcance de Recepción por línea programada

En la cola de Recepción de Mecanizado de Paneles 2, el cruce válido con la programación vigente sigue teniendo precedencia. Cuando aplica el respaldo por Seguimiento de Aluminio, solo se excluyen pendientes cuyas filas activas para la misma reserva, año y semana identifican inequívocamente una misma línea distinta de Paneles 2. La línea se resuelve contra el maestro por ID o nombre; no por el sistema de la orden. Si existen valores ausentes, sin identificar o mixtos, se conserva el respaldo anterior. La recepción histórica y los recibidos sin legalizar conservan el comportamiento anterior.

El SQL modifica únicamente el predicado de lectura de la función existente. Conserva firma, propietario, permisos y la sincronización preexistente de la función. No se ejecuta la función durante la instalación, no se cambian tablas ni datos operativos y no se modifica el importador. Las reglas existentes sobre reservas principales y secundarias se preservan.

Orden de publicación: instalar y comprobar guardas de la función antes de desplegar LAB v479, que retira el filtro temporal de interfaz por sistema. Para revertir a v478, restaurar la publicación de v478 y después aplicar `rollback.sql` si el cambio se debe retirar del servidor. Ambos scripts se detienen si la huella de la función no coincide con la revisión; no reemplazar estas guardas por cambios manuales.

`synthetic.sql` es una prueba de solo lectura con 12 escenarios ficticios. Se probó también la instalación, el RPC y la reversión exacta en PostgreSQL aislado con datos sintéticos. No usar el RPC como comprobación de solo lectura en producción: con ciertos roles sincroniza reservas.
