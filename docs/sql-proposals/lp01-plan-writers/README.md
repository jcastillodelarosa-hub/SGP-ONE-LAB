# Planificador: motivo e identidad de solicitud

Requiere instalar primero el journal privado de `lp01-ensamble-plan/01_plan_REVIEW.sql`.
Esta propuesta no activa su bandera ni cambia cantidades por sí misma.

Dos sobrecargas públicas de los RPC existentes añaden `p_motivo text` y
`p_request_id uuid`. Conservan las funciones originales de seis argumentos,
sus cuerpos, propietarios y ACL. Las nuevas funciones SECURITY DEFINER con
search_path vacío llaman helpers privados que autentican coordinador/admin,
revalidan permiso temporal y conservan el algoritmo original de programación
u operación mover/dividir. La identidad del actor se obtiene de la sesión,
nunca del cliente. Los únicos EXECUTE nuevos son anon/authenticated sobre esas
dos firmas de ocho argumentos. Tablas y helpers permanecen privados.

El trigger privado diferido `plan_contexto_completo` pasa a SECURITY DEFINER
para comprobar el contexto al COMMIT cuando la invocación vuelve al rol técnico.
No recibe EXECUTE público ni acceso de tablas. Su cuerpo y búsqueda vacía se conservan.

La UI PANELES_2 usa las nuevas firmas en todas las entradas programar/mover,
incluyendo drag/drop y grupos. Solicita un motivo humano y conserva UUID,
payload y motivo en sessionStorage hasta confirmar recibo. No guarda token.
Un fallo de transporte o recibo inválido impide cambiar payload antes de resolver
el reintento. Las filas de un grupo conservan su UUID para evitar duplicados al
repetir la solicitud parcial. Un recibo siempre se revalida en servidor.
Otras líneas conservan la ruta anterior; este journal no afirma cubrirlas.

No se cambia el calendario, no se crea otra planificación ni se reconstruye
historia anterior. La primera observación sigue `OBSERVED_AT_ENROLLMENT` y
`historyBefore=UNKNOWN`. Los cambios legacy externos siguen marcando el plan
como no acreditado, bloqueando cierre hasta resolverlos explícitamente.

Pruebas focales: cinco casos Node de transporte/reintento y SQL PGlite con
programar/mover reales, COMMIT anon/authenticated, replay, payload conflictivo,
rol inválido, permisos privados, metadata legacy intacta y snapshot actual.
No equivale a instalación remota ni prueba real en planta.
