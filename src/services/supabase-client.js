const CONFIG = window.SGP_CONFIG || {};
let supabaseClientPromise = null;
let localSdkPromise = null;

export function isSupabaseConfigured(){return Boolean(CONFIG.supabaseUrl&&CONFIG.supabasePublishableKey)}

const SUPABASE_SDK_SOURCES = [
  "vendor/supabase.js",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.76.1/dist/umd/supabase.min.js",
  "https://unpkg.com/@supabase/supabase-js@2.76.1/dist/umd/supabase.js"
];

function loadScript(source){
 return new Promise((resolve,reject)=>{
  const s=document.createElement("script");
  s.src=source;
  s.async=true;
  s.dataset.sgpSupabaseSdk="1";
  s.onload=()=>window.supabase?.createClient?resolve(window.supabase):reject(new Error("El SDK cargó pero createClient no quedó disponible."));
  s.onerror=()=>reject(new Error("No fue posible cargar "+source));
  document.head.appendChild(s);
 });
}

function loadLocalSupabase(){
 if(window.supabase?.createClient)return Promise.resolve(window.supabase);
 if(localSdkPromise)return localSdkPromise;
 localSdkPromise=(async()=>{
  let lastError=null;
  for(const source of SUPABASE_SDK_SOURCES){
   try{
    const sdk=await loadScript(source);
    console.info("SGP ONE · SDK Supabase cargado desde:",source);
    return sdk;
   }catch(error){
    lastError=error;
    console.warn("SGP ONE · fuente SDK no disponible:",source,error);
   }
  }
  throw new Error("No fue posible cargar el cliente de Supabase desde Firebase/GitHub Pages ni desde las fuentes de respaldo."+(lastError?.message?" Detalle: "+lastError.message:""));
 })().catch(e=>{localSdkPromise=null;throw e});
 return localSdkPromise
}

export async function getSupabaseClient(){
 if(!isSupabaseConfigured())throw new Error("Supabase no está configurado.");
 if(!supabaseClientPromise){
  supabaseClientPromise=loadLocalSupabase().then(({createClient})=>{
   console.info("SGP ONE · conexión de datos: Supabase directa");
   return createClient(CONFIG.supabaseUrl,CONFIG.supabasePublishableKey,{db:{schema:"public"},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:"sgp-one-supabase-client"}})
  }).catch(e=>{supabaseClientPromise=null;throw e})
 }
 return supabaseClientPromise
}
