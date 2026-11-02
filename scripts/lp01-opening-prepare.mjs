/** Offline review tool. Never reads tokens/env, connects, schedules jobs or executes ABRIR. */
import {readFile,writeFile} from 'node:fs/promises';
import {prepareOpeningBatch} from '../src/server/lp01-opening-preparation.js';
const [input,output,...extra]=process.argv.slice(2);
if(!input||!output||extra.length){process.stderr.write('Uso: node scripts/lp01-opening-prepare.mjs snapshots.json resultado.json\n');process.exitCode=2;}
else {try{const batch=await prepareOpeningBatch(JSON.parse(await readFile(input,'utf8')));await writeFile(output,JSON.stringify(batch,null,2)+'\n');process.stdout.write('PREPARATION_ONLY: '+batch.intents.length+' intenciones; 0 escrituras automáticas.\n');}catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}}
