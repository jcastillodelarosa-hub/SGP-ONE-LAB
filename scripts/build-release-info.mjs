import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
export const releaseLabel='LAB v359';
export function stampRelease(html,sha,date=new Date().toISOString()){
 if(!/^[a-f0-9]{40}$/.test(sha))throw new Error('A full verified commit SHA is required');
 if(Number.isNaN(Date.parse(date)))throw new Error('Invalid build date');
 const pattern=/<span\b[^>]*\bid="releaseVersion"[^>]*>[^<]*<\/span>/g;
 if([...html.matchAll(pattern)].length!==1)throw new Error('Expected one release indicator');
 return html.replace(pattern,`<span class="status" id="releaseVersion" data-release-commit="${sha}" title="Commit ${sha} · compilación ${new Date(date).toISOString()}">${releaseLabel}</span>`);
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const path=new URL('../index.html',import.meta.url);
 await writeFile(path,stampRelease(await readFile(path,'utf8'),process.env.GITHUB_SHA||''));
}
