# LP — instalación y recuperación propuestas

No ejecutar este plan sin autorización expresa. Ningún SQL de esta carpeta se
aplicó en Supabase. Las pruebas usan contenedores nuevos con datos sintéticos,
sin red ni puertos publicados. No se creó copia ni respaldo de una base productiva.

## Preparación previa a una autorización

1. Revisar los SQL y contrastar nuevamente firmas, hashes, columnas, FK, propietarios,
   ACL y RLS mediante SELECT. La evidencia del 01/11/2026 no autoriza cambios futuros.
   Verificar que no se haya instalado entretanto otro motor que duplique contratos.
2. Resolver el formato Power BI real, granularidad por partes, evidencias de inclusión
   Export/liberaciones PDT y ámbitos de responsables. No activar CSV-v1 solo porque
   QA pase. Configuración propuesta por defecto: escrituras=false, formato=false,
   permisos vacíos. No usar `service_role` desde navegador.
3. Antes de cualquier instalación autorizada, el responsable debe confirmar un punto
   de recuperación/PITR válido y su restaurabilidad en la política existente. Cualquier
   creación/restauración de respaldo requiere autorización separada; este encargo no
   ejecutó backups. Los cuerpos y ACL capturados son metadatos de compatibilidad,
   no un respaldo de datos. No prometer recuperación por una exportación de esquema.

## Orden propuesto

1. Autorizar separadamente la instalación de `01_operacion_REVIEW.sql`. Una sola
   transacción con precondiciones, bloqueo/timeout y configuración contenida. Si una
   verificación falla, detener; no eliminar guardas para forzar ejecución.
2. Ejecutar las comprobaciones de `03_VERIFICAR_READ_ONLY.sql`: firmas correctas,
   `SECURITY DEFINER` con search_path vacío, tablas RLS, acceso directo anon=false,
   configuración aún deshabilitada y ninguna mutación de tablas legacy.
3. Autorizar `04_vidrio_REVIEW.sql` si se aprueba esa corrección compatible. Es otra
   transacción atómica con hash de función origen; no cambia permisos ni datos.
4. Cargar ámbitos aprobados y conectar puentes certificados mediante una propuesta
   revisada. Es DML/configuración productiva y requiere autorización, no se suministra
   un UPDATE general ni se inventan usuarios/producciones. Habilitar solo después de
   confirmar contratos reales y aprobar por separado el cambio de configuración.
5. Autorizar publicación del frontend y pruebas productivas con responsables reales.
   No hay despliegue automático desde esta rama: los workflows de publicación se
   revisaron; live está asociado a main y los otros flujos requieren sus disparadores.
6. Verificar consultas de turno por cada línea/etapa, denegación de ámbitos ajenos,
   último acumulado, duplicado idempotente, saldo Export sin cambios, cierre con
   archivo real y reapertura/versiones. Estas escrituras no están autorizadas ahora.

## Recuperación

- Antes del COMMIT: cualquier error revierte la transacción completa. Probado con
  fallo forzado en PostgreSQL aislado; no quedan esquema ni fachadas a medias.
- Después de instalar y antes de usar: mantener configuración contenida. No hay
  motivo para borrar el esquema para regresar al frontend anterior; las consultas
  históricas siguen funcionando. Una desinstalación DDL requiere un inventario nuevo
  de dependencias y autorización específica; no se incluye DROP CASCADE.
- Con avances, archivos, auditorías o cierres reales: **no borrar ni restaurar encima
  de datos nuevos**. Autorizar `02_CONTENER_REVIEW.sql`, conservar las lecturas y
  aplicar una corrección hacia adelante versionada. Los snapshots anteriores son
  inmutables; una corrección funcional debe generar otra versión, no reescribirlos.
- Si cambió una carga Export o ya se arrastró una orden: no resetear presupuestos,
  reconciliar cantidades ni borrar sucesores por inferencia. Requiere evidencia
  explícita de inclusión y conciliación de la cadena. Hasta entonces, contención.
- Vidrio puede regresar al cuerpo anterior mediante `05_restaurar_vidrio_REVIEW.sql`,
  que comprueba el hash exacto de la propuesta y no toca ubicaciones. Si otra revisión
  cambió el contrato, aborta y exige corrección hacia adelante. El frontend tolera el
  contrato anterior e indica que Traslado no está desglosado. Round-trip aislado probado.
- Un fallo mayor de infraestructura se gestiona con la recuperación/PITR corporativa
  autorizada y reconciliación posterior; no se confunde con rollback de este PR.

## Inventario de instrucciones sensibles

Aplica solo a los SQL propuestos de `docs/sql-proposals/lp01-operacion/`.

| Instrucción | Objetos y motivo |
|---|---|
| DROP | Ninguna instrucción. No se propone eliminar funciones, tablas, esquemas ni dependencias. |
| DELETE | Ningún DML. `BEFORE UPDATE OR DELETE` aparece en triggers de inmutabilidad que rechazan cambios de auditoría, archivos, cierres y notificaciones; no elimina datos. |
| TRUNCATE | Ninguna instrucción. |
| UPDATE sin WHERE | Ninguna instrucción DML. |
| UPDATE con WHERE en 01 | Turno exacto por línea/etapa/fecha/turno; orden exacta además por producción/parte; liberación exacta por UUID. Registra estado, SALE, acumulado, afectaciones, revisión u origen de consumo dentro del comando autorizado. No actualiza `public.sgp_producciones`, Programación, Picking o Mecanizado. |
| UPDATE con WHERE en 02 | Una fila `config WHERE id=true`; deshabilita escrituras como contención autorizada. |
| CREATE OR REPLACE en 04/05 | Solo el cuerpo de `public.sgp_detalle_ubicacion_vidrio(text,text)`, con hash previo; preserva identidad, firma y ACL. 05 restaura el cuerpo capturado. |
| REVOKE/GRANT en 01 | Esquema/tablas/funciones nuevas: deniega acceso directo; EXECUTE solo en dos fachadas, con sesión y ámbito. No desactiva RLS ni amplía privilegios de tablas productivas. |

Las pruebas aisladas sí crean tablas/roles/datos sintéticos y actualizan sesiones,
ámbitos y fuentes de QA. Sus comandos no apuntan a Supabase; no son pasos de
instalación ni evidencia de modificaciones productivas.

## Operaciones que requieren autorización explícita

- Aplicar 01 o 04 en Supabase y cualquier ajuste de DDL/permisos/propietarios.
- Escribir ámbitos reales, activar escrituras/adaptador real o instalar puentes.
- Crear/restaurar respaldos, aplicar contención 02 o restauración de función 05.
- Cualquier avance, afectación, cierre, reapertura o prueba con datos productivos.
- Conciliar históricos o cambiar presupuestos, arrastres o inclusión Export.
- Fusionar #183, publicar, ejecutar publish o desplegar Firebase.

No se solicita ninguna de esas operaciones en esta entrega.
