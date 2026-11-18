import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=name=>readFileSync(new URL('../docs/sql-proposals/opt-shared/'+name,import.meta.url),'utf8');
test('V4 proposals create new contracts without modifying V3 or granting browser writes',()=>{
 for(const name of ['import_context_retail_v4_REVIEW.sql','import_channel_retail_v4_REVIEW.sql']){
  const text=sql(name);
  assert(!/CREATE OR REPLACE/i.test(text));assert(!/CREATE FUNCTION[^\n]*_v3\(/.test(text));
  assert(!/s->>'sistema'\s*=\s*p\.sistema/.test(text));
  assert(text.includes("s->>'reserva'=r.reserva"));assert(text.includes("s->>'produccion'=p.produccion"));
  assert(text.includes('TO service_role'));assert(!/GRANT EXECUTE[^;]*TO (?:anon|authenticated)/i.test(text));
 }
 const context=sql('import_context_retail_v4_REVIEW.sql');assert(context.includes("'sistema',p.sistema"));assert(context.includes('OPT-IMPORT-CONTEXT-RETAIL-4'));
 const writer=sql('import_channel_retail_v4_REVIEW.sql');assert(writer.includes("b->>'sistema'=piece#>>'{asignacion,sistema}'"));assert(writer.includes('OPT-SERVER-VALIDATION-RETAIL-4'));
});
test('V4 bootstrap stays isolated from previous writers and recovery',()=>{
 const endpoint=readFileSync(new URL('../supabase/functions/opt-retail-import-v4-review/index.ts',import.meta.url),'utf8');
 assert(endpoint.includes('retailReservationOnly:true'));assert(endpoint.includes('retailOnly:true'));
 assert(endpoint.includes('sgp_opt_import_contexto_retail_v4'));assert(endpoint.includes('sgp_opt_importar_retail_validado_v4'));
 assert(!endpoint.includes('sgp_opt_importar_retail_resuelto'));assert(!endpoint.includes('retailResolution:true'));
 const oldEndpoint=readFileSync(new URL('../supabase/functions/opt-retail-import-v3-review/index.ts',import.meta.url),'utf8');
 assert(!oldEndpoint.includes('retailReservationOnly'));
});
