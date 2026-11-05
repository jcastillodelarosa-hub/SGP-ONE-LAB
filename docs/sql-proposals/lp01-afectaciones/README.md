# LAB v382 · afectaciones por orden y PDT

**IMPLEMENTADO EN RAMA / VERIFICADO EN POSTGRESQL AISLADO Y NAVEGADOR.**
No aplicado en Supabase, no publicado ni certificado con datos de planta.
Misma entrega v382 aún sin publicar, frente a main v381.

## Resultado

Registro individual por causa y producción, con etapa, autor y fecha/turno originales.
Correcciones y soluciones parciales conservan auditoría; la confirmación física de
ventanas es distinta de solución en origen. No se suma automáticamente el solapamiento.
El coordinador valida las ventanas distintas afectadas; un cambio invalida el
consolidado. Arrastrar al siguiente turno no inserta otra afectación.

El panel se integra en **Seguimiento → detalle → Afectaciones** y en
**Operación → Afectaciones individuales y pendientes de Picking**. Reutiliza el
selector real de Picking para referencia, fabricación, longitud, acabado y reserva,
pero mantiene origen ENSAMBLE/EMPAQUE y reglas NC de V4. Cantidad de piezas y cantidad
de ventanas son entradas independientes. Los controles anteriores por turno se
conservan para compatibilidad y se deshabilitan en la vista cuando la nueva consulta
acredita escritura individual. Un cambio legacy por otro cliente invalida conciliación.

Pendientes originales de Picking se consultan por **key exacta**, con ID, contrato,
origen, referencia, fabricación, longitud, estado, reserva, cantidad de piezas y
fecha originales. Verlos no inserta nada ni concede disponibilidad. El usuario puede
seleccionar un pendiente original acreditado: crea su relación LP sin otro PDT.
Los ya asociados se muestran, pero no pueden registrarse de nuevo.

## Contratos y transacciones

Orden de propuestas, NO autorización de instalación:

1. `01_storage_DRAFT.sql`: almacenamiento privado con RLS, cantidades e identidades.
2. `02_rpc_REVIEW.sql`: lectura y comandos individuales, guardas LP existentes.
3. `03_pdt_atomico_REVIEW.sql`: escritor PDT+LP y consulta enriquecida v2.
4. `04_conciliacion_REVIEW.sql`: conciliación explícita y permisos físicos restringidos.
5. `05_picking_original_REVIEW.sql`: asociación del Picking original sin duplicarlo.

La escritura atómica llama a `public.sgp_pdt_registrar_v4` dentro de la misma
transacción, con su actor, fuentes, NC, guards de identidad y ledger originales.
Verifica los IDs devueltos y su producción/origen/evento, crea el reporte LP y
vínculos únicos. Un fallo de LP o del recibo final revierte también PDT. Nunca se
encadenan dos escrituras frontend. Se fijan hashes de las funciones nativas revisadas;
un cuerpo incompatible detiene la instalación. No se reescriben funciones PDT.

UUID estable más contenido/actor/ámbito exactos impide reutilización ambigua.
Bloqueos de recibo (incluido el nativo), etapa y producción, CAS y revalidación de
sesión serializan carreras. La misma solicitud concurrente crea una sola operación;
dos revisiones iguales distintas dejan una ganadora y la otra revierte íntegra.
Fuente única `(contrato,id)` evita duplicar el bloqueo al volver a asociar un PDT.
La relación no convierte piezas en ventanas ni cambia movimientos/estados físicos PDT.

## Permisos y controles conservados

Sesión, accesos individuales, etapa, guard temporal y admisión LP existentes siguen
siendo autoridad. Sin service-role frontend, nuevas equivalencias ni cambios a roles.
RLS y revocaciones en tablas/helpers; las RPC nuevas quedan **sin EXECUTE público**.
`writes=false`, `physical=false`, `pdt_links=false`, `atomic_pdt=false` al instalar.
No se proporciona activación productiva automática. Turno abierto requerido al escribir.

| Acción | Alcance preparado |
|---|---|
| Reporte genérico/corrección | Roles autorizados por AFECTAR en su etapa vigente |
| Nuevo aluminio / original Picking | Intersección AFECTAR LP y actor nativo PDT; LIDER LINEA, COORDINADOR y ADMINISTRADOR cuando ambos contratos autorizan |
| Consulta Picking | Roles nativos de lectura PDT y acceso LP a producción/etapa; Seguimiento sigue coordinador/administrador |
| Confirmación física | LIDER LINEA o COORDINADOR, con AFECTAR vigente y gate físico habilitado; supervisor y administrador no reciben esta acción |
| Consolidado/conciliación | Solo COORDINADOR con VALIDAR vigente |

SUPERVISOR ENSAMBLE/EMPAQUE no figura en el actor PDT V4 ni en la lectura nativa de
metadatos: interfaz muestra consulta no autorizada y bloquea aluminio; no suplanta
al líder ni usa token del coordinador. Puede continuar acciones genéricas autorizadas.
Ampliar ese acceso sería una decisión funcional y de permisos aparte, no un requisito
para que líder/coordinador operen con sus permisos existentes.

## Conciliación histórica y apertura

El coordinador recibe los snapshots legacy actuales (último por parte), fingerprint
y revisión; relaciona explícitamente cada ocurrencia con reportes existentes de
misma producción/etapa/causa y registra evidencia. La unión legacy también requiere
cobertura. Se validan cardinalidad, referencias, cantidades y totalidad de fuentes.
No se crean reportes desde los números legacy, no se suman turnos/partes ni se
reescriben fechas o snapshots. El cotejo y sus fuentes quedan inmutables, con
idempotencia; cambio de cantidad/identidad del reporte o de fuente invalida el cotejo.
Sin relación demostrable, se mantiene bloqueada la consolidación, no se inventa.

El historial compartido solo incluye etapas actualmente autorizadas. La proyección
de EJECUTAR conserva cantidad, estado anterior, parte, día, turno, autor y correcciones.
Ensamble y Empaque abren desde su primer avance positivo **acreditado**. Sin cobertura
histórica completa desde origen, fecha no disponible; ninguna programación, carga
Export o arrastre sustituye esa evidencia. No hay RPC de navegador para inventar
cobertura histórica. Corrección posterior o cambio de turno no reinicia la fecha.

Disponible no modifica SALE. Requiere consolidado vigente, saldo vigente, cotejo
legacy válido y pendientes originales Picking cubiertos en el ámbito. No se deduce
una liberación por cerrar un PDT, por su cantidad de piezas o por solo consultarlo.

## Evidencia reproducible

PostgreSQL17.11 Docker efímero, `--network none`, datos exclusivamente sintéticos.
Imagen `postgres:17.11`, digest
`sha256:3b0cda93be7c8dba2ed484d19393d93845dc3dafb88973e248ba8e6d99d784e1`.
La fixture combina la sesión/matriz LP capturada con cuerpos PDT nativos revisados,
sin alterar sus guards. La dependencia histórica `sgp_picking_piezas_panel` usa la
fixture documentada del repositorio; no se afirma certificación de su cuerpo en planta.

- `postgres.py` / `result.json`: almacenamiento/RPC, fallos atómicos, roles, revocación,
  carreras, snapshots, historial y cobertura de apertura, fuentes no acreditadas.
- `atomic.py` / `atomic-result.json`: fuentes y escritor V4 nativos, NC/fabricación/
  longitud incorrectas, PDT2 piezas frente a LP5 ventanas, reintentos y carreras,
  rollback final completo, Picking original visible/asociado sin duplicación,
  conciliación, restricciones físicas y cantidades modificadas.
- `native-browser.py` / `native-browser-result.json`: panel y fuente/escritor nativos
  en PC1440/móvil390; nuevo PDT, original Picking, solución, físico, cotejo y unión.
- `native-app.py` / `native-app-result.json`: **pantallas/controladores existentes**,
  coordinador en Seguimiento y líder en Operación, PC/móvil, fuente original visible,
  borrador conservado durante polling y limpieza por revocación.
- `tests/lp01-tracking-ui/browser.py`: regresión de menús, Semana/saldo, tres ciclos20s,
  filtros/foco/scroll/panel y ámbito/sesión/rol.
- `npm test`: 481/481 PASS. `npm run verify:release`: versión v382 PASS.

No se utilizan destinos productivos ni se consulta una sesión real de planta.

## Límites pendientes antes de una publicación segura

- Contrastar dependencias instaladas con los hashes y preparar revisión/activación,
  inventario, respaldo/recuperación y gates existentes; sin cambiar pins por conveniencia.
- Pendientes LEGACY/manuales sin identidad nativa V4: visibles si autorizados, pero su
  adopción automática falla cerrada. Requieren evidencia/adaptador propio, sin inferir.
- Un mismo PDT no puede generar reportes duplicados por etapas. Si ya está vinculado
  a otra etapa y falta evidencia de disponibilidad en la actual, esta entrega no
  concede crédito ni permite duplicarlo. Hace falta un contrato explícito de alcance
  entre etapas para resolver ese caso; el historial de la producción permanece visible.
- El cotejo exige una relación completa demostrable. No resuelve automáticamente
  relaciones parciales ambiguas ni cantidades históricas contradictorias.
- Seguimiento permite consulta sin asignación; para escribir, la interfaz actual usa
  un contexto operativo existente seleccionado. No crea asignaciones ni abre turnos.
- Sin evidencia acreditada de inicio anterior, apertura sigue no disponible.

Recuperación: antes de nuevos eventos, contener/deshabilitar el paquete y retirar
solo objetos nuevos vacíos bajo procedimiento revisado. Después de eventos, contener
escrituras y corregir hacia delante; no DROP ni restauración destructiva de datos.

Revisión posterior y bloqueos de activación: [plan y evidencia actual](ACTIVACION_REVISION.md).
