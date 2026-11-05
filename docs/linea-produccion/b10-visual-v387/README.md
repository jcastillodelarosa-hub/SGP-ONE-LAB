# LAB v387 · B10 visual independiente

Base publicada: main328022396cf4e3971f23065095b16229e2721429 (v385).
Reutiliza solo el delta visual de a5586638: chips de causas positivas acreditadas,
indicador compacto pendiente, semana con color estable por año/semana y número/año
visibles, contraste >4.5:1, detalle lateral y filtros existentes. Referencia original
references/SGP_Guia_Visual_27_Bocetos.html#b10 examinada; instrucciones posteriores
sobre Semana izquierda, filtros Sheets y panel lateral prevalecen.

Independiente de v386: no importa lector de abiertas, funciones nuevas, SQL, roles,
permisos, flags ni cambios de datos. Usa contratos v385 existentes. No contiene
editor/borrador SALE ni validador/contrato futuro. En Seguimiento global SALE dice
No disponible por orden; las vistas operativas conservan valores y flujo actuales.
No anunciar persistencia SALE como resuelta: continúa en otro worktree aislado.

500 pruebas Node, verify:release387, Chromium1440/390 PASS: chips10AL/8V con unión12,
LEGACY19piezas no se convierte en ventanas, pendientes sin ceros ficticios, apertura
del detalle y teclado, colores/etiquetas, ausencia de editor SALE, refresco silencioso,
revocación y respuestas tardías. Tracking-ui: filtros/foco/scroll/panel y3ciclos20s,
menús por encabezado y balance propio de etapa. Evidencia sintética, no Hosting.

Versión: visual v387 es el siguiente incremento propuesto, no está publicado.
Los candidatos históricos v386 de abiertas y v387 de persistencia no deben publicarse
con etiquetas repetidas/anteriores: renumerar al integrar, >=v388 según orden aprobado.
No combinar cadena antigua B14–B27. No relajar HOLD ni validadores.

## Baseline y recuperación acreditados por coordinador

sites/sgp-one-lab/versions/ba7ae3754b4d5a76 (v385), publicación SUCCESS
https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/42026212221,
job127241255508, observado2026-11-05T12:21:14.742276+00:00.
106 archivos:104 aplicación idénticos y2 plataforma intactos.
Inventory SHA256 c6f2371c388c87a5e454acaebd9323ea377e13d00a008140930b92d347cb756c;
config SHA256 b1c8097ce32ce29d3d39d04e54f86699c1cd013dcbfc8a4f9b89f033cadc34fd.
No nueva inspección productiva desde este hilo ni reintento de descarga403.

Siguiente: PR borrador y CI de su SHA final, pins y artefacto revisado. Integración y
publicación solo por coordinador. Sin aprobación formal ni despliegue desde este hilo.
