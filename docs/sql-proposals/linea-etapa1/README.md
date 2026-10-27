# Propuestas Etapa1 — NO APLICADAS

01_schema_REVIEW.sql es un esqueleto aditivo en esquema privado. No reemplaza
las tablas ni RPC de planificación existentes, no copia históricos y no concede
acceso al navegador. No instala servicios, triggers de captura o tareas cron.
No está en supabase/migrations ni en ningún flujo de instalación automática.

Pendientes para ser instalable: metadatos reales, FK de producción compatible,
RPC autenticadas, locks por turno/producción, control de revisiones, autorización
por etapa, inmutabilidad de eventos/cierres, validez de arrastre/destino y evidencia
Empaque/Export. Las CHECK/FK del esqueleto no implementan todas esas garantías.
No pedir aplicación productiva del esquema como si el motor estuviera terminado.

ROLLBACK_REVIEW.sql solo permite retirar las tablas nuevas vacías; cualquier
fila o dependencia no contemplada impide la reversión transaccional. Sin CASCADE.
Si se incorporaran datos, conservarlos y diseñar reversión de código/contención,
no borrar eventos ni restaurar un backup sobre operaciones posteriores.

Prueba ejecutada solo en PostgreSQL17 aislado sin red/puertos:
python tests/linea-stage1/schema-isolated.py. Evidencia JSON en ese directorio.
No es prueba de compatibilidad con el catálogo Supabase productivo.
