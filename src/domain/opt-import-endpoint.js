// Routing only, no authority. No automatic fallback after a transport failure.
export function optImportEndpoint(source,{retailMode='legacy'}={}){
 if(source?.origin!=='RETAIL'||source?.mode!=='INDICE')return 'opt-import';
 if(retailMode==='candidate')return 'opt-retail-import-v3';
 if(retailMode==='legacy')return 'opt-import';
 // Unknown configuration fails closed as well as explicit rollback pause.
 return null;
}
