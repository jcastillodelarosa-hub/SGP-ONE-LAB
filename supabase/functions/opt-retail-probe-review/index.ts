// REVIEW ONLY: new function in OPT-SANDBOX; never replace opt-import.
import {DOMParser} from 'npm:@xmldom/xmldom@0.9.12';
import {SaxesParser} from 'npm:saxes@6.0.0';
import {createWorksheetXMLReader} from '../../../src/server/opt-worksheet-stream.js';
import {createOptImportProbe} from '../../../src/server/opt-import-probe.js';
import {readOptPdf} from '../opt-import/pdf-runtime.ts';
const secret=Deno.env.get('OPT_PROBE_SECRET');
// No database client or service-role key. Dependencies load before runtime network prohibition.
globalThis.fetch=(()=>{throw Error('PROBE_NETWORK_DENIED');}) as typeof fetch;
Deno.serve(createOptImportProbe({secret,DOMParser,readPdf:readOptPdf,readWorksheetXML:createWorksheetXMLReader(SaxesParser)}));
