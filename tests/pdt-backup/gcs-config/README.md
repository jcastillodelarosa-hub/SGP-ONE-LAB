# Respaldo privado GCS — estado verificado 2026-10-25

Bucket autorizado y creado: `gs://sgp-one-lab-supabase-backups`, proyecto
`sgp-one-lab`, US-EAST1. El propietario autorizó cargos de almacenamiento/operaciones.
Metadatos verificados: PAP enforced, acceso uniforme, cifrado Google-managed,
retención 604800 segundos (siete días), sin bloqueo irreversible. HTTPS obligatorio.

Se reutiliza la credencial existente solo dentro de Actions; no se generaron claves
JSON nuevas. El trabajador de objetos usa token STS temporal limitado al prefijo
`supabase/ocvxbwzqxbrfndkvjmfx/`, objectCreator/objectViewer, sin delete/overwrite/IAM.
Subida con generation-match=0, descarga por generación y SHA256; comprobación real
de acceso fuera del prefijo rechazada (run 40236497823). La lectura de la política
IAM completa sigue sin permiso; no se afirma que se auditó o redujo toda la IAM.
`writer-role.json` es una propuesta no aplicada; WIF dedicado queda como mejora.

Respaldo productivo existente y recuperación aislada verificados: run 40246169107.
No se guardaron dumps en GitHub, cachés, logs o artefactos. Manifiesto privado y
alcance/exclusiones en `docs/sql-proposals/pdt/FINAL_READINESS.md`. No equivale a
recuperación completa de servicios externos Supabase ni replay de escrituras nuevas.

Para continuar la misma recuperación, operación manual `restore-backup` del workflow
392452313, rama existente del PR #91: no usa contraseña de base ni genera otro dump.
No utilizar `backup-restore` para repetir el respaldo sin necesidad.

Producción sigue sin modificaciones. Instalación condicionada a control efectivo
de escrituras con planta y ventana 25/10/2026 22:00–23:00 Colombia. No restaurar un
dump antiguo sobre producción activa ni asumir que preserva operaciones posteriores.
