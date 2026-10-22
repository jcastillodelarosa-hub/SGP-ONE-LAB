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
 if(!codigo_sap||!PIECE_TYPES.includes(tipo_pieza)||!PIECE_DESTINATIONS.includes(destino_productivo)||lineas_aplicables.length!==2||PIECE_LINES.some(x=>!lineas_aplicables.includes(x)))throw new Error("Complete código SAP, tipo, destino y líneas válidas.");
 return {codigo_sap,tipo_pieza,destino_productivo,lineas_aplicables,observacion:String(record.observacion??"").trim()||null,activo:record.activo==="NO"?"NO":"SI"};
}
export async function listPieceMaster(token){
 if(!token)throw new Error("Inicie sesión SGP como Administrador.");
 const {getSupabaseClient}=await import("./supabase-client.js");
 const client=await getSupabaseClient();
 const {data,error}=await client.rpc("sgp_admin_maestro_piezas_listar",{p_token:token});
 if(error)throw new Error("No fue posible consultar el Maestro: "+error.message);
 return data||[];
}
export async function savePieceMaster(record, token){
 const item=validateMasterRecord(record);
 if(!token)throw new Error("Inicie sesión SGP para administrar el Maestro.");
 const {getSupabaseClient}=await import("./supabase-client.js");
 const client=await getSupabaseClient();
 const {data,error}=await client.rpc("sgp_admin_maestro_piezas_guardar",{
  p_token:token,p_codigo_sap:item.codigo_sap,p_tipo_pieza:item.tipo_pieza,
  p_destino_productivo:item.destino_productivo,p_lineas_aplicables:item.lineas_aplicables,
  p_observacion:item.observacion,p_activo:item.activo
 });
 if(error)throw new Error("No se guardó la clasificación: "+error.message);
 return data;
}
