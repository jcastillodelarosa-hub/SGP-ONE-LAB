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

export async function getSupabaseClient(){
 if(!isSupabaseConfigured())throw new Error("Supabase no está configurado.");
 if(!supabaseClientPromise){
  supabaseClientPromise=loadLocalSupabase().then(({createClient})=>createClient(CONFIG.supabaseUrl,CONFIG.supabasePublishableKey,{db:{schema:"public"},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:"sgp-one-supabase-client"}})).catch(e=>{supabaseClientPromise=null;throw e})
 }
 return supabaseClientPromise
}
