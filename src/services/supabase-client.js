const CONFIG = window.SGP_CONFIG || {};

export function isSupabaseConfigured() {
  return Boolean(CONFIG.supabaseUrl && CONFIG.supabasePublishableKey);
}

export async function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase no está configurado.");
  }

  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");

  return createClient(
    CONFIG.supabaseUrl,
    CONFIG.supabasePublishableKey,
    {
      db: { schema: "public" },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
}
