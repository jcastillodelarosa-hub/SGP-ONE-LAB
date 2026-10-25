# Configuración de respaldo GCS — preparada, no aplicada

Inventario real del proyecto `sgp-one-lab`: **cero buckets**, run 40234463659.
Se autenticó con la credencial existente de Firebase, mediante OAuth del SDK.
No se creó ninguna clave, API, bucket ni permiso IAM; no se exportaron datos.

## Recurso propuesto para aprobación

`bucket.json`: `gs://sgp-one-lab-supabase-backups`, región US-EAST1, Standard,
acceso público impedido y permisos uniformes. Cifrado automático Google-managed
at rest; transferencia únicamente HTTPS. Sin claves JSON nuevas ni KMS facturable.
Retención mínima propuesta siete días, sin bloqueo irreversible ni borrado automático.
El nombre es una propuesta: disponibilidad global no verificada. Mantener prefijo
por proyecto: `supabase/ocvxbwzqxbrfndkvjmfx/<fecha-UTC>/<run-id>/`.

La creación y el uso pueden generar cargos de almacenamiento, operaciones y
transferencia. No se promete costo cero ni disponibilidad de cuota gratuita.
**No ejecutar la creación hasta autorización expresa de ese consumo.**

Comando de creación para un administrador, tras aprobar el recurso/costo:

```bash
gcloud storage buckets create gs://sgp-one-lab-supabase-backups \
  --project=sgp-one-lab --location=US-EAST1 --default-storage-class=STANDARD \
  --uniform-bucket-level-access --public-access-prevention
```

Aplicar la retención de siete días propuesta solo como parte de la configuración
aprobada; no bloquearla de forma irreversible. Verificar IAM sin allUsers ni
allAuthenticatedUsers antes de exportar. No reutilizar buckets públicos/de aplicación.

## Identidad y privilegios mínimos

Preferir cuenta de servicio dedicada y Workload Identity Federation GitHub→GCP,
restringida a repositorio numérico y environment `supabase-backup`, sin claves nuevas.
`writer-role.json` es el rol de permisos propuesto, asociado **solo a este bucket**.
No permite borrar, sobrescribir objetos, cambiar IAM, crear buckets ni desplegar Firebase.
El escritor no necesita listar objetos: conoce sus rutas/generaciones exactas.
Usar precondición generation-match=0 al guardar y generación fija al recuperar.

La credencial existente solo se reutilizó para inventario. No ampliar sus permisos
ni cambiar la identidad del despliegue Firebase para configurar el respaldo.
WIF requiere configuración/atributos y permisos administrativos verificados; no se
han inventado provider IDs ni aplicado políticas en este encargo.

## Respaldo y restauración pendientes del destino

- pg_dump 17 custom con snapshot consistente, sin bloquear escrituras de aplicación.
- Globales/roles sin contraseñas, metadatos/ACL y limitaciones Supabase documentados.
- Enviar el dump al destino privado por streaming o ficheros temporales protegidos;
  nunca al repositorio, logs, cachés ni artefactos GitHub. No retener solo en runner efímero.
- Registrar fecha, tamaño, SHA256, generación GCS y huellas de catálogo en manifiesto
  privado; recuperar desde GCS y comprobar SHA256 antes de restaurar.
- Restaurar a base NUEVA y aislada, sin red/puertos públicos, con PostgreSQL 17.11
  y extensiones Supabase. No ejecutar un dump remoto como SQL en producción.
- Comparar tablas/conteos del mismo snapshot, funciones, triggers, permisos y contratos;
  no publicar filas, funciones potencialmente sensibles ni manifiestos de datos en logs.
- El dump no incluye Storage externo, secretos ni todos los elementos administrados de
  plataforma. No afirmar recuperación completa solo por disponer de un archivo.
- No hay prueba de restauración productiva hasta completar esos pasos.

## Instalación productiva

Ventana autorizada: 25/10/2026 22:00–23:00 Colombia;
26/10/2026 03:00–04:00 UTC. Antes de intervenir comprobar control efectivo de
escrituras con planta, respaldo restaurado y contratos críticos. No pausar operaciones
ni migrar por el solo hecho de alcanzar esa hora. Sin PITR, no restaurar un dump
anterior sobre producción activa; preservar escrituras posteriores y preferir
rollback transaccional/corrección forward compatible.
