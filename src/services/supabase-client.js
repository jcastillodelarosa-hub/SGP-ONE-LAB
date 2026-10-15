const CONFIG = window.SGP_CONFIG || {};
let supabaseClientPromise = null;
let localSdkPromise = null;

export function isSupabaseConfigured(){return Boolean(CONFIG.supabaseUrl&&CONFIG.supabasePublishableKey)}

function loadLocalSupabase(){
 if(window.supabase?.createClient)return Promise.resolve(window.supabase);
 if(localSdkPromise)return localSdkPromise;
 localSdkPromise=new Promise((resolve,reject)=>{
  const existing=document.querySelector('script[data-sgp-supabase-sdk]');
  const done=()=>window.supabase?.createClient?resolve(window.supabase):reject(new Error("El cliente local de Supabase no quedó disponible."));
  if(existing){existing.addEventListener('load',done,{once:true});existing.addEventListener('error',()=>reject(new Error("No fue posible cargar /vendor/supabase.js desde Firebase.")),{once:true});return}
  const s=document.createElement('script');s.src='/vendor/supabase.js';s.async=true;s.dataset.sgpSupabaseSdk='1';s.onload=done;s.onerror=()=>reject(new Error("No fue posible cargar /vendor/supabase.js desde Firebase."));document.head.appendChild(s)
 }).catch(e=>{localSdkPromise=null;throw e});
 return localSdkPromise
}

async function resolveSupabaseUrl(){
 try{
  const r=await fetch("/sgp-gateway/",{method:"GET",cache:"no-store",signal:AbortSignal.timeout(5000)});
  if(r.ok&&String(r.headers.get("content-type")||"").includes("application/json")){
   const d=await r.json();
   if(d?.service==="sgp-gateway")return location.origin+"/sgp-gateway";
  }
 }catch(e){console.warn("SGP ONE · gateway no disponible; usando conexión directa.",e)}
 return CONFIG.supabaseUrl;
}

export async function getSupabaseClient(){
 if(!isSupabaseConfigured())throw new Error("Supabase no está configurado.");
 if(!supabaseClientPromise){
  supabaseClientPromise=Promise.all([loadLocalSupabase(),resolveSupabaseUrl()]).then(([{createClient},url])=>{
   console.info("SGP ONE · conexión de datos:",url.includes("/sgp-gateway")?"Firebase Gateway":"Supabase directa");
   return createClient(url,CONFIG.supabasePublishableKey,{db:{schema:"public"},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:"sgp-one-supabase-client"}})
  }).catch(e=>{supabaseClientPromise=null;throw e})
 }
 return supabaseClientPromise
}
