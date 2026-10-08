import { getSupabaseClient } from "./supabase-client.js";

export async function classifyPieceCodes(codes) {
  const uniqueCodes = [...new Set((codes || []).map(v => String(v ?? "").trim()).filter(Boolean))];
  if (!uniqueCodes.length) return [];
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.rpc("sgp_clasificar_piezas_aluminio", { p_codigos: uniqueCodes });
  if (error) throw new Error("No fue posible consultar el Maestro de Piezas: " + error.message);
  return data || [];
}
