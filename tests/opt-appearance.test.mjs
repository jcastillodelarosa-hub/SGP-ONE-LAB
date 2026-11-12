import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('native host carries SGP controls across shadow boundary and includes CSS in artifact',async()=>{
 const host=await readFile('src/modules/opt-digital.js','utf8'),css=await readFile('opt-digital/sgp-theme.css','utf8'),files=JSON.parse(await readFile('scripts/opt-artifact-files.json','utf8'));
 assert(host.includes("new URL('../../opt-digital/sgp-theme.css',import.meta.url)"));
 assert(host.includes('...styles,hostStyle,theme,shell'));assert(files.includes('opt-digital/sgp-theme.css'));
 assert(css.includes('--opt-blue:#1264c8'));assert(css.includes('button:disabled'));assert(css.includes('[aria-selected=true]'));assert(css.includes('[hidden]{display:none!important}'));
 assert(css.includes('prefers-reduced-motion'));assert(css.includes('max-width:760px'));
});
