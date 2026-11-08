# Inclusión operativa propia de Empaque · candidato

Base LAB v411/main8cb2293. NO aplicada, activada ni publicada.

La tabla privada `sgp_lp_operacion.inclusiones_empaque` representa la decisión
explícita de trabajar una orden en un turno de Empaque. No es un segundo
planificador: no calendario, cambios de fecha, cancelaciones ni importaciones de
planes. No escribe el plan común de Ensamble ni inventa raíz UUID para el FK
legacy. Cada petición guarda cantidad explícita, motivo, autor, período y respuesta;
la tabla es inmutable y unique(linea,fecha,turno,key), con FK al turno Empaque.

RPC nueva: `sgp_lp_empaque_incorporar(p_token text,p_cmd jsonb)`.
Cmd EXACTO: id UUID, date, shift, key, revision, quantity entero positivo,
observation no vacía <=2000. Quantity <= saldo_empaque vigente e inicializado,
orden activa/presente/no excluida. Es un objetivo explícito para trabajar, no
realizado, ni prueba de disponibilidad física o saldo transferido de Ensamble.
Solo turno ABIERTO sin sucesor. Rechaza si ya hay inclusión propia o fila operativa
legacy Empaque para esa orden/período. No altera fila previa ni vuelve a incorporarla.

Permisos estrechos: LIDER LINEA, SUPERVISOR EMPAQUE, COORDINADOR, ADMINISTRADOR con
sesión SGP, capacidad actual CERRAR de Empaque y ámbito vigente LEER de la orden.
No modifica matrices ni operaciones_rol. Nuevo EXECUTE solo para anon/authenticated
obligados a sesión SGP; tablas y triggers sin permiso público. Trigger privado
SECURITY DEFINER postgres/search_path vacío vuelve a validar permisos al commit.
Bandera `incorporar_empaque=false` por defecto; requiere escrituras habilitadas.

Orden locks: config FOR SHARE, request UUID/123, EMPAQUE|PANELES_2/184, turno FOR
UPDATE, producción FOR UPDATE. CAS aumenta revision turno una vez. Repetir ID con
payload/usuario exactos devuelve recibo aun con bandera contenida; reutilizarlo
con otra petición falla. Datos/tabla/plan Ensamble nunca se modifican.

Lector: `reader-fragment.sql` para integrar al final de la proyección autorizada,
antes del RETURN final. NO es instalador independiente. Capacidad
LP-INCORPORAR-EMPAQUE-1; catalog.assignmentStage=EMPAQUE, assignments de fuente
PROGRAMACION_EMPAQUE con stage explícita, cantidad/motivo/fecha/autor propios.
Export V4 debe capturar esta fuente y revision real, no convertir cantidades de
raíces Ensamble en metas Empaque. Filas legacy sin objetivo propio quedan sin
objetivo acreditado, no cero.

Frontend: servicio current-turn reconoce ambas etapas y RPC propia; formulario y
botón Otras reutilizados. Controller `packingInclusionController` conserva ID exacto
ante respuesta incierta. Falta conectar callback en lp01-operation.js (lo integra
worker Export) y aplicar discovery junto al lector final. No declarar operativo si
empaquetado contiene esa ruta. Sin skills de programación ni auditoría general.

Contención: UPDATE config SET incorporar_empaque=false; no borrar inclusiones ni
turnos. Reutilizar recibos, conservar historial. Nueva versión la asigna integración.

Pruebas: tests/lp01-empaque-inclusion/pglite.mjs (4 grupos: anon COMMIT,
idempotencia/CAS/no writes Ensamble, permisos/cantidad/exclusión, revocación al
commit y contención). Tests Node packing/current-turn/incorporate:8PASS.
PG17 concurrente y prueba UI integrada pendientes en CI. Datos sintéticos, sin
Supabase remoto. Turno horario Empaque es paquete separado
../lp01-turno-horario-empaque/ y comienza contenido.
