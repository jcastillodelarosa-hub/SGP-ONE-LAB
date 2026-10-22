/* SGP_ONE: administración del maestro. Escrituras deshabilitadas hasta aprobar RPC segura. */

export const PIECE_TYPES=Object.freeze(["PANEL","FRAME","COVER","REFUERZO","MUNTIN"]);
export const PIECE_DESTINATIONS=Object.freeze(["PANEL","FRAME"]);
export const PIECE_LINES=Object.freeze(["PANELES_2","FRAMES_2"]);
export function groupMissingPieceCodes(rows){
 const result=new Map();
 for(const row of rows||[]){
  const code=String(row.codigo_sap??"").trim();
  if(!code)continue;
  if(!result.has(code))result.set(code,{codigo_sap:code,descripcion:String(row.descripcion??"").trim(),filas:0,lineas:new Set()});
  const entry=result.get(code);entry.filas++;if(row.linea)entry.lineas.add(row.linea);
 }
 return [...result.values()].map(r=>({...r,lineas:[...r.lineas]}));
}
export function validateMasterRecord(record){
 const codigo_sap=String(record.codigo_sap??"").trim();
 const tipo_pieza=String(record.tipo_pieza??"").trim().toUpperCase();
 const destino_productivo=String(record.destino_productivo??"").trim().toUpperCase();
 const lineas_aplicables=[...new Set(record.lineas_aplicables||[])];
 if(!codigo_sap||!PIECE_TYPES.includes(tipo_pieza)||!PIECE_DESTINATIONS.includes(destino_productivo)||!lineas_aplicables.length||lineas_aplicables.some(x=>!PIECE_LINES.includes(x)))throw new Error("Complete código SAP, tipo, destino y líneas válidas.");
 return {codigo_sap,tipo_pieza,destino_productivo,lineas_aplicables,observacion:String(record.observacion??"").trim()||null,activo:record.activo==="NO"?"NO":"SI"};
}
export async function listPieceMaster(){
 const {getSupabaseClient}=await import("./supabase-client.js");
 const client=await getSupabaseClient();
 const {data,error}=await client.from("sgp_maestro_piezas").select("codigo_sap,tipo_pieza,destino_productivo,observacion,activo,fecha_actualizacion,lineas_aplicables").order("codigo_sap").limit(1000);
 if(error)throw new Error("No fue posible consultar el Maestro: "+error.message);
 return data||[];
}
export async function savePieceMaster(){
 throw new Error("Guardado pendiente: se requiere RPC de administración con autorización de rol y auditoría en Supabase.");
}
