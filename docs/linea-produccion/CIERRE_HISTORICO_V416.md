# Cierre factual histórico v416

Permite preparar explícitamente un turno pasado que nunca tuvo cabecera, con rol coordinador/administrador, motivo y operación idempotente. No cierra ni carga archivos automáticamente. Los turnos existentes no se reemplazan. No crea programación, asignaciones, cantidades realizadas ni arrastre.

La importación conserva el archivo original y valida su etapa, línea, fecha, turno, producciones autorizadas y total. El filtro opcional de turno del Export se admite únicamente cuando concuerda con todas las filas. Las cargas parciales sustituyen valores presentes y conservan los previamente acreditados del mismo turno, sin sumar lotes ni convertir ausencias en cero.

En el cierre histórico el plan es explícitamente no disponible. No se calcula cumplimiento ni se reconstruye un plan original a partir de la programación actual. El cierre guarda evidencia factual y no habilita continuidad ni acredita Disponible.

Preparación de código y SQL. No implica que un usuario haya preparado, cargado o cerrado ningún turno. La instalación se verifica por metadatos; la aceptación funcional de un cierre real corresponde al usuario.
