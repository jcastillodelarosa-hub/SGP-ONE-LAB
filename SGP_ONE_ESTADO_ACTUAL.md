# SGP_ONE — DOCUMENTO MAESTRO DE CONTINUIDAD

## 1. INFORMACIÓN GENERAL
- Proyecto: SGP_ONE
- Objetivo: Sistema de gestión de producción de ventanería en aluminio y vidrio.
- Repositorio: GitHub
- Hosting: Firebase
- Versión de package.json: 0.1.0 (no equivale necesariamente a la versión publicada)
- Última revisión documental: 2026-10-14

## 2. ARQUITECTURA
### Estructura comprobada en GitHub (rama main)
- Interfaz: `index.html`, `styles.css`.
- Aplicación: `app.js`.
- Código organizado: `src/modules`, `src/services`, `src/domain`, `src/data`, `src/config`.
- Módulo identificado: `src/modules/mecanizado.js`.
- Servicios: seguimiento de aluminio, maestro de piezas, importación de producciones y cliente Supabase.
- Dominio: importadores de aluminio, vidrio, accesorios, NC y producciones.
- Hosting configurado: `firebase.json`.
- Persistencia: existen cliente Supabase y migraciones SQL; verificar esquema y despliegue real.
- Documentación: `docs/architecture.md`, `docs/migration-plan.md`, `docs/supabase-setup.md`.
- Pruebas: archivos en `tests/`, ejecutables potencialmente con `npm test`; no ejecutadas en esta revisión.

### Reglas documentadas en `docs/architecture.md`
- Jerarquía: SGP ONE → línea de producción → sublínea física → proceso.
- Identidad de producción: `ID + ID_LINEA`.
- Logística de reserva: `PENDIENTE_ABASTECIMIENTO → PENDIENTE_BODEGA → ALUMINIO_ENTREGADO`.
- Proceso productivo: `CORTE → MECANIZADO → PROCESADO → PICKING`.
- `PROCESADO` significa mecanizado terminado; `PICKING` significa material entregado a línea.
- El patinador reporta lo entregado y pendiente; la línea confirma independientemente la recepción.
- La clasificación de piezas PANEL / FRAME / COVER / REFUERZO / MUNTIN aplica únicamente a `PANELES_2` y `FRAMES_2`.
- Seguimiento Aluminio usa clave `ID|RESERVA`; relación con producción por `ID`.
- Apps Script permanece operativo durante la migración y validación de módulos.

### Información aún por documentar:
- Estructura del código.
- Tecnologías y servicios.
- Base de datos.
- Integraciones.
- Autenticación y permisos.
- Dependencias entre módulos.

## 3. MÓDULOS DEL SISTEMA
- Programación de producción.
- Mecanizado.
- Auditoría de reservas.
- Entregas y picking.
- Pendientes de aluminio.
- Ensamble.
- Novedades y no conformidades.

Para cada módulo registrar:
- Funcionalidades existentes.
- Funcionalidades verificadas.
- Funcionalidades pendientes.
- Errores conocidos.
- Dependencias.

## 4. REGLAS DE NEGOCIO
### Entregas y picking
- PICKING: entrega registrada.
- CON PENDIENTES: existen órdenes o cantidades pendientes.
- POR VALIDAR: entrega pendiente de auditoría.
- PDT CORRECCIÓN: diferencia identificada durante la auditoría de picking.
- Las entregas parciales deben conservar trazabilidad por orden y producción.
- Las definiciones y transiciones deben verificarse contra las decisiones aprobadas.

### Auditoría de reservas
- Registrar fecha y turno de recepción.
- Permitir fotografías de la reserva.
- Identificar si la reserva está completa.
- Registrar los pendientes cuando esté incompleta.

## 5. CAMBIOS PENDIENTES DE VERIFICAR
- Sistema y acabado en partidas abiertas.
- Fecha de primera entrega.
- Contador de días abierta.
- Fecha y turno al entregar.
- Estados de entrega y picking.
- Alineación de encabezados.
- Desplazamiento en ventanas y dispositivos móviles.

## 6. HISTORIAL DE DECISIONES
Para cada decisión registrar:
- Fecha.
- Módulo.
- Requisito aprobado.
- Motivo.
- Estado de implementación.

## 7. ERRORES Y CORRECCIONES
Para cada incidencia registrar:
- Descripción.
- Cómo reproducirla.
- Causa identificada.
- Corrección aplicada.
- Resultado de pruebas.

## 8. CONTROL DE VERSIONES
- Revisión documental inicial: 2026-10-14. No se han modificado archivos funcionales.
- Estado de despliegue: no verificado.
- Rama activa:
- Último commit verificado:
- Versión publicada:
- Fecha de despliegue:
- Pruebas realizadas:

## 9. PRÓXIMAS ACTIVIDADES
1. Inspeccionar `app.js`, `src/modules/mecanizado.js` y las migraciones para verificar implementaciones y transiciones de estado.
2. Reconstruir las reglas de negocio aprobadas.
3. Actualizar el estado de cada módulo.
4. Priorizar los desarrollos pendientes.

## 10. PROTOCOLO DE CONTINUIDAD
Antes de desarrollar:
1. Consultar este documento.
2. Revisar el código actual de GitHub.
3. Identificar dependencias y reglas existentes.
4. No asumir implementaciones no verificadas.

Después de desarrollar:
1. Registrar modificaciones realizadas.
2. Identificar archivos afectados.
3. Documentar pruebas y resultados.
4. Registrar errores y pendientes.
5. Actualizar este documento.
6. Dejar identificado el siguiente paso.

Nunca declarar una funcionalidad como implementada o publicada sin verificarlo.
