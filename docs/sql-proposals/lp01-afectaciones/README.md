# Afectaciones individuales · contrato en preparación LAB v382

**IMPLEMENTADO EN AISLAMIENTO:** contrato ejecutable JS, panel y pruebas sintéticas.
**PROPUESTO:** almacenamiento SQL, no ejecutado ni validado en PostgreSQL.
**NO INSTALABLE / NO PUBLICADO:** faltan RPC transaccionales y adaptadores reales.
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

Falta probar SQL en PostgreSQL aislado (binarios no disponibles aquí), preparar
RPC/adaptadores con permisos efectivos y conectar panel operativo+Seguimiento sin
eliminar el formulario vigente hasta certificar compatibilidad. Recuperación previa
a escrituras: retirar nuevos endpoints/DDL vacíos bajo control. Después de eventos:
contener escrituras y corregir hacia delante; jamás DROP ni restaurar datos antiguos.
Documentación de funciones consultada: https://supabase.com/docs/guides/database/functions .
Índice changelog no accesible (web content-type; GET entorno403); no se cambian SDK
ni funciones Supabase nuevas en este incremento.
