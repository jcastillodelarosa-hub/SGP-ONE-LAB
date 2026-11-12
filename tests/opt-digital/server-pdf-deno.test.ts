import { readOptPdf } from '../../supabase/functions/opt-import/pdf-runtime.ts';
import { OptStandardFontDataFactory } from '../../src/server/opt-pdf-runtime.js';
import { thirtySeconds } from '../../opt-digital/geometric-extraction.js';
import { Buffer } from 'node:buffer';
import syntheticPdf from './synthetic-pdf.cjs';
function check(value: unknown, message: string) { if (!value) throw Error(message); }
Deno.test('real PDF.js Deno: complete bytes, bundled fonts, inert actions, exact fractions', async () => {
 const originalFetch=globalThis.fetch;
 let requests=0;
 globalThis.fetch=(() => { requests++; throw Error('Unexpected runtime network'); }) as typeof fetch;
 try {
  const bytes=new Uint8Array(syntheticPdf()),before=Buffer.from(bytes);
  const result=await readOptPdf(bytes);
  check(result.pdfPages===2,'Must read all pages');
  check(result.productionEnabled===false&&result.plans.length===0,'Must not invent production plans');
  check(before.equals(Buffer.from(bytes)),'Must not transfer/detach source buffer');
  check(!(globalThis as unknown as {__optFrameExecuted?:boolean}).__optFrameExecuted,'PDF script executed');
  check(requests===0,'Must not fetch fonts, worker, PDF annotations or URLs');
  const font=await new OptStandardFontDataFactory().fetch({filename:'LiberationSans-Regular.ttf'});
  check(font.length>100000,'Bundled real font missing');
  for(const filename of ['../x','https://example.invalid/x','toString']) {
   let rejected=false;try{await new OptStandardFontDataFactory().fetch({filename});}catch{rejected=true;}
   check(rejected,'Unknown font must fail closed');
  }
  check(thirtySeconds('30 1/32"')===961,'Exact thirty-second lost');
  check(thirtySeconds('30 1/3"')===null,'Unsupported fraction rounded');
 } finally { globalThis.fetch=originalFetch; }
});
