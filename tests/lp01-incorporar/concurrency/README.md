# PostgreSQL17 multisesión: INCORPORAR

Preparado para CI. **NO EJECUTADO aquí:** no hay ejecutable Docker ni PostgreSQL17.
`result-postgres17.json` registra NOT_RUN, sin afirmar aprobación de concurrencia.
Python compila y la fixture/instalador se compilaron en PGlite18.6; esto solo valida
la preparación, no reemplaza los casos de concurrencia en PostgreSQL17.

## Ejecución

En un executor con Docker local disponible:

1. `docker pull postgres:17.11`
2. `python tests/lp01-incorporar/concurrency/postgres17.py`

Solo Python estándar; no psycopg ni credenciales. El script crea un contenedor
PostgreSQL17.11 efímero, `--network none`, sin puertos ni montajes, acceso exclusivamente
por `docker exec` y socket interno. Fija Docker al socket local e ignora contextos
remotos/variables PG. No acepta URL de base, parámetros de host ni Supabase.
La limpieza se ejecuta dentro de `__enter__` si falla el arranque, la comprobación
SQL o la fixture, y desde `__exit__` al salir del cuerpo. Es idempotente. Si el propio
comando de limpieza falla, el informe conserva el error original y registra el fallo
de limpieza en `cleanupNotes`; no afirma que el contenedor se haya eliminado.
El servidor nunca se publica.

La fixture usa usuarios, tokens QA y producciones sintéticos, más las definiciones
reales ya capturadas de sesión/roles/ámbitos/comando/planificador. No consulta ninguna
base remota. Instala el candidato exacto con flagfalse y lo habilita exclusivamente
dentro de la plantilla sintética; cada caso clona esa base local aislada.

`build-fixture.py` vuelve a generar la fixture desde el setup de las pruebas previas,
sin reescribir cuerpos. Los tres cuerpos adicionales del planificador están en
`concurrency/production-readonly/`, sin modificar el paquete INCORPORAR previo.
Fixture y manifiesto quedan versionados. CI regenera y exige
diff vacío; una actualización exige revisión y nuevos pins explícitos.

## Casos focales

1. Dos INCORPORAR de keys diferentes con misma revisión, admitidos y esperando el
   mutex de línea: una sola confirmación, la otra conflicto CAS, sin efectos parciales.
2. Dos peticiones idénticas concurrentes: una asignación, una auditoría y mismo recibo.
3. El `sgp_linea_plan_programar` real retiene transacción de escritura: INCORPORAR
   rechaza por NOWAIT sin efectos; después del rollback del planificador, el retry sirve.
4. El `sgp_linea_plan_mover` real hace lo mismo con movimiento/división sintéticos.
5. Revocación nativa confirmada mientras petición espera antes de la admisión:
   la petición se rechaza después de esperar y no deja efectos parciales.
6. Revocación después de admisión: espera el bloqueo de autorización; la operación
   admitida puede completar, pero la siguiente queda denegada. No se promete cancelar
   instantáneamente una operación ya admitida.
7. Flagfalse confirmado mientras petición espera admisión: rechazo sin efectos.
8. Flagfalse después de admisión: drena operación anterior, niega nuevas y conserva recibo.
9. Fallo sintético en auditoría final: revierte raíz, orden LP y revisión conjuntamente.

Se sincronizan esperas comprobando `pg_blocking_pids` y application_name en la base
sintética, no mediante sleeps arbitrarios como prueba. Todas las consultas de prueba
llevan timeout. El informe guarda estados/recuentos de casos, no filas operativas.

## Job CI preparado, no publicado

`.github/workflows/lp01-incorporar-concurrency.yml` usa Ubuntu24.04, Docker y Python3.12.
Solo PR con rutas pertinentes o disparo manual; nunca pushmain, pull_request_target,
secrets, environments productivos, Supabase, Firebase ni despliegue. Checkout no
persiste credenciales. El artefacto es el resultado sintético JSON.

Crear este archivo local no crea un job remoto ni ejecuta CI. Tras autorización de
publicación, integrar el archivo y comprobar el run correspondiente al SHA final.
El bloqueo de concurrencia solo se levanta si ese run concluye PASS y se revisan
los casos; no por la existencia del workflow ni por las pruebas previas WASM.

## Verificación de limpieza sin Docker

`python -B tests/lp01-incorporar/concurrency/test-container-cleanup.py`

Siete pruebas con procesos y SQL simulados verifican timeout de preparación,
versión incorrecta, fallo SQL, fallo parcial de arranque, limpieza fallida,
limpieza idempotente y error en el cuerpo. No ejecutan Docker ni validan
PostgreSQL17 o concurrencia. El job las ejecuta antes de iniciar la base sintética.

## Integración incremental

Copiar solo los archivos enumerados en `delivery-concurrency-manifest.json` más
ese mismo manifiesto. No copiar `__pycache__`, paquetes previos, `node_modules`,
ni archivos de producción. El paquete depende del catálogo y la propuesta
INCORPORAR ya integrados, sin sobrescribirlos. Los hashes son SHA-256.
