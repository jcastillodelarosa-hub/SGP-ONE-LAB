import { getSupabaseClient } from "./supabase-client.js";

export async function importProductions(rows) {
  if (!rows.length) throw new Error("No hay producciones válidas para cargar.");
  const supabase = await getSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) throw new Error("Debes iniciar sesión para escribir en Supabase.");
  let written = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase.from("sgp_producciones").upsert(rows.slice(i, i + 100), { onConflict: "key_produccion" });
    if (error) throw error;
    written += Math.min(100, rows.length - i);
  }
  return { written };
}
