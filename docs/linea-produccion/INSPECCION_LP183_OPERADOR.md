# Inspección de la versión publicada: solo lectura

La ejecución41850541193 publicó1a59beda3dffaed9 correctamente; falló después en
LIVE_INVENTORY_DIFFERENT. No relanzar publish ni recover para diagnosticarlo.

El conector no tiene workflow_dispatch. Una única intervención permite obtener
el inventario y comprobar los bytes contra el ZIP original, sin modificar Hosting:

1. Abrir [Actions / Deploy SGP ONE to Firebase Hosting](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/workflows/firebase-hosting.yml).
2. **Run workflow**, seleccionar **feat/lp01-seguimiento-operacion** (contiene el
   inspector; main conserva el runtime publicado) y copiar:

| Campo | Valor |
|---|---|
| operation | inspect |
| source_sha | ab1d2d65828d029ee8d6e88369b5bc5bd1113e92 |
| artifact_run_id | 41847862007 |
| zip_sha256 | c2a6f642da570c23efcded254b42e01414631ed59278e3270a71b9e3c1e41adc |
| expected_live_version | sites/sgp-one-lab/versions/1a59beda3dffaed9 |
| release_reason | Inspeccion solo lectura LP183 version publicada |
| rollback_version | Vacío |

3. Comunicar el enlace del run. Un resultado de diferencia puede dejar el job rojo:
   leer el informe, no relanzar publicación. El artefacto hosting-identity-RUN guarda
   lp-live-inspection.json incluso si el comparador falla.

Este recorrido solo descarga el artefacto original, usa GET para API/recursos
públicos y prueba denegaciones con una sesión SGP deliberadamente inválida. No
crea sesiones, órdenes o avances; los pasos publish/recover quedan omitidos.
Publica únicamente resultados de comparación: rutas faltantes/adicionales,
huellas de recursos públicos y controles de identidad/versión. No secretos ni
contenido de archivos adicionales desconocidos.

La aceptación de Seguimiento/Ensamble/Empaque con datos reales y guardados requiere
sesión propia de un responsable autorizado en https://sgp-one-lab.web.app, PC/móvil.
No compartir credenciales ni introducir datos ficticios para esa comprobación.
