# LP183 — publicación YA EJECUTADA (antecedente)

**No repetir estos pasos:** run41850541193 publicó1a59beda3dffaed9. Para el fallo
posterior de inventario usar solo [INSPECCION_LP183_OPERADOR.md](INSPECCION_LP183_OPERADOR.md).
El estado siguiente describe la preparación anterior al despliegue.

Estado04/11/2026: PR183 fusionado en ab1d2d65828d029ee8d6e88369b5bc5bd1113e92.
CI del HEAD revisado f5498a6:6/6 PASS; árbol de main idéntico. Backend configurado,
Edge JWT=true y comprobaciones HTTPS PASS. Frontend LP todavía NO PUBLICADO.

El conector no ofrece workflow_dispatch; hace falta iniciar el procedimiento ya
configurado en GitHub. No se necesitan infraestructura o credenciales nuevas.

1. Abrir [Actions / Deploy SGP ONE to Firebase Hosting](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/workflows/firebase-hosting.yml).
2. Pulsar **Run workflow**, seleccionar **main** y copiar estos valores:

| Campo | Valor |
|---|---|
| operation | publish |
| source_sha | ab1d2d65828d029ee8d6e88369b5bc5bd1113e92 |
| artifact_run_id | 41847862007 |
| zip_sha256 | c2a6f642da570c23efcded254b42e01414631ed59278e3270a71b9e3c1e41adc |
| expected_live_version | sites/sgp-one-lab/versions/c698e0b8a4356985 |
| release_reason | Publicacion LP autorizada por el usuario 2026-11-04 PR183 CI aprobada |
| rollback_version | Dejar vacío |

3. Iniciar y atender cualquier aprobación obligatoria que presente GitHub. Comunicar
   el enlace del run para comprobar publicación/versión/inventario. No cambiar pins
   para sortear un rechazo; si main o live cambiaron, detener y revisar la diferencia.

`zip_sha256` identifica el ZIP runtime interior revisado, no el ZIP envoltorio del
artefacto GitHub. El paquete es el SGP completo con cinco pestañas y RPC reales,
sin datos sintéticos, rutas privadas, backend, SQL o raíz del repositorio publicada.
La primera adopción del workflow quedó HOLD; prepare no desplegó.
[Evidencia exacta](../../tests/lp01-roles/evidence/publication-prepared.json).

Después: comprobar el resultado del job controlled, versión/release e inventario
Hosting; acceder a https://sgp-one-lab.web.app con sesión propia autorizada y revisar
Seguimiento/Ensamble/Empaque en PC/móvil. Confirmar guardados solo con operaciones
reales de trabajo; no introducir datos de QA ni compartir contraseñas o tokens.
Consulta no equivale a guardado: avances/notas/afectaciones/validación/cierre quedan
sujetos a rol, etapa, producción, cantidades, revisiones y evidencia disponible.
ABRIR/SALE/reapertura conservan coordinación; PDT/Export sin evidencia no dan crédito.

Si falla frontend, el destino acreditado de recuperación es c698e0b8a4356985 (incluye
#190); la operación recover exige además la versión realmente activa tras publicar,
obtenida del recibo, y los controles del workflow. No inventar ese ID ni reconstruir
un respaldo como si fuera exacto. Si falla backend: contención02 autorizada y
corrección hacia adelante, conservando perfil/historial; no borrar usuarios o datos.
Ver [plan y límites](PUBLICACION_CONTROLADA_2026_11_03.md).
