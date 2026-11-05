# Propuesta de sesión acotada para Línea de Producción

Estado: **solo preparada y probada en PostgreSQL aislado**. No instalada ni
habilitada en Supabase. La función es compartida por Operación, Seguimiento y
Afectaciones; requiere revisión de seguridad y coordinación de activación.

Entre 20:40 y 20:55 UTC del 05/11/2026, los registros PostgreSQL de SGP-ONE-LAB
contienen 12 cancelaciones 57014 de `sgp_lp_sale_orden_consultar_v1`. La pila
termina en `sgp_lp_operacion.permisos_en_periodo`, llamado por
`sgp_lp_operacion.sesion` a través del lector de afectaciones. Con
`perfil_roles.habilitado=true`, esa función produce permisos para los usuarios
y todas las producciones de PANELES_2 antes de filtrar una orden concreta.
La inspección agregada encontró 12 usuarios y 596 producciones; el timeout
configurado es 2 minutos. No se consultaron ni cambiaron filas individuales.

`03_session_scoped_REVIEW.sql` reemplaza **solo** el cuerpo de
`sgp_lp_operacion.sesion(text,text,text,text)`: en modo perfil de roles valida
sesión, rol, etapa, acceso real y existencia de la clave en PANELES_2 directamente.
Con el perfil apagado conserva literalmente el camino temporal anterior.
La instalación exige MD5 anterior `f06e86fb101d602de053faa50d6696b3`,
propietario `postgres`, `SECURITY DEFINER`, `search_path` vacío y ACL
`{postgres=X/postgres}`. No hay `GRANT`, tablas, índices, backfill ni DML.
El MD5 esperado posterior es `3416a2f6e5640577a4a07c554e26c55e`.
`04_session_scoped_ROLLBACK_REVIEW.sql` exige esa huella y restaura la original.

La prueba `tests/lp01-order-sale/session-scoped.py` comparó 90 combinaciones de
usuario, etapa, clave y línea antes/después, comprobó owner/ACL/search_path y
ejecutó rollback con restauración de la huella original. Pasó con datos
sintéticos. Esto acredita equivalencia de las decisiones muestreadas, no
latencia productiva ni una autorización para instalar. Tras activación, habría
que comprobar errores 57014 y latencia en lectura con sesiones reales, sin
crear escrituras de prueba ni exponer datos.
