# Preparación del cierre de bloqueos productivos — PR #183

**Actualización posterior del mismo día:** el encargo de integración aportó ambos
XLSX y aprobó comparar por producción, sumando las asignaciones LP del turno y
etapa. [Implementación XLSX v1 y evidencias](POWER_BI_XLSX_V1.md). El texto inferior
conserva el diagnóstico de 47a06af; la petición de archivos y la decisión de
granularidad quedan resueltas por ese encargo, no son bloqueos funcionales actuales.
Se mantienen las brechas ajenas a Power BI y las convenciones no observadas.

02/11/2026, America/Bogota. Referencia técnica **c5178d8**; mismo Draft y rama.
Estado: **PREPARACIÓN DOCUMENTAL, NO AUTORIZADO PARA ACTIVAR**. No se modifica
Seguimiento, Operación, sus SQL ni sus reglas en esta entrega. Las 111 pruebas y
la CI de c5178d8 se reutilizan; no se han vuelto a ejecutar.

Fuentes: [Issue #184](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/issues/184),
DOCX aprobado adjunto, bocetos B10–B15, código/SQL de c5178d8 y
[SELECT dirigidos del 02/11](evidence/2026-11-02-cierre-readonly.json).
Los documentos adjuntos son referencia funcional; no conceden permisos productivos.
`main` permanece en bb224f0; el Draft está abierto y su referencia es c5178d8.
No se usa el estado de otro PR para dar por instalado un contrato.

## 1. Power BI: mínimo que debe aportar la fuente real

Se necesitan **dos archivos originales**, uno de Ensamble y otro de Empaque,
para un período completo conocido, con sus encabezados y formato nativos. No se
pide convertirlos al CSV de QA. Si comparten formato, basta indicar cómo cambian
etapa/línea; si cada línea usa formatos distintos, hace falta una muestra por
variante. La ausencia de producción en una etapa no exige inventar filas.

| Dato lógico mínimo | Qué debe contener la muestra o su contexto verificable | Límite |
|---|---|---|
| Etapa | Ensamble o Empaque, en campo o metadato inequívoco del informe | No deducirla de una cantidad o nombre de proyecto |
| Línea | Identificador de origen y equivalencia con PANELES_2 / FRAMES_2 | El módulo actual no habilita las otras líneas del catálogo |
| Fecha operativa y turno | Día al que corresponde la ejecución, turno 1/2 y convención de medianoche | Fecha de descarga no equivale a fecha operativa |
| Corte y versión | Filtros usados, hora/zona del corte y si el archivo sustituye otra exportación | No equiparar hora de importación con corte de la fuente |
| Identidad de producción | ID estable de origen + línea, o clave canónica verificable | `key_produccion = id + '|' + id_linea`; nombre/reserva no bastan |
| Cantidad de la etapa | Ventanas ejecutadas; entero no negativo y significado del acumulado | Separar ventanas de perfiles/piezas, vidrios, m² y porcentajes |
| Granularidad | Una fila por orden, parte, movimiento o total acumulado; identificador de parte si existe | P1 de Mecanizado no es automáticamente el UUID raíz de asignación LP |
| Cobertura | Si incluye ceros, órdenes sin ejecución, anulaciones y totales/subtotales | Ausencia no equivale a cero; subtotal no equivale a otra orden |

Campos recomendados para diagnóstico: sistema, nombre de producción, reserva y
responsable. No sustituyen la identidad. El hash del archivo se calcula en la
integración; el responsable funcional no tiene que producirlo manualmente.

Ejemplos mínimos a identificar **dentro de las muestras reales**, o en un anexo
que conserve sus encabezados y correspondencia:

| Caso | Ejemplo lógico ilustrativo — no es un registro real | Qué resuelve |
|---|---|---|
| Ejecución parcial | Orden A / Paneles / Ensamble / turno elegido: líder 40, Power BI 39 | Diferencia -1, justificación y versión de cierre |
| Granularidad por partes | La misma orden tiene dos asignaciones LP, pero Power BI informa un total de 50 | Decidir comparación consolidada por producción o aportar vínculo a cada parte; no repartir 50 por proporción/prioridad |
| Cero o ausencia | Orden B tiene 0, o no aparece | Confirmar cobertura de la fuente antes de aceptar ausencia como cero |
| Turno nocturno | Una ejecución a las 02:00 del día D+1 pertenece al turno iniciado en D, **si esa es la convención de la fuente** | Evitar cambiar fecha/turno por la hora de descarga |

Si una muestra no contiene alguno de estos casos, basta explicar la regla o
aportar un extracto adicional existente; no crear datos productivos para probarlo.
Duplicados, correcciones y cambio de año deben cubrirse después con datos sintéticos
basados en ese formato. No se reabre la batería de 111 pruebas por recibir archivos.

**Contrato de normalización propuesto, no implementado ni aprobado como formato
nativo:** versión del adaptador, metadatos de etapa/línea/período/corte, hash,
referencia a fila original, identidad canónica y cantidad comparable. Preservar el
archivo original y las reglas de conversión. Si la fuente trae movimientos, solo
se agregan cuando su semántica y anulaciones estén definidas; si trae un acumulado,
no se suman sucesivas exportaciones. Rechazar identidades ambiguas y mezclas de unidad.

El adaptador actual exige CSV con `etapa;fecha;turno;key_produccion;parte;cantidad`,
una fila por cada parte del turno, sin duplicados ni ausentes. No soporta XLSX,
variantes regionales/CSV entrecomillado, subtotales o una sola fila por producción
con varias partes LP. Su límite es 2 MB. **No activarlo con solo cambiar
`formato_bi_aprobado=true`**: falta el adaptador real y, si procede, cambiar la
unidad de comparación del cierre. La regla aprobada exige comparar por orden;
no autoriza inventar el reparto por parte que el CSV QA presupone.

## 2. PDT: datos existentes y contrato que falta

| Existente y comprobado en lectura | Evidencia que falta | Desarrollo pendiente |
|---|---|---|
| `sgp_aluminio_pendientes`: key, reserva principal, contrato, validación, estados y `ventanas_afectadas`; `sgp_picking_faltantes` también conserva ventanas auditadas | Determinar a qué producción/etapa y bloqueo pertenecen esas ventanas, con origen unívoco; una cantidad de piezas no acredita ventanas liberadas | Adaptador por contrato LEGACY/V2/V4/manual, sin duplicar el circuito PDT |
| Líneas de entrega, detalles, cantidades, estado VALIDADA, usuario y fecha; anulación con motivo | Cobertura física suficiente de los materiales necesarios; distinguir registrado, recibido, validado, acreditado y cerrado | Leer el contrato efectivo y su evidencia de cobertura, no reaccionar a cualquier cambio de estado |
| `sgp_pdt_cerrar_v2` despacha manual/no manual; `sgp_pdt_picking_v2` despacha V4/original | El cierre acreditado prueba cobertura Picking de ese PDT, no unión de ventanas disponibles entre varios PDT/NC V/Tecno/Novedad | Consolidación de solapamientos y disponibilidad en ventanas; aprobación del coordinador cuando no sea deducible |
| Partes de Mecanizado: `id_programacion`, key, número, cantidad y entregas vinculadas | Relación explícita con UUID raíz de parte LP; no existe en esas columnas | Asociación de orígenes y asignaciones por parte, sin inferirla por nombre, reserva, P1 o cantidades iguales |

Las funciones inspeccionadas registran RESUELTO/PICKING solo tras verificar su
cobertura; no se llamaron ni modificaron. El padre `ventanas_afectadas` y una
línea `cantidad` pertenecen a unidades/granularidades distintas. Tampoco sumar
`ventanas_afectadas` de distintos faltantes: pueden corresponder a las mismas ventanas.

**Contrato lógico propuesto `LP-PDT-LIBERACION/1`** — no es una RPC nueva:

- Identidad: contrato PDT y versión, IDs de padre/detalle/entrega/línea aplicables,
  evento de origen y versión; key canónica, línea, etapa, grupo de bloqueos y
  asociación explícita a raíz LP o declaración «sin asignar».
- Evidencia: estado efectivo, validación/acreditación/cobertura del contrato de
  origen, fecha de observación, revisión de la fuente y referencia a su historial.
  Un emisor de servidor autorizado obtiene estos datos; no se aceptan banderas
  `verified=true` o cantidades declaradas por el navegador como prueba física.
- Cantidades: piezas originales por separado; ventanas consolidadas bloqueadas
  antes/después y **liberación neta nueva** para ese alcance. No exigir IDs
  individuales de ventanas. Sin consolidación suficiente, no generar crédito.
- Asociación: asignaciones de ese crédito a partes/turnos abiertos, con cantidad
  por asignación. Suma acreditada ≤ liberación probada; ninguna ventana acreditada
  dos veces por dos PDT o por repetir un evento. Registrar quién consolidó y motivo.
- Concurrencia: UUID estable ligado a contenido/emisor, revisión de origen y de
  destino, bloqueo por producción, aplicación atómica con notificación y auditoría.
  Repetición idéntica devuelve el resultado anterior; contenido distinto con el
  mismo ID es conflicto. Respetar presupuesto conciliado, saldo oficial y cantidad
  restante de cada parte. No reabrir ni escribir automáticamente un turno cerrado.
- Compensación: una anulación posterior conserva el crédito histórico y requiere
  evento compensatorio/conciliación. Si ya hubo ejecución, bloquear el ajuste que
  la dejaría sin respaldo; no borrar historia ni hacer SALE negativo.

Ejemplo conceptual de solapamiento: NC AL afecta 12 ventanas y NC V afecta 8;
la unión confirmada es 15. Entregar el aluminio no prueba liberar 12: si el resto
de bloqueos sigue afectando 8, la liberación neta sería 7 **solo si** la consolidación
antes/después cubre el mismo alcance y no existen otros bloqueos. Sin esa prueba,
queda pendiente de consolidación del coordinador, no se acredita 7 automáticamente.

**Brecha de c5178d8:** `liberaciones` + LIBERAR tienen UUID, key, etapa, ventanas,
evidencia, consolidado y consumo único. No tienen asignación tipada a parte/grupo,
versionado del emisor ni compensación de liberaciones consumidas. LIBERAR verifica
key/etapa, pero no una relación obligatoria entre la parte elegida y la evidencia.
Una evidencia consumible una sola vez tampoco resuelve repartir un evento entre
varias partes. Se debe completar ese contrato antes de conectar un emisor real;
la prueba sintética anterior no certifica esta integración productiva.

## 3. Export diario: contrato de inclusión, separado de Power BI de cierre

Existe `sgp_aplicar_export_diario`, que valida período/año y delega al escritor
instalado en `sgp_pdt_manual.original_aplicar_export_diario`. Este genera
`sgp_cargas_diarias.id_carga_diaria`, actualiza los saldos oficiales y conserva
filas en `sgp_export_diario_historial`. Hay key, línea, presencia, fecha y datos
originales. Los cuerpos leídos no enlazan esa carga con IDs de auditoría LP;
además, el esquema LP sigue ausente en Supabase. Un JSON histórico o la hora de
carga por sí solos no prueban qué avances fueron incluidos.

**Contrato lógico propuesto `LP-EXPORT-INCLUSION/1`:**

| Grupo | Evidencia requerida | Desarrollo pendiente |
|---|---|---|
| Corte oficial | UUID de carga, key/línea, etapa, registro de origen, corte/versionado de la fuente, hash y presencia/saldo válido | Asociación inmutable entre corte de origen y carga aplicada, conservando el escritor oficial |
| Inclusión | IDs/revisiones exactos de avances incluidos o una correspondencia de origen que pueda probarlos; alcance completo explícito | Manifiesto verificable por producción/etapa; no aceptar «todos hasta esta fecha» sin prueba |
| Efecto local | Revisiones acumuladas y diferencias entre antes/después, con correcciones y anulaciones | Proyección de deltas incluidos/no incluidos; nueva generación del presupuesto, sin eliminar auditoría |
| Activación | Revisión previa, carga anterior y aplicación atómica con el escritor de Export y consumidores | Puente de servidor idempotente, rechazo de cortes incompletos/obsoletos y protocolo compartido por todos los escritores |

Ejemplo: el líder declara 30 → 50 → 40. Los efectos son +30, +20, -10, no
30+50+40. Si Export informa saldo 248 e incluye esos tres eventos, no volver a
restar 40. Si informa 288 y prueba que no los incluye, quedan 40 locales por
considerar en el presupuesto operativo, que sería 248 en ese ejemplo simple.
**El saldo oficial sigue siendo el número recibido del Export.** Una diferencia
de 40 en dos archivos no demuestra por sí sola la inclusión de esos eventos.

Falta conocer la procedencia/corte real de los datos que alimentan Export y su
correspondencia con ejecución LP, incluida la coexistencia con escritores legacy.
No hay una RPC LP de conciliación productiva terminada: c5178d8 bloquea SALE,
EJECUTAR y LIBERAR cuando cambia su firma de carga/saldo. No resetear presupuestos
ni marcar eventos incluidos manualmente para sortear esa protección.

## 4. Permisos reales: rol, ventana y ámbito son controles distintos

SELECT agregado, sin nombres ni identificadores de personas:

| Rol de cuentas activas | Cantidad | Capacidad del contrato LP de c5178d8, siempre con ámbito aprobado |
|---|---:|---|
| ADMINISTRADOR | 1 | Leer, abrir turno, SALE, ejecutar, notas/afectaciones, validar, importar/cerrar y reabrir |
| COORDINADOR | 1 | Las mismas operaciones funcionales anteriores; no implica permiso para desplegar/aplicar SQL |
| LIDER MECANIZADO | 4 | No admitido como actor LP; conserva su circuito upstream |
| PATINADOR | 3 | No admitido como actor LP |
| RECEPCION | 2 | No admitido como actor LP; validar entregas/PDT en su circuito no concede ejecución LP |
| SUPERVISOR DE PICKING | 1 | No admitido como actor LP; conserva sus autorizaciones upstream |

No hay cuentas activas con rol LIDER, LIDER LINEA o CONSULTA en la consulta. LIDER
LINEA sí tiene una entrada de configuración de acceso a `ensamble`; eso no crea
un usuario ni le asigna línea/etapa. **No existe todavía una asignación real de
líderes Ensamble/Empaque acreditada para activar el nuevo contrato.**

Para los roles admitidos pero sin cuentas activas: LIDER / LIDER LINEA pueden
leer, ejecutar, registrar notas/afectaciones e importar/cerrar turnos abiertos;
no abrir turnos, modificar SALE, validar consolidación ni reabrir. CONSULTA solo
lee. En EN_REVISION, las correcciones exigen coordinador/administrador y motivo.

`sgp_mis_accesos` resuelve cuentas no administradoras mediante
`sgp_usuario_accesos`; `sgp_rol_accesos` es configuración por rol, no prueba de acceso
efectivo de cada persona. Se observaron permisos/overrides de ventana, no un
contrato de ámbitos LP por línea/etapa/producción. La fachada LP no consulta esas
tablas de ventanas: usa sesión y su tabla privada de permisos. Es necesario validar
ambos controles antes de habilitar; no convertir un check visual en autorización RPC.

| Línea LP existente | Etapa | Rol/cuenta responsable real | Alcance de producción y firma de cierre | Estado |
|---|---|---|---|---|
| PANELES_2 | ENSAMBLE | Por aportar | Por aprobar, incluidas órdenes arrastradas | Sin asignación / sin acceso concedido |
| PANELES_2 | EMPAQUE | Por aportar | Por aprobar, incluidas órdenes arrastradas | Sin asignación / sin acceso concedido |
| FRAMES_2 | ENSAMBLE | Por aportar | Por aprobar, incluidas órdenes arrastradas | Sin asignación / sin acceso concedido |
| FRAMES_2 | EMPAQUE | Por aportar | Por aprobar, incluidas órdenes arrastradas | Sin asignación / sin acceso concedido |

Completar la [plantilla de ámbitos](plantillas/ambitos_lp_por_confirmar.csv) con
cuentas existentes, rol real, responsable y suplencia. No se proponen nombres,
usuarios nuevos ni cambios de rol. Si se elige un responsable cuyo rol no admite
LP, esa incompatibilidad se resuelve mediante decisión/autorización separada.

El esquema privado no está instalado: los ámbitos están **no aplicados**, no
«configurados vacíos en producción». Al instalar el SQL quedarían vacíos. ADMINISTRADOR
y COORDINADOR también necesitan ámbitos; no tienen acceso universal implícito.
La tabla propuesta es `(usuario, etapa, key)`: deriva la línea de la producción,
no soporta vigencia temporal ni incorpora automáticamente producciones nuevas.
Cerrar/importar un turno exige ámbito sobre **todas** sus órdenes de línea/etapa;
un líder con ámbito parcial puede ejecutar sus órdenes, pero no firmar ese cierre.
La continuidad de ámbitos para nuevas producciones y las suplencias necesitan
proceso/contrato de administración aprobado, no GRANT masivo.

## 5. Arrastre y SALE frente a lo aprobado

| Regla aprobada | c5178d8 comprobado por lectura | Resultado / trabajo pendiente |
|---|---|---|
| Orden incompleta aparece abierta en el turno siguiente | ABRIR incorpora fuentes anteriores; consultar no crea filas. Solo coordinador/administrador puede abrir | Parcial: automatiza la incorporación **al abrir**, no la aparición por reloj o primera consulta del líder. Falta garantizar apertura del destino sin ampliar permisos del líder |
| Es el turno siguiente, con contexto, sin mezclar avances | Raíz estable, ejecución nueva 0; copia observación/afectaciones, invalida validación, no duplica arrastre legacy; parte completamente ejecutada queda fuera | Conservación delimitada correcta. No valida que fecha/turno solicitado sea el siguiente hábil; falta resolver calendario y correcciones de cadenas ya arrastradas |
| Abiertas SALE positivo, después cero, luego nuevas; antiguas primero | Dos clases de abiertas; todas las arrastradas inician SALE=0. `origen_fecha` es el turno anterior inmediato | Jerarquía implementada, disponibilidad anterior no se conserva validada. Antigüedad original no debe perderse al arrastrar reiteradamente; raíz permite recuperarla, falta incorporarla como criterio estable |
| SALE independiente por etapa y saldo oficial solo de Export | SALE explícita por etapa, cantidades de parte/presupuesto protegidas; Export se lee | Compatible como límite; el cambio diario de carga sigue bloqueado sin puente de inclusión |
| **Empaque inicia SALE con saldo oficial y coordinador ajusta capacidad** | Nuevas tienen SALE=NULL; arrastradas SALE=0. El formulario sugiere saldo solo ante NULL; no lo persiste | **No cumplido como inicialización persistida.** Pendiente aplicar la regla aprobada, repartir entre partes sin duplicar y registrar ajustes/notificación. Un valor sugerido no equivale a SALE validado |
| Material bloqueado no es disponibilidad; solapamientos se consolidan | Registro/validación de afectaciones existe, pero no calcula automáticamente disponibilidad inicial desde PDT | Falta puente y consolidación. No usar saldo completo como disponibilidad material probada ni restar categorías sumadas |

No hace falta volver a aprobar las reglas ya documentadas. Falta concretar
calendario/fecha operativa y el reparto por partes cuando la fuente solo es por
orden. Ejemplo ilustrativo: saldo oficial de Empaque 248, restantes de partes
50/90/90/18 tras inclusión demostrada del avance previo. El reparto suma 248; no
se asignan 248 a cada parte. Una capacidad de 180 necesita ajuste explícito del
coordinador; no se inventa qué partes recorta primero.

Se leyó HORARIOS_TURNOS vigente: lunes–sábado T1 07:00–19:00, T2 19:00–07:00;
domingo T1 07:00–18:00, T2 18:00–05:00. Debe confirmarse cómo la fuente Power BI
etiqueta la fecha del turno nocturno y qué calendario aplica en huecos/festivos.
No se pide volver a proporcionar horarios que ya están configurados.

## 6. Instalación/recuperación: resultado de la revisión

El [plan revisado](INSTALACION_Y_RECUPERACION.md) conserva 01 atómico, escrituras
y formato desactivados por defecto, 04 opcional con huella y contención/recuperación
sin borrar historia. No es una autorización ni un plan listo para ejecutar hoy.
Antes de instalar/activar faltan el adaptador real, puentes, ámbitos y las brechas
de arrastre/SALE descritas. 01 no instala ninguno de esos desarrollos automáticamente.

Verificación de esta entrega: revisión documental contra funciones/columnas y
código de referencia, integridad de enlaces/plantilla y diff. **No se ejecutan SQL
propuestos, pruebas aisladas nuevas, las 111 pruebas, backups, migraciones, GRANT,
activación, fusión ni despliegue.** La evidencia anterior conserva su alcance
sintético; no se certifica su contrato con archivos o responsables reales.

## Lo indispensable que debe entregar el responsable funcional

1. **Dos Power BI reales**, uno por etapa, con filtros/período/corte, unidad,
   significado del acumulado y tratamiento de ceros/ausentes. Aportar equivalencia
   de IDs; si solo hay total por orden, definir comparación por orden o vínculo
   válido a partes, sin reparto inferido.
2. **Un caso existente PDT de liberación parcial y solapamiento**, con referencias
   de entrega/validación/cierre, etapa, producción y ventanas realmente liberadas.
   Indicar quién consolida esas ventanas y cómo se trata una anulación posterior.
3. **Dos Export diarios consecutivos y su criterio/fuente de inclusión**, con un
   avance conocido entre ellos. Los archivos ilustran el caso, pero no bastan sin
   una regla verificable que determine qué avances contiene cada corte.
4. **La plantilla de ámbitos**, con cuentas/roles reales, responsables de cierre,
   suplentes y producciones por las cuatro combinaciones de línea/etapa. Completar
   fuera del repositorio público; no aportar contraseñas ni tokens.
5. **Las convenciones operativas aún no definidas**: fecha de turno nocturno,
   siguiente turno operativo en huecos/festivos y criterio de reparto del SALE
   de Empaque entre partes/capacidad. Las reglas generales de arrastre y saldo
   oficial ya están aprobadas y no se someten a una nueva confirmación.

Un mantenedor técnico deberá cerrar después la evidencia de inclusión, los puentes
y las correcciones identificadas, con pruebas nuevas/afectadas, no repetir todo
por defecto. Autorizar instalaciones, accesos, pruebas productivas, recuperación
y publicación seguirá siendo una decisión expresa posterior y separada.
