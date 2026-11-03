/** Private artifact writer. Never print input identities/paths or echo parser errors. */
import {readFile,mkdir,writeFile,chmod} from 'node:fs/promises';
import {resolve} from 'node:path';
import {reviewOperationalScopes} from '../src/server/lp01-scope-review.js';
try{
 const [input,...rest]=process.argv.slice(2);if(!input||rest.length)throw Error();
 const result=reviewOperationalScopes(JSON.parse(await readFile(input,'utf8')));
 const directory=resolve('private/lp01-scopes');await mkdir(directory,{recursive:true,mode:0o700});await chmod(directory,0o700);
 await writeFile(resolve(directory,'review.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600});await chmod(resolve(directory,'review.json'),0o600);
 process.stdout.write('Revisión privada preparada; no se aplicaron accesos.\n');
}catch{process.stderr.write('No se pudo preparar la revisión privada. Comprueba el snapshot por un canal privado.\n');process.exitCode=1;}
