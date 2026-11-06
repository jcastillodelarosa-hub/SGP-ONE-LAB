> Actualización 06/11/2026: **APLICADO EN SUPABASE** bajo autorización delegada.
> Migración `lp_session_scoped_v397`; postcheck 11:12:30 UTC confirma huella y ACL.
> Evidencia: `session-scoped-production-evidence.json`. Lectura/guardado sin sesión
> rechazados; éxito y latencia con sesión real pendientes. Las notas de propuesta
> siguientes conservan el estado histórico anterior a esta aplicación.

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

## Compatibilidad y paso de activación preparado · 06/11/2026

Paquete recuperado por Git desde `9623e797210742e8143ab0050b0b44823499b8ef`,
incorporado sin modificar SQL/test sobre main v397
`a45ddd8a8d95ecb1beb392e164908dc18ee3e3ba`. Sin delta frontend ni versión.
Comparación sin diferencias en `10_roles_cierre_individual_REVIEW.sql`,
`lp01-afectaciones/02_rpc_REVIEW.sql`, `lp01-order-sale/01_definition_REVIEW.sql`
y fixture `tests/lp01-afectaciones-rpc/atomic.py`. Se reutilizan las 90
comparaciones y recuperación reportadas por el autor; no se ejecutaron otra vez.
Esto acredita compatibilidad con fuentes versionadas, no con catálogo vivo nuevo.

SHA256 de los archivos exactos:
- 03: `6294d6d2b972b0da8bcd1114b0619ba776bd2a22a781fd8b7aee7e52ad9bd2fa`.
- 04: `8d5f7fedcda0d4c4d12410a412e7da23bb317a984376a7ab6e5587edfc4d0e44`.

Paso concreto pendiente de autorización: ejecutar **solo 03 completo** en
Supabase SGP-ONE-LAB como propietario `postgres`, una transacción; reemplaza
únicamente `sgp_lp_operacion.sesion(text,text,text,text)`. No ejecutar 01/02,
activar banderas, conceder permisos ni cambiar timeout del cliente/rol.
La vía rápida se utiliza si `perfil_roles.habilitado` ya está true; si está false
se conserva la vía previa y no se promete mejora de latencia.

Antes de autorizar, reutilizar readback vigente si existe o contrastar en solo
lectura cuerpo/owner/DEFINER/config/ACL de sesión y definiciones de
`contener_ambitos`, `permisos_en_periodo`, `acceso_rol`, `operaciones_rol` y
`sgp_sesion_actual`, además de la bandera perfil_roles. El guard de 03 comprueba
sesión, pero **no fija las huellas de estas dependencias**: detener ante drift,
no editar los pins para forzar instalación. Mantener locks, sesión real y
revalidaciones del llamador; el cambio afecta a todos los consumidores LP.

03 usa lock_timeout 5s y statement_timeout 30s locales a la instalación;
cualquier error aborta la transacción. Postcheck de catálogo: cuerpo nuevo
`3416a2f6e5640577a4a07c554e26c55e`, postgres, DEFINER, search_path vacío,
ACL `{postgres=X/postgres}`; flags/RLS/contratos intactos. La instalación no
requiere ni añade EXECUTE a anon/authenticated: las RPC públicas existentes
siguen siendo la entrada. Después comprobar lecturas reales y 57014/latencias;
no crear escrituras de prueba productivas. Un guardado operativo real requiere
la acción del usuario y comprobar su confirmación e historial; no darlo por
verificado por las pruebas de autorización.

Recuperación preparada: **04 completo**, solo bajo autorización de recuperación
y si coincide la huella nueva y los metadatos fijados; restaura cuerpo original
sin borrar ni revertir registros de negocio. Si hay drift, aborta y requiere
revisión; no usar 08R ni restaurar datos. No se ejecutó 03 ni 04 en esta revisión.
