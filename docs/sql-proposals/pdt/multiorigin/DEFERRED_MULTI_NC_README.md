# Corrección de vinculación diferida para Picking

El PR #158 introdujo `PDT_NC_NO_ENCONTRADA` para cualquier referencia ausente
en una lista de varias NC. El contrato anterior permitía guardar una referencia
en el pendiente y `sgp_aluminio_pendientes_listar_v2` la resolvía dinámicamente
contra `sgp_nc_aluminio` al consultar. El registro nuevo guardaba solo la primera
referencia en `p.nc`; las demás quedaban en el historial `ncs` y la lectura no
las consultaba.

`04_deferred_multi_nc_REVIEW.sql` elimina exclusivamente ese rechazo y hace
que la lectura incluya las referencias del evento de registro. Mantiene `p.nc`
como referencia principal, un pendiente y su cantidad por pieza, y los enlaces
canónicos existentes. Una NC aún ausente aparece como `NO_ENCONTRADA`; al
ingresarla en el catálogo, la misma lectura la resuelve sin editar el pendiente.
La RPC existente `sgp_aluminio_pendiente_nc_vincular_v1` puede materializar el
enlace después; su `ON CONFLICT DO NOTHING` evita duplicarlo. El SQL correctivo
no modifica esa RPC, las tablas, RLS, roles ni privilegios.

El preflight exige PostgreSQL 17, las huellas exactas de ambas funciones
instaladas y su configuración de seguridad. La instalación y el postcheck son
atómicos. Para aplicarla, comprobar un respaldo reciente verificado con
restauración aislada mediante el procedimiento protegido de respaldo existente;
conservar su identificador, generación y SHA-256 en la evidencia privada.
No usar una copia anterior por su nombre ni crear un respaldo nuevo solo para
esta revisión. Tras autorización de aplicación separada, ejecutar el archivo
versionado mediante el procedimiento de migraciones autorizado y verificar las
dos huellas nuevas, permisos, RLS y las restricciones de enlaces.

`04_deferred_multi_nc_ROLLBACK_REVIEW.sql` restaura las definiciones anteriores
solo si no hay eventos de múltiples NC persistidos y las huellas correctivas
siguen intactas. No elimina datos. Si ya hay eventos múltiples, conservar el
lector corregido y preparar una reparación hacia delante: la reversión perdería
la visibilidad de referencias diferidas.

La prueba focalizada es `python3 tests/pdt-multiorigin/test-deferred-multi-nc.py`
en un contenedor PostgreSQL 17.11 sin red ni puertos. Cubre 0/1/2/20 NC,
coincidencias posteriores, NC existentes y ausentes mezcladas, reintentos,
reservas compartidas, ambigüedad, duplicados y reversión. Es sintética: no
registra datos funcionales en producción ni sustituye la aceptación por roles.
