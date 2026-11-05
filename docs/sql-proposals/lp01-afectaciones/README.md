# Afectaciones individuales · contrato en preparación LAB v382

**IMPLEMENTADO Y VERIFICADO EN AISLAMIENTO:** almacenamiento, RPC transaccionales,
transporte y panel, PostgreSQL17.11 con datos sintéticos y pruebas PC/móvil.
**NO PUBLICADO / SIN ACTIVACIÓN:** faltan adaptadores PDT, certificación física y
procedimiento de conciliación/cobertura. Las nuevas RPC no tienen grants públicos.
No cambiar producción ni instalar 01_storage_DRAFT.sql aisladamente.

## Contrato verificable

`src/server/lp01-affectations-contract.js` implementa CREATE, CORRECT (total), SOLVE
(incremento), CONFIRM (incremento) y VALIDATE (unión de ventanas distintas).
Cada comando lleva UUID estable, revisión esperada y observación. Reintentar el
mismo UUID devuelve sin otro evento; distinto actor/contenido se rechaza.
La autorización se comprueba antes incluso de un reintento. La autoridad de sesión,
producción, línea, etapa, saldo Export y fecha/turno provienen del servidor.
La función pura no autentica tokens ni persiste: NO es un backend de producción.
El fixture importa el modelo para demostrarlo en memoria, nunca como autorización.

Reporte conserva identidad, autor/fecha/turno/etapa originales; no hay comando de
arrastre porque leerlo en otro turno no crea otra fila. Eventos retienen autor,
contexto y cantidad. Corrección no borra eventos ni reduce bajo cantidades ya
solucionadas/confirmadas. Solución no equivale a recepción física. Consolidado
coordinador entre mayor pendiente individual y suma de pendientes es un chequeo
de consistencia; jamás una estimación automática. Se invalida con cada cambio o
cambio de saldo. No actualiza SALE ni crea liberaciones de SQL07.

## Adaptación requerida antes de RPC

- Usar `sgp_lp_operacion.sesion` y accesos vigentes, revalidar dentro del bloqueo por
  producción/etapa; derivar línea desde producción. No confiar rol/capacidad del cliente.
- Líder y coordinador registran/corrigen según etapa autorizada; consolidado solo
  coordinador. Mapear SOLVE/CONFIRM a permisos reales antes de exponerlos. En demo
  se conceden explícitamente, sin ampliar la matriz productiva.
- Transacción única: sesión, lock, recibo idempotente, CAS, cambio, evento inmutable,
  invalidación consolidado y respuesta; fallo revierte todo. No emular CAS con dos RPC.
- Crear lector compartido por producción, conservando etapa y ámbitos autorizados;
  panel actual demuestra una etapa. No duplicar filas para compartir el historial.
- Picking/PDT: fuentes verificadas por `registrationSources`/`manualSources`, registro
  con sus servicios existentes; origen fijado por etapa. Vincular ID real mediante
  adaptador servidor. Tabla fuentes evita duplicar identidad. No usar cantidad de
  piezas como ventanas ni llamar nuevamente registrar PDT al arrastrar.
- Conciliar snapshots antiguos únicamente con evidencia/decisión auditada. No
  sembrar reportes sumando causas, partes o turnos. Sin backfill de fechas.
- RPC lectura/escritura futuras con EXECUTE mínimo, sin acceso directo a tablas;
  no instalar almacenamiento sin todas las pruebas y recuperación.

## Apertura e historial

Johan confirmó primer movimiento de cada proceso, incluido Empaque (05/11). El
proyector `src/domain/lp01-progress-evidence.js` conserva eventos de avance y sus
correcciones, día/turno/etapa/parte. Primer avance positivo solo acredita apertura
si servidor acredita cobertura desde origen y no existe avance anterior en el
primer estado disponible de una parte. Si no, apertura null / No disponible.
Cambio de turno no reinicia fecha. No sumar snapshots ni tratar cero como inicio.
El contrato global actual omite cantidades/antes de auditoría y cobertura; hay que
ampliar su proyección antes de conectar este cálculo. No marcar FROM_ORIGIN por
mera ausencia de eventos más antiguos: requiere fuente de cobertura acreditada.

## Evidencia y siguiente incremento

`node --test tests/lp01-affectations-contract.test.mjs` cubre conflictos, reintentos,
revocación, ámbito, causas solapadas, corrección, recepción parcial y apertura.
`python tests/lp01-affectations-ui/browser.py` demuestra PC/móvil con datos sintéticos.
La UI conserva borrador ante error y UUID al reintentar; no hay polling que lo borre.

SQL y panel ya probados en PostgreSQL aislado, como se detalla abajo. Falta completar
adaptadores y conectar panel operativo+Seguimiento sin eliminar el formulario
vigente hasta certificar compatibilidad. Recuperación previa
a escrituras: retirar nuevos endpoints/DDL vacíos bajo control. Después de eventos:
contener escrituras y corregir hacia delante; jamás DROP ni restaurar datos antiguos.
Documentación de funciones consultada: https://supabase.com/docs/guides/database/functions .
Índice changelog no accesible (web content-type; GET entorno403); no se cambian SDK
ni funciones Supabase nuevas en este incremento.

## Incremento RPC comprobado · 05/11/2026 (prevalece sobre estado inicial)

La falta de binarios locales se resolvió usando el motor Docker disponible:
PostgreSQL17.11 (`postgres:17.11`, digest
`sha256:3b0cda93be7c8dba2ed484d19393d93845dc3dafb88973e248ba8e6d99d784e1`),
contenedores efímeros con `--network none`. Solo esquemas y datos sintéticos.
01_storage_DRAFT + 02_rpc_REVIEW fueron ejecutados en ese entorno; nunca en Supabase.

RPC nuevas `sgp_lp_afectaciones_consultar_v1` y `sgp_lp_afectaciones_comando_v1`:
reutilizan sesión, permisos por etapa y guard temporal LP actuales; comando exige
turno abierto, congela autoridad/configuración, serializa UUID y etapa, bloquea
producción, revalida sesión y aplica CAS. Reporte, auditoría inmutable, consolidado
y respuesta idempotente se confirman juntos. No asignaciones ni aperturas implícitas.
No se alteran RPC vigentes. Instalación comprueba owner y huella de matriz de roles;
RLS y revocaciones en todo almacenamiento privado; EXECUTE público revocado.

Historial compartido combina eventos de la misma producción solo de etapas con
acceso vigente. Un supervisor no recibe la otra etapa; líder autorizado a ambas sí.
`progress` proyecta EJECUTAR real con cantidad, antes, parte, fecha, turno, usuario
y observación. Ambas aperturas permanecen null sin acreditación privada de cobertura
completa desde origen. Se conserva primer avance positivo aunque luego se corrija.
No hay RPC de navegador para falsificar cobertura ni reconstrucción histórica.

Disponible requiere consolidado de coordinador vigente y conciliación acreditada
con las copias legacy actuales. La firma de snapshots y saldo se comprueba al leer;
si cambia cualquiera, no se muestra disponible. No se migra ni suma legacy. La
conciliación está sin habilitar al usuario hasta preparar su procedimiento auditado.

Controles de instalación: `writes=false`, `physical=false`, `pdt_links=false`.
Permisos efectivos de confirmación física siguen pendientes de certificación: la
prueba habilita el gate solo en QA; no constituye autorización de planta. No hay
script de activación productiva. `admitir()` LP también debe permitir escrituras.

### Compatibilidad PDT comprobada en código

El selector compartido `mountPdtRegistration` ahora acepta `selectionStyle:'table'`:
reutiliza la tabla de Picking (fabricación, marca, longitud, acabado, reserva,
referencia) manteniendo origen ENSAMBLE/EMPAQUE y NC obligatoria de V4. Los callers
vigentes mantienen sus defaults. La demo consulta una respuesta sintética de fuentes;
no acredita instalación ni lectura real PDT. Se usa líder de línea, compatible con
roles V4; supervisores LP no figuran en el actor V4 vigente, por lo que NO se les
extiende permiso ni se promete ese registro. Manual tiene contrato distinto.

NC_AL no admite reporte de ventanas suelto: SQL exige fuente PDT acreditada y vínculo
único; el panel bloquea guardar aluminio y permite revisar fabricación/longitud.
El vínculo probado usa una fuente privada sintética de Picking; no existe aún un
emisor nativo acreditado. Ninguna cantidad de pieza se copia a ventanas. La tabla
fuentes impide reutilizar ese PDT para generar otro bloqueo en otra etapa/turno.

Brecha exacta para escritura completa NC_AL: preparar transacción coordinada que
reutilice `sgp_pdt_registrar_v4` y su ledger, valide IDs devueltos/clave/origen, cree
reporte LP y vínculos en la MISMA transacción, con reintento de todo el contenido;
o vincular un PDT existente con evidencia autoritativa de su origen e identidad.
Dos llamadas frontend consecutivas pueden dejar un PDT huérfano si falla LP: no se
implementó ese atajo. Fabricación/longitud no son una identidad global. Arrastrar
un reporte nunca debe volver a llamar registrar PDT. Quedan fuera liberaciones
SALE y deducción automática de ventanas por solución de material.

### Evidencia reproducible

- `python tests/lp01-afectaciones-rpc/postgres.py`: roles reales capturados,
  atomicidad, fallos de auditoría, conflictos y reintentos concurrentes, permisos,
  revocación, arrastre sin clon, historial compartido, proyección de avances y
  apertura con/sin cobertura, vínculo único PDT, sin modificación productiva.
- `python tests/lp01-afectaciones-rpc/browser.py`: panel + transporte validado + RPC
  PostgreSQL reales por túnel local de pruebas; PC/móvil. El único reader PDT es
  sintético y no se llama a ningún escritor PDT. Evidencia en su directorio.
- `src/services/lp01-affectations.js` rechaza respuesta de otro ámbito, cambio de
  sesión en vuelo, apertura inventada y confirmación de comando ajeno. No está
  conectado al controlador productivo, cuyo contrato sigue sin estas RPC.

Pendiente antes de publicar: adaptador atómico PDT, certificación de confirmación
física, procedimiento de conciliación y cobertura histórica, integración controlada
y revisión/activación de permisos y política. Se entrega código comprobado en
PostgreSQL aislado, no sistema completo habilitado ni certificación productiva.

Resultado final de este incremento: 480 JS PASS; matriz PostgreSQL PASS; navegador
RPC PC1440/móvil390 PASS; verify:release LAB v382 PASS. Sin publicación.
