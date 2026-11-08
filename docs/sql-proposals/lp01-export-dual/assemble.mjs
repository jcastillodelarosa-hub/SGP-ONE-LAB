// Offline only. Strip only known outer transaction wrappers, never function bodies.
import{readFile}from'node:fs/promises';
import{pathToFileURL}from'node:url';
const root=new URL('../../../',import.meta.url);
export async function assemble(){
 const order=JSON.parse(await readFile(new URL('./install-order.json',import.meta.url),'utf8'));
 const fragments=[];
 for(const path of order){
  let source=await readFile(new URL(path,root),'utf8');
  if(path.endsWith('/visibility-fragment.sql')){
   if(!source.startsWith('-- Private V4-only scope fence. The plan contains baseline/cancelled/excluded keys too.\n'))throw Error('Unknown visibility fragment header');
   if(/^BEGIN;|^COMMIT;/m.test(source))throw Error('Visibility fragment unexpectedly wrapped');
  }else{
   const header=/^((?:--[^\n]*\n)*)BEGIN;/;
   if(!header.test(source)||!source.endsWith('COMMIT;\n'))throw Error(`Unrecognized transaction wrapper: ${path}`);
   source=source.replace(header,'$1').slice(0,-'COMMIT;\n'.length);
  }
  fragments.push(`\n-- FILE ${path}\n${source}\n`);
 }
 return `BEGIN;\nSET LOCAL lock_timeout='5s';\nSET LOCAL statement_timeout='30s';\nDO $contain$BEGIN\n PERFORM 1 FROM sgp_lp_operacion.config WHERE id FOR UPDATE;\n IF (SELECT incorporar_ensamble FROM sgp_lp_operacion.config WHERE id) IS DISTINCT FROM false THEN RAISE EXCEPTION 'EXPORT_DUAL_CONTAIN_INCORPORAR_FIRST';END IF;\nEND $contain$;\n${fragments.join('')}\nCOMMIT;\n`;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.stdout.write(await assemble());
