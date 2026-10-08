import { getSupabaseClient } from "./supabase-client.js";

export async function loadPieceMaster() {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from("sgp_maestro_piezas")
    .select("codigo_sap,tipo_pieza,destino_productivo,observacion,activo,lineas_aplicables")
    .eq("activo", "SI");
  if (error) throw error;
  return data || [];
}
