import { getSupabaseClient, isSupabaseConfigured } from "./supabase-client.js";

export async function fetchAluminumTracking() {
  if (!isSupabaseConfigured()) {
    return { configured: false, rows: [] };
  }

  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from("sgp_seguimiento_aluminio")
    .select([
      "key_seguimiento_aluminio",
      "id",
      "reserva",
      "anio",
      "semana",
      "proyecto",
      "produccion",
      "sistema",
      "estado_reserva",
      "estado_reserva_fuente",
      "peso_reserva",
      "cant_vent",
      "porcentaje_vidrio",
      "vent_cant_vidrio",
      "activo"
    ].join(","))
    .eq("activo", "SI")
    .order("semana", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;

  return {
    configured: true,
    rows: data || []
  };
}
