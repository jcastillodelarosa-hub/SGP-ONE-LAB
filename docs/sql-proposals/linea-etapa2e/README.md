# Etapa 2E — propuestas SQL, NO instaladas en Supabase

Reutiliza `linea-etapa2d/02_export_ack_REVIEW.sql` y el ledger B2. No duplica el
motor, no modifica importador ni lectores productivos. Las columnas nuevas del
manifiesto no se atribuyen a tablas reales de Export.

1. Revisar stack #117→#121→#122→#124→#127 y este Draft; fuentes/roles/escritores
   instalados deben certificarse aparte. Main125/128 no se sobrescriben.
2. Solo en QA, disponer de baseline B2 y ACK D2; instalar01 en su transacción.
3. Escritor privado captura ACK explícito por evento/corte y sella bajo lock común.
   Un UUID sin disposición bloquea; no se infieren inclusiones ni se envían flags
   desde navegador. Solo se obtiene un recibo NO CERTIFICADO.
4. Lector privado READ ONLY exige sesión y ámbitos de ambas etapas; siempre
   devuelve available=null hasta integración real autorizada y revisada aparte.
5. ROLLBACK_REVIEW únicamente si no hay manifiestos. Con evidencia no borrar:
   conservar historial, contener futura activación y reparar hacia delante.

No grants de navegador, no desactivación RLS, sin cambios legacy. El pool real
mínimo y el vínculo atómico importador↔historial↔ACK NO están implementados.
No ejecutar estos scripts contra Supabase productivo dentro de este encargo.
