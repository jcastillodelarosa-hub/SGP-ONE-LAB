// Reviewed retirement artifact for opt-retail-import-v3 ONLY. Not deployed.
// No credentials, body parsing, imports, database calls or outbound requests.
export function retiredRetail(request){
 const headers={'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'authorization, apikey, content-type, x-client-info','access-control-allow-methods':'POST, OPTIONS','cache-control':'no-store'};
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 return new Response(JSON.stringify({contract:'OPT-IMPORT-1',ok:false,code:'OPT_RETAIL_PAUSADO',error:'La carga Retail está deshabilitada. No se procesó este intento. Conserva los archivos y verifica cualquier carga anterior pendiente.',definitive:true}),{status:503,headers});
}
