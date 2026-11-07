# INCORPORAR después de aprobación Export

**PROPUESTO / PROBADO EN AISLAMIENTO / NO APLICADO / DESACTIVADO.**
La interfaz de v405 ya existe. Este paquete sustituye, no se suma, a los SQL 01 y
03 de `../lp01-incorporar` al instalar después de Export v406. No publica ni activa
credenciales, roles, accesos, jobs ni banderas.

## Cambio respecto a la propuesta probada en v405

- El escritor exige `NOT sgp_producciones.excluida_export` bajo su lock de producción.
  Una vista antigua no permite incorporar una ausencia aprobada por el coordinador.
- La columna booleana NOT NULL de aprobación debe existir; no se crea aquí.
- Descubrimiento parte del lector candidato v406 y conserva ambos filtros de hoja
  (orders/catalog) y el campo explícito. Historial, reportes y horarios intactos.
- El resto del comando, permisos limitados, CAS, idempotencia, locks y rollback se
  conservan del paquete anterior. Instalación deja `incorporar_ensamble=false`.

## Dependencias y orden

1. Integrar/aplicar Export v406 (01/02/03 juntos) y comprobar su readback. Fuente
   candidata del lector MD5 `3ecf0a9ec4497de02b1d7ac89bc80819`; **acreditado instalado por readback v406**. El fichero guardado en pruebas es copia exacta del candidato; el readback
   productivo confirmó el mismo MD5 sin ejecutar otra instalación. El preflight rechaza cualquier cuerpo distinto.
2. Revisar y autorizar instalación de este 01 y 03 en una única transacción;
   conservar explícitamente bandera false. No usar los anteriores 01/03 además.
3. CI PostgreSQL17 del SHA final debe cubrir también `--post-export` y la carrera
   exclusión/INCORPORAR. El PASS de v405 se conserva como evidencia del caso base,
   no certifica el nuevo predicado.
4. Activación persistente separada y autorizada: solamente LIDER LINEA y SUPERVISOR
   ENSAMBLE con acceso individual/de rol/temporal vigente, ENSAMBLE/PANELES_2,
   turno abierto y sin sucesor. Cantidad limitada y motivo auditado. No concede
   ABRIR, SALE, VALIDAR, Empaque, cierre Export ni autoridad global.
5. Para recuperación, contener bandera, aplicar 04 y luego 02. Conserva columna
   false, órdenes, asignaciones y auditoría. No deshace operaciones confirmadas.

El comando resultante cambia de hash respecto al paquete anterior. Las propuestas
inactivas `lp01-export-import-v2` y `lp01-export-close-v2` **no se aplican encima sin
rebasarlas y verificarlas**: sus pins rechazarán la diferencia. No relajar controles
ni instalar primero la cadena antigua para eludir esta incompatibilidad.

## Evidencia proporcional

`node tests/lp01-incorporar/pglite.mjs --post-export`: 8 grupos PASS. Incluye
rechazo de excluida sin efectos, descubrimiento, ACL conservadas, roles, recibos,
reintentos, CAS, rollback y restauración de inclusión. Datos sintéticos PGlite.
`post-export/results.json` contiene límites exactos; no es aceptación en planta.

Nuevo caso PostgreSQL17 preparado: la aprobación de exclusión mantiene bloqueada
la producción; INCORPORAR espera, vuelve a comprobar al COMMIT y rechaza sin alta.
No ejecutado localmente: Docker no está disponible. Se agrega al workflow existente
sin retirar casos ni debilitar gates. Siete pruebas de limpieza del harness PASS.
