const CONFIG = window.SGP_CONFIG || {};

let supabaseClientPromise = null;

export function isSupabaseConfigured() {
  return Boolean(CONFIG.supabaseUrl && CONFIG.supabasePublishableKey);
}

export async function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase no está configurado.");
  }
  if (!supabaseClientPromise) {
    supabaseClientPromise = import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm")
      .then(({ createClient }) => createClient(
        CONFIG.supabaseUrl,
        CONFIG.supabasePublishableKey,
        {
          db: { schema: "public" },
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
            storageKey: "sgp-one-supabase-client"
          }
        }
      ));
  }
  return supabaseClientPromise;
}
