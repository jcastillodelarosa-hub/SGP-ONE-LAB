> Preparación desde a19a9f6: [apertura automática](APERTURA_AUTOMATICA_PREPARACION.md)
> agrega observación y validación de cierre acreditado en 01; no agrega jobs, roles,
> GRANT técnicos, secretos o ejecutor. Seleccionar/aprobar identidad y ámbitos antes
> de preparar ese enlace. No confundir la prueba manual del motor con permiso técnico.

> Candidato actualizado desde 21c40f4: [cierre SIN ACTIVIDAD](SIN_ACTIVIDAD.md).
> 01 añade tipo/constraint de archivo opcional exclusivo para el modo vacío y
> bloqueo transaccional SHARE NOWAIT de fuentes; 03 verifica ese contrato.
> Sin nueva RPC pública ni cambios en 06/Power BI, Programación, Export o PDT.
> Continúa como instalación fresca sin aplicar; las versiones previas se conservan.

# LP — instalación y recuperación propuestas

No ejecutar este plan sin autorización expresa. Ningún SQL de esta carpeta se
aplicó en Supabase. Las pruebas usan contenedores nuevos con datos sintéticos,
sin red ni puertos publicados. No se creó copia ni respaldo de una base productiva.

## Continuación operativa desde 8defa34 — todavía no ejecutar

[SALE, continuidad y contención](SALE_CONTINUIDAD_CONTENCION.md) actualiza 01/02/03 y
la admisión común de 06. Pruebas nuevas/afectadas en aislamiento; el adaptador XLSX
no cambia. Esta sección sustituye las brechas de drenaje/SALE/antigüedad indicadas
en el diagnóstico histórico; no certifica operación productiva.

## Revisión histórica del 02/11/2026 — todavía no ejecutar

Referencia de código/SQL: c5178d8. La revisión actual es de lectura y preparación;
no vuelve a ejecutar las pruebas aisladas anteriores ni certifica datos de planta.
Ver [contratos, permisos reales y decisiones pendientes](CIERRE_BLOQUEOS_PRODUCTIVOS.md).

| Control previo | Estado observado / condición para avanzar |
|---|---|
| Instalación LP | El esquema privado no existe en Supabase según SELECT del 02/11. No hay configuración LP productiva que se pueda «encender» ahora |
| Power BI | Archivos recibidos y adaptador XLSX v1 implementado; comparación por producción aprobada. Pendientes servicio/SQL y despliegue autorizados, correspondencia real y variantes no observadas. No activar CSV QA |
| PDT / Export | Existen datos upstream; faltan liberación neta/asociación de partes, compensación e inclusión verificable de avances por corte |
| Responsables | No hay cuentas activas con rol LIDER/LIDER LINEA. Faltan ámbitos reales por línea/etapa/producción y responsable con cobertura completa del cierre |
| Arrastre / SALE | Inicialización inequívoca persistida y siguiente período validado al ABRIR. Capacidad/repartos requieren decisiones explícitas; apertura desatendida y conciliación de cadena pendientes |
| Recuperación | Verificar punto de recuperación existente, responsables y contención de comandos en vuelo antes de considerar activación |

Estos controles son requisitos de preparación; no conceden acceso ni autorización
de instalación. No se revisa ni corrige datos históricos para hacerlos pasar.

Continuación del mismo día: [Power BI XLSX v1](POWER_BI_XLSX_V1.md) añade propuesta
06 y fuente de servicio Edge; solo código versionado, sin aplicar ni desplegar.
01 actualizado sigue siendo instalación fresca y añade original binario/versión;
no se presupone que pueda actualizar por sí solo un esquema ya instalado.

## Preparación previa a una autorización

1. Revisar los SQL y contrastar nuevamente firmas, hashes, columnas, FK, propietarios,
   ACL y RLS mediante SELECT. La evidencia del 01/11/2026 no autoriza cambios futuros.
   Verificar que no se haya instalado entretanto otro motor que duplique contratos.
   La lectura dirigida del 02/11 conserva esa separación: se inspeccionaron cuerpos,
   metadatos, agregados de roles/accesos y horarios; no se invocaron las RPC de negocio.
   Los controles de 01 verifican existencia/columnas y huella de sesión, no certifican
   los futuros puentes ni el formato Power BI. Preparar un candidato revisado cuando
   esos desarrollos estén completos; no tratar el SQL c5178d8 como instalador final.
2. Aplicar la definición aprobada de Power BI por producción (últimos avances de
   asignaciones LP del período), revisar el adaptador nativo y las variantes no
   observadas, evidencias de inclusión Export/liberaciones PDT y ámbitos de responsables.
   No activar CSV-v1 solo porque
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
   Para el candidato XLSX, el orden revisado es **01 actualizado → 06 → 03**.
   06 habilita EXECUTE de la importación solo al servidor, pero exige igualmente
   sesión y ámbitos SGP completos; el cliente no recibe la credencial técnica.
   Configuración y código de Edge Functions requieren otra autorización antes de
   desplegar/configurar secretos/orígenes. `verify_jwt=false` corresponde a la
   sesión SGP propia, validada por SQL; no permite escribir sin esa sesión.
3. Autorizar `04_vidrio_REVIEW.sql` si se aprueba esa corrección compatible. Es otra
   transacción atómica con hash de función origen; no cambia permisos ni datos.
4. Cargar ámbitos aprobados y conectar puentes certificados mediante una propuesta
   revisada. Es DML/configuración productiva y requiere autorización, no se suministra
   un UPDATE general ni se inventan usuarios/producciones. Habilitar solo después de
   confirmar contratos reales y aprobar por separado el cambio de configuración.
   Validar también los accesos de ventana efectivos, las suplencias y la cobertura
   completa del firmante. Las entradas por rol de `sgp_rol_accesos` no sustituyen
   los overrides efectivos ni los ámbitos privados LP. No crear líderes ficticios,
   copiar ámbitos de Mecanizado ni asignar todas las producciones por defecto.
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
  **Contención revisada:** 01/06 toman bloqueo compartido de config antes de sus
  mutex; 02 obtiene el exclusivo, espera escritores y el trigger invalida revisiones
  de turno. Tras COMMIT no queda un escritor LP admitido pendiente de confirmar.
  Si vence lock_timeout, se revierte y no se declara contenido. Un comando en red
  aún no admitido verá flag/revisión vigente. Lecturas y recibos de commit siguen
  disponibles. Probado con transacciones PostgreSQL reales bloqueadas, también XLSX;
  no se matan sesiones ni se promete controlar escritores externos al protocolo LP.
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
| UPDATE con WHERE en 01 | Al cambiar el flag, el trigger invalida revisión de todos los turnos LP con WHERE etapa IN(ENSAMBLE,EMPAQUE), una vez drenados los escritores. En comandos: turno exacto por línea/etapa/fecha/turno; orden exacta además por producción/parte; liberación exacta por UUID. Registra estado, SALE, acumulado, afectaciones, revisión u origen de consumo dentro del comando autorizado. No actualiza `public.sgp_producciones`, Programación, Picking o Mecanizado. |
| UPDATE con WHERE en 02 | Una fila `config WHERE id=true`; deshabilita escrituras como contención autorizada. |
| CREATE OR REPLACE en 04/05 | Solo el cuerpo de `public.sgp_detalle_ubicacion_vidrio(text,text)`, con hash previo; preserva identidad, firma y ACL. 05 restaura el cuerpo capturado. |
| REVOKE/GRANT en 01 | Esquema/tablas/funciones nuevas: deniega acceso directo; EXECUTE en las fachadas de consulta/comando y el recibo de lectura, con sesión, ámbito y actor cuando corresponde. No desactiva RLS ni amplía privilegios de tablas productivas. |
| REVOKE/GRANT en 06 | Importación XLSX solo servidor `service_role`, con token/rol/ámbito SGP obligatorios; recuperación del original mediante fachada de lectura con ámbito. Sin GRANT directo de tablas ni roles de aplicación nuevos. |
| INSERT/UPDATE en 06 | Archivos y auditoría nuevos; revisión del turno exacto con WHERE línea/etapa/fecha/turno. No escribe Programación, Producción oficial, Mecanizado o Picking. Sin DROP, DELETE, TRUNCATE ni UPDATE sin WHERE. |

Las pruebas aisladas sí crean tablas/roles/datos sintéticos y actualizan sesiones,
ámbitos y fuentes de QA. Sus comandos no apuntan a Supabase; no son pasos de
instalación ni evidencia de modificaciones productivas.

## Operaciones que requieren autorización explícita

- Aplicar 01, 06 o 04 en Supabase y cualquier ajuste de DDL/permisos/propietarios.
- Escribir ámbitos reales, activar escrituras/adaptador real o instalar puentes.
- Crear/restaurar respaldos, aplicar contención 02 o restauración de función 05.
- Cualquier avance, afectación, cierre, reapertura o prueba con datos productivos.
- Conciliar históricos o cambiar presupuestos, arrastres o inclusión Export.
- Fusionar #183, publicar, ejecutar publish o desplegar Firebase.

No se solicita ninguna de esas operaciones en esta entrega.
