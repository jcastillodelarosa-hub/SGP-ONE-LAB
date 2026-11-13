// Executes the exact browser setup fixture through real adapters; no browser/network/session.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom');
(async()=>{
 const source=fs.readFileSync(path.join(__dirname,'rounding-warning-browser.cjs'),'utf8');
 const setup=source.match(/await page\.evaluate\(async\(\)=>\{([\s\S]*?)\n \}\);/)[1].replace(/import\('(\/[^']+)'\)/g,(_,file)=>`import('${pathToFileURL(path.join(__dirname,'../..',file))}')`);
 const dom=new JSDOM('<main><div id="imports"></div><div id="shared"></div></main>',{url:'http://127.0.0.1/fixture'});
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 await new AsyncFunction('window','document','localStorage',setup)(dom.window,dom.window.document,dom.window.localStorage);
 const document=dom.window.document;
 await document.querySelector('#optImportProcess').onclick();
 assert.equal(dom.window.writeCalls,1,document.querySelector('#optImportResults').textContent);
 assert.match(document.querySelector('#optImportResults').textContent,/Guardado en SGP/);
 assert.match(document.querySelector('#optImportResults').textContent,/No acredita cortes realizados/);
 assert.match(document.querySelector('#optImportResults [data-warning]').textContent,/no se acredita la precisión original/);
 await dom.window.remount();
 assert.match(document.querySelector('#optSharedPieces [data-warning]').textContent,/redondeo/);
 assert.match(document.querySelector('#optSharedPieces').textContent,/Pendiente/);
 await dom.window.remount();assert.ok(document.querySelector('#optSharedPieces [data-warning]'));
 assert.equal(dom.window.writeCalls,1);dom.window.roundingSharedPanel.destroy();dom.window.panel.destroy();dom.window.close();
 console.log('PASS exact browser fixture DOM: original adapter receipt, visible warning, remounted catalog, no cut writes');
})().catch(error=>{console.error(error);process.exitCode=1;});
