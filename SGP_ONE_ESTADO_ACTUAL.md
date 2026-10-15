# SGP_ONE — DOCUMENTO MAESTRO DE CONTINUIDAD

## 1. INFORMACIÓN GENERAL
- Proyecto: SGP_ONE
- Objetivo: Sistema de gestión de producción de ventanería en aluminio y vidrio.
- Repositorio: GitHub
- Hosting: Firebase
- Versión actual: Pendiente de verificar
- Última actualización: Pendiente

## 2. ARQUITECTURA
Documentar:
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
- Rama activa:
- Último commit verificado:
- Versión publicada:
- Fecha de despliegue:
- Pruebas realizadas:

## 9. PRÓXIMAS ACTIVIDADES
1. Verificar el estado real del código en GitHub.
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
