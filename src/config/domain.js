export const SGP = Object.freeze({
  schemaVersion: "2.0",
  yesNo: Object.freeze(["SI", "NO"]),
  productionIdentity: "ID|ID_LINEA",
  trackingIdentity: "ID|RESERVA",
  reservationStates: Object.freeze(["PENDIENTE_ABASTECIMIENTO","PENDIENTE_BODEGA","ALUMINIO_ENTREGADO"]),
  processFlow: Object.freeze(["CORTE","MECANIZADO","PROCESADO","PICKING"]),
  productionStates: Object.freeze(["CERRADA","ABIERTA","ENSAMBLADA","FINALIZADA"]),
  blockingAluminumStates: Object.freeze(["SAP_NO_CLASIFICADO","DESTINO_NO_RESUELTO","CONFLICTO"]),
  nonBlockingAluminumStates: Object.freeze(["SIN_MATCH"])
});

export const ALUMINUM_CONTROL_LINES = Object.freeze(["PANELES_2", "FRAMES_2"]);

export const PANEL_FRAME_GROUPS = Object.freeze([
  ["PANELES", "FRAMES"],
  ["PANELES_2", "FRAMES_2"]
]);

export const DAILY_SOURCES = Object.freeze(["SALDOS","SEGUIMIENTO_ALUMINIO","NC_ALUMINIO","VIDRIO","NC_VIDRIO"]);
