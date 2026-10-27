/** Local file adapter only. Does not read config, credentials, data or services. */
import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {reviewSourceEvidence} from '../../src/server/linea-source-evidence-review.js';
const input=new URL('../../docs/linea-etapa2f/CONFIRMACIONES_CHATGPT.json',import.meta.url),data=await readFile(input);
const result=reviewSourceEvidence(JSON.parse(data));
const out={generatedAtUtc:new Date().toISOString(),input:'docs/linea-etapa2f/CONFIRMACIONES_CHATGPT.json',inputSha256:createHash('sha256').update(data).digest('hex'),result};
await writeFile(new URL('../../tests/linea-stage2f/evidence/review.json',import.meta.url),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({reportedFunctions:result.functions.length,reportedRelations:result.relations.length,status:result.status,certificationComplete:result.certificationComplete,available:result.available}));
