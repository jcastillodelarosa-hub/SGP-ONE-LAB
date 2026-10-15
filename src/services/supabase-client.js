const CONFIG = window.SGP_CONFIG || {};

let supabaseClientPromise = null;
const SUPABASE_ESM_SOURCES = [
  "https://esm.sh/@supabase/supabase-js@2",
  "https://unpkg.com/@supabase/supabase-js@2/dist/index.mjs",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"
];

export function isSupabaseConfigured() {
  return Boolean(CONFIG.supabaseUrl && CONFIG.supabasePublishableKey);
}

async function loadSupabaseModule() {
  let lastError = null;
  for (const source of SUPABASE_ESM_SOURCES) {
    try {
      const mod = await import(source);
      if (typeof mod.createClient === "function") return mod;
    } catch (error) {
      lastError = error;
      console.warn("SGP ONE · fuente Supabase no disponible:", source, error);
    }
  }
  throw new Error("No fue posible cargar el cliente de Supabase desde las fuentes disponibles. La red puede estar bloqueando los CDN externos."+(lastError?.message?" Detalle: "+lastError.message:""));
}

export async function getSupabaseClient() {
  if (!isSupabaseConfigured()) throw new Error("Supabase no está configurado.");
  if (!supabaseClientPromise) {
    supabaseClientPromise = loadSupabaseModule()
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
      ))
      .catch(error => {
        supabaseClientPromise = null;
        throw error;
      });
  }
  return supabaseClientPromise;
}
