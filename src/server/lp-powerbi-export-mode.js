/** Deployment selector, never a browser flag. SQL independently authorizes every stage/key. */
export function powerBIExportMode(value){
 if(value===undefined||value===null||value===''||value==='LEGACY')return {exportProductionV2:false,exportWriterScope:null};
 if(value==='LP-EXPORT-DUAL-1')return {exportProductionV2:true,exportWriterScope:'LP-EXPORT-DUAL-1'};
 throw Error('Modo Export servidor LP desconocido');
}
