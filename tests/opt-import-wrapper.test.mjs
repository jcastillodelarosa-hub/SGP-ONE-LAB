// Executes the real Edge bootstrap with synthetic environment/HTTP dependencies.
// No network, credentials, PDF imports, or production data.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../supabase/functions/opt-import/index.ts',import.meta.url),'utf8');
function boot(env={SUPABASE_URL:'https://synthetic.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-private-key',SGP_OPT_ALLOWED_ORIGINS:'https://synthetic.example'}){
 const calls=[];let dependencies,clientConfig,served,originInput;
 class PostgrestClient{
  constructor(url,options){clientConfig={url,options};}
  rpc(name,args){calls.push({name,args});return {data:'synthetic-result'};}
 }
 const context={PostgrestClient,DOMParser:{},readOptPdf:()=>{},
  powerBIOrigins:value=>{originInput=value;return ['https://synthetic.example'];},
  createOptImportHandler:deps=>{dependencies=deps;return 'synthetic-handler';},
  Deno:{env:{get:name=>env[name]},serve:handler=>{served=handler;}}};
 // Remove module imports and the one TypeScript parameter annotation only.
 const executable=source.replace(/^import .*;\n/gm,'').replace('(name:string,args:object)','(name,args)');
 vm.runInNewContext(executable,context,{timeout:1000});
 return {calls,dependencies,clientConfig,served,originInput};
}
test('real opt-import bootstrap permits exactly legacy and project v2 RPCs',()=>{
 const {calls,dependencies,served}=boot();
 const names=['sgp_sesion_actual','sgp_mis_accesos','sgp_opt_import_contexto_v1','sgp_opt_importar_validado_v1','sgp_opt_import_contexto_proyecto_v2','sgp_opt_importar_proyecto_validado_v2'];
 for(const name of names){assert.equal(dependencies.rpc(name,{synthetic:true}).data,'synthetic-result');}
 assert.deepEqual(calls.map(c=>c.name),names);assert.equal(served,'synthetic-handler');
 for(const name of ['sgp_opt_importar_proyecto_validado_v3','sgp_opt_importar_proyecto_validado_v2_extra','sgp_admin',''])
  assert.throws(()=>dependencies.rpc(name,{}),/no permitida/);
 assert.equal(calls.length,names.length);
});
test('wrapper retains private service authentication and configured origins',()=>{
 const {clientConfig,dependencies,originInput}=boot();
 assert.equal(clientConfig.url,'https://synthetic.invalid/rest/v1');
 assert.equal(clientConfig.options.schema,'public');
 assert.equal(clientConfig.options.headers.apikey,'synthetic-private-key');
 assert.equal(clientConfig.options.headers.Authorization,'Bearer synthetic-private-key');
 assert.equal(originInput,'https://synthetic.example');
 assert.deepEqual(dependencies.allowedOrigins,['https://synthetic.example']);
 assert.throws(()=>boot({SUPABASE_URL:'https://synthetic.invalid'}),/Configuración servidor OPT incompleta/);
});
test('Edge configuration retains platform JWT verification independently of SGP checks',()=>{
 const config=fs.readFileSync(new URL('../supabase/config.toml',import.meta.url),'utf8');
 const section=config.match(/\[functions\.opt-import\]([^[]*)/);
 assert(section);assert.match(section[1],/^verify_jwt\s*=\s*true\s*$/m);
});
