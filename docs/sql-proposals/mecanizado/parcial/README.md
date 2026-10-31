# Programación parcial por producción — alternativa A aprobada

**Estado:** implementación en rama; SQL REVIEW, no aplicado a Supabase. No fusión,
Firebase ni verificación productiva. Base `main` observada: `3389d98db9eec003b6bbf662bb81bc8eb3f964a5`.
Rama independiente: `feat/mecanizado-programacion-parcial`. Alcance: SGP-ONE-LAB.

## Diagnóstico y contraste real

El 30/10/2026 se consultó exclusivamente el catálogo de `ocvxbwzqxbrfndkvjmfx`
(SGP-ONE-LAB, PostgreSQL 17.11) mediante Supabase MCP en transacciones READ ONLY.
Se capturaron firmas, cuerpos, ACL, columnas, restricciones y triggers relacionados.
Las fixtures `tests/mecanizado-parcial/catalog*.json` contienen definiciones y
metadatos, **ninguna fila operativa, usuario real, sesión o credencial**.

El formulario fijaba `readOnly` en la cantidad por orden; `sgp_mecanizado_programar`
exigía igualdad con la composición completa. La cobertura consideraba completa la
producción al encontrar su `key_produccion`. Los lectores de detalle, arrastre,
Picking y Recepción devolvían `sgp_producciones.cantidad`, lo que repetiría 288 por
cada parte. El arrastre deduplicaba por reserva/producción. Ensamble utilizaba el
último estado por nombre de producción, que podía anticipar el cierre global.

La identidad actual es `ID|ID_LINEA` y las cantidades son agregadas. Las fuentes
PANEL son piezas, no ventanas individualizadas. Se implementa la alternativa A
aprobada expresamente por el usuario; no se crean ventanas individuales.

## Datos y contratos

Se reutilizan `sgp_mecanizado_programacion`, su detalle, ejecución e historial.
Cada parte nueva tiene una cabecera, un detalle cuantitativo y un número persistido
en el esquema privado `sgp_mecanizado_parcial`. La PK sigue siendo
`id_programacion`; `key_produccion + numero` es único. La producción original no
se divide ni se actualiza al programar. Las cancelaciones conservan identidad y
no reutilizan números. El número se asigna bajo bloqueo de producción.

Tablas privadas adicionales: `partes`, `solicitudes` (idempotencia con usuario y
payload), `movimientos` (antes/después), `entregas` (ventanas explícitas por evento)
y definiciones de funciones para reversión. La continuación no crea copias ni respaldos de bases. Todas tienen RLS; no se concede acceso
directo a anon/authenticated. No se altera el RLS ni los grants de tablas existentes.

RPC nuevas:

| RPC | Contrato |
| --- | --- |
| `sgp_mecanizado_partes_consultar(token,key)` | Original, asignada global, disponible, capacidad vigente, partes/estados/cantidades |
| `sgp_mecanizado_partes_programar(token,key,reserva,partes,clave)` | Propuesta atómica, 1–100 filas con cantidad/fecha/turno/prioridad/observaciones; UUID idempotente |
| `sgp_mecanizado_parte_mover(token,id,fecha,turno,prioridad,motivo,cancelar)` | Reprogramación sobre el mismo ID; cancelación solo sin avance/entregas |
| `sgp_mecanizado_parte_historial(token,id)` | Historial de la parte |
| `sgp_mecanizado_partes_resumen(token,desde,hasta)` | Cantidades por turno: asignadas, procesadas, pendientes y entregadas validadas |

`sgp_mecanizado_es_parte(uuid)` es un predicado mínimo para triggers invoker:
solo revela pertenencia, sin cantidades ni datos operativos. Permite rechazar
escrituras directas de partes sin afectar la ruta histórica de escritura.

**Saldo:** cantidad original menos asignación activa por clave, considerando todas
las reservas y excluyendo orígenes históricos transferidos. La programación toma
lock de fila de producción y advisory transaccional compartido con la protección
del detalle. El guard histórico también toma el mismo advisory: una carrera entre
la RPC antigua y la nueva no sobreprograma. Una cabecera histórica sin detalle
inequívoco bloquea la nueva asignación hasta reconciliarla. No se infieren órdenes
por diferencia. Export no puede bajar el total por debajo de lo asignado ni cambiar
la identidad de una producción que ya tiene partes.

**Capacidad:** se consulta primero `sgp_capacidad_sistema` activa para el sistema y
después `sgp_capacidad_linea`, proceso MECANIZADO. El catálogo vivo tenía 90 para
PANELES 2 y 40 para FRAMES 2, sin overrides por sistema. No se codifica 90 en la
división. La programación nueva conserva el alcance actual PANELES_2.

## Dependencias e integración

| Consumidor | Cambio y garantía |
| --- | --- |
| Programación | Cobertura cuantitativa para claves con partes; históricos conservan su rama original; original/programada/saldo, propuesta editable, consulta de partes incluso con saldo cero |
| Producción | Cantidad de cada parte y distintivo estable; guardado por RPC con sesión; ejecución general sincronizada con la de la parte |
| Mecanizado | Arrastre independiente por parte en SQL y JS; sin deduplicar P2/P3 por compartir producción; traslado conserva cabecera y número |
| Picking | Cola restringida a la clave de la parte; campo explícito `cantidad_ventanas` en contexto V4; ledger transaccional evita sobreentregas concurrentes e idempotencia evita duplicados |
| Recepción | Muestra ventanas del movimiento, clave y P1/P2 estables; separa partes de la misma prioridad. La auditoría queda limitada a sus PDT de origen |
| Informes | Producciones únicas por clave para partes; cantidades previstas una vez por parte y entregadas por evento, sin restar piezas PANEL como si fueran ventanas |
| Ensamble/Empaque | `sgp_consultar_ensamble` consolida estados de partes: P1 procesada no produce PROCESADO global; solo se alcanza al cubrir la cantidad original procesada. No se añaden flujos de Ensamble/Empaque |
| Aluminio/PDT | Fuentes PANEL reales por clave y reservas principal/asociadas; ciclos V4 y de auditoría, simples y agrupados, validados y cerrados con evidencia de reposición de la misma parte |

Picking distingue cantidad **registrada** de cantidad **validada**. Una entrega con
faltantes sigue por el flujo PDT existente. Las fuentes PANEL se consultan como
referencia de la producción completa, sin atribuirlas automáticamente a P1/P2.
Una reposición puede registrar **0 ventanas nuevas** si existe un PDT procesado de
la misma parte. Así, 90 ventanas registradas no cierran el material pendiente ni
bloquean su reposición. El evento incompleto de origen no acredita su propia falta;
una entrega de P2 tampoco acredita un PDT originado en P1. Las funciones de entrega,
asignación y cierre mantienen sus locks, idempotencia y condiciones de cobertura.

La continuación del PR #168 sustituye todos los stubs de PDT y reservas compartidas.
`catalog-pdt-real.json` contiene únicamente definiciones del catálogo implicado,
consultadas en READ ONLY. La base QA se crea vacía y recibe filas sintéticas: no se
copian datos operativos ni se usa un respaldo o restauración de Supabase. Se
reutilizan los cuerpos reales, restricciones, índices, triggers, ACL y la vista real
de reservas. No se reemplaza el validador, el origen PANEL, el escritor V4, los
avances ni el cierre por funciones de fixture.

Defectos encontrados y corregidos: fuentes con acabado asociado omitido; entrada
de una clave homónima por coincidencia de nombre; auditoría que marcaba otros PDT
con la misma pieza; reposición de material sumando ventanas de nuevo; cierre con
evidencia de otra parte; Recepción/Ensamble y avance físico ambiguos por nombres
repetidos. La ruta sin partes conserva su comportamiento histórico y tiene un
ciclo V4 completo de regresión.

La interfaz reutiliza el sistema azul SGP y el diálogo de programación como
referencia principal; guía Refero `craft-details` para campos, foco, scroll y
acciones. No se rediseñan otras pantallas. Fechas/turnos quedan explícitos por fila;
guardar 90 no asigna el resto. Al actualizar la programación se conservan filtros,
scroll y expansión. Consulta no dispone de controles de escritura; el backend
valida permisos por sesión, incluidos intentos directos contra RPC.

## Evidencia y reproducción

Ver [tests/mecanizado-parcial](../../../../tests/mecanizado-parcial/).
Las pruebas usan PostgreSQL 17.11 Docker `--network none`, datos sintéticos,
función real capturada de sesión/roles y cuentas QA creadas solo en la fixture.
No emplean `service_role`. Chromium verifica 1366×1000 y 390×844 mediante una
fachada RPC local que ejecuta las funciones SQL reales; no se conecta a Supabase.

```bash
python scripts/build-mecanizado-parcial.py
node tests/mecanizado-partes.test.mjs
docker run -d --name sgp-parcial-test --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17.11
python tests/mecanizado-parcial/integration.py
python tests/mecanizado-parcial/browser.py
npm test
npm run verify:release
docker rm -f sgp-parcial-test
```

Los resultados JSON y capturas están versionados; la nueva CI repite integración,
concurrencia, reversión y navegador sin secretos ni acceso productivo. Para
Chromium local puede usarse `PLAYWRIGHT_CHROMIUM_EXECUTABLE`; en CI se instala con
Playwright. El reporte final indica los conteos efectivamente obtenidos.

**Resultado de integración: 63/63 escenarios SQL aprobados**, incluidos funciones
reales con PANEL/NC, fuentes agrupadas, auditoría, validación, avances, entrega,
asignación y cierre, concurrencia e idempotencia. `real-function-evidence.json`
comprueba huellas idénticas para 19 funciones núcleo y la vista de reservas.
`physical-report-evidence.json` verifica el informe JavaScript con contratos SQL:
90 procesadas / 288 originales y saldo 198, incluso con una clave homónima.

**Límites de certificación:** los registros, sesiones y roles son sintéticos y usan
el validador y permisos RPC reales. Los DTO de recepción física del informe de
avance son entradas QA explícitas; no prueban llegada de material a planta.
El navegador utiliza una fachada RPC local; no certifica PostgREST/Auth gestionado,
conectividad corporativa, usuarios operativos ni un teléfono físico. Esos escenarios
no se declaran aprobados en producción. No quedan stubs para el comportamiento de
PDT/reservas que las pruebas de integración certifican.

## Operaciones fuera de esta continuación

No se autorizan copias o respaldos de bases, aplicación de migraciones en Supabase,
fusión ni despliegue. La migración sigue siendo un artefacto REVIEW; únicamente se
ensaya su SQL en bases vacías de datos sintéticos, sin historial de migración de
Supabase. Un eventual despliegue requiere otra autorización y un plan específico.
Los guards de catálogo, coherencia de cantidades y reversión no deben forzarse.

## Reversión

Antes de commit, cualquier error revierte la transacción entera. Después de
instalar **sin partes nuevas**, `ROLLBACK_REVIEW.sql` verifica ausencia de datos y
drift de funciones, restaura cuerpos originales con sus ACL preservadas y elimina
solo objetos nuevos. Está probado en PostgreSQL aislado.

Después de utilizar partes, el rollback destructivo queda bloqueado: conservar
identidades, cantidades, entregas e historial y preparar corrección forward.
Volver a la interfaz anterior tampoco es seguro con partes activas porque sus
lectores antiguos cuentan órdenes completas. No restaurar un backup sobre
operaciones posteriores sin preservarlas y reconciliarlas.

No hay decisiones funcionales nuevas pendientes. Aplicar SQL, fusionar y publicar
siguen fuera de la autorización de esta entrega.
