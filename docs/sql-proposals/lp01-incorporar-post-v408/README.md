# Integración de Incorporar con hoja v408

Candidato contenido para ENSAMBLE/PANELES_2. No activa por sí solo.
Reutiliza SIN COPIAR el escritor01 y recuperación02 de
`../lp01-incorporar-post-export/`. Instalar ese01 y este03 en una única
transacción. El instalador de turno-horario se aplica primero porque comprueba
la guarda original; todas las capacidades nacen false.

Este delta agrega descubrimiento de Incorporar y turno horario a la lectura
existente. Verifica hashes exactos antes/después y conserva cuerpo, prioridad,
reserva, exclusiones y metadata fuera del bloque agregado. Recuperación: contener
ambas capacidades, este04 y el02 del escritor, sin borrar historia.

Pruebas: `node tests/lp01-incorporar/pglite.mjs --post-v408`. Reutiliza SQL
y fixtures ya publicados para construir el lector, sin incluir captura del
servidor ni datos de operación. El escritor no cambió; se conserva evidencia
PG17 post-export existente. Apertura añade prueba concurrente focal independiente.
