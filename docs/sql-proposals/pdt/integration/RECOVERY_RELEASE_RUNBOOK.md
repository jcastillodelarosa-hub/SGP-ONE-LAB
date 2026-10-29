# PDT unificado — recuperación coordinada y decisión de publicación

## Antes de escribir en producción
1. Verificar respaldos privados recientes del proyecto Supabase correcto, con objeto GCS, generación, SHA-256, catálogo y **restauración aislada completada**. No basta un run verde ni `pg_restore --list`.
2. Ejecutar preflight de solo lectura, contrastar hashes de RPC productivas con los guards de los siete SQL, RLS, privilegios y firmas. Resolver cualquier divergencia antes de instalar.
3. Confirmar que el frontend exacto del candidato compila, pasa pruebas y puede desplegarse con credenciales válidas; tener a mano versión anterior de Firebase.
4. Establecer ventana corta de mantenimiento y suspender altas operativas PDT durante el corte. Registrar responsable `Jcastillo`.
5. Confirmar acceso a Firebase Hosting y Supabase, con operadores disponibles para observar y reparar.

## Instalación / activación
- No realizar siete migraciones si no existe control de fallos y recuperación entre fases. Cada fase debe registrar éxito; ante error, **detener** sin activar.
- Antes de activar, `06_ROLLBACK_REVIEW.sql` permite retirar solo el corte no activado; los otros SQL tienen rollback y restricciones propias.
- Activar corte UTC **solo en el instante efectivo** y publicar inmediatamente el frontend previamente probado.
- Verificar HTTP y hashes del artefacto, acceso real por roles y lectura de PDT nuevos, y que históricos no reaparezcan en operación.

## Fallos después de la activación
- **Nunca** ejecutar `06_ROLLBACK_REVIEW.sql` después de activar ni restaurar toda la base automáticamente: perdería escrituras legítimas posteriores.
- Si falla Firebase: detener nuevas operaciones PDT; identificar versión live anterior y artefacto exacto del candidato; corregir y volver a desplegar hacia adelante. Evitar volver a frontend antiguo que no interprete el corte sin contención previa.
- Si falla RPC: mantener frontend en modo fallo cerrado y reparar RPC hacia delante, conservando `corte_operativo` y registros históricos.
- Si fallan permisos: revisar grants y RLS; no desactivar RLS ni emplear `service_role` como solución.
- Reabrir operaciones únicamente tras prueba de rol real, lectura y escritura controlada, Picking y cierre.
- Registrar línea de tiempo UTC, hash de frontend, commit, respaldo, fallos, decisiones y resultado. Escalar a administrador si se requiere intervención manual.

## Estado de preparación
El workflow actual tiene bloqueo deliberado de `publish`. Solo se elimina tras demostrar recuperación aislada del respaldo **de la ventana actual**, preflight completo contra RPC productivas y procedimiento de despliegue/recuperación comprobado. Ninguna de esas evidencias se infiere del documento.
