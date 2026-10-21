import { access, readFile } from "node:fs/promises";

const required=["index.html","app.js","config.js","styles.css","src/services/supabase-client.js","vendor/supabase.js","vendor/html2canvas.min.js","vendor/jspdf.umd.min.js"];
for(const file of required){await access(file);console.log("release: ok",file)}

const index=await readFile("index.html","utf8");
const client=await readFile("src/services/supabase-client.js","utf8");
const app=await readFile("app.js","utf8");
const workflow=await readFile(".github/workflows/firebase-hosting.yml","utf8");
const pkg=JSON.parse(await readFile("package.json","utf8"));

const fail=(message)=>{throw new Error("Release bloqueado: "+message)};
const release=index.match(/LAB v(\d+)/);
if(!release)fail("index.html no identifica una versión LAB");
const version=release[1];
const appVersion=index.match(/app\.js\?v=(\d+)/)?.[1];
const cssVersion=index.match(/styles\.css\?v=(\d+)/)?.[1];
if(appVersion!==version)fail(`app.js cache-bust v${appVersion||"?"} no coincide con LAB v${version}`);
if(cssVersion!==version)fail(`styles.css cache-bust v${cssVersion||"?"} no coincide con LAB v${version}`);
if(!client.includes("./vendor/supabase.js"))fail("el cliente no usa el SDK local empaquetado");
if(!app.includes("./vendor/html2canvas.min.js")||!app.includes("./vendor/jspdf.umd.min.js"))fail("las exportaciones no usan bibliotecas locales");
if(/cdn\\.jsdelivr\\.net\\/npm\\/(html2canvas|jspdf)/i.test(app))fail("la exportación todavía depende del CDN");
if(/cdn\.jsdelivr\.net|unpkg\.com|sgp-gateway|dataconnect|sql-connect/i.test(client))fail("supabase-client.js contiene rutas experimentales o CDN");
if(/build:sql|SQL Connect|Data Connect/i.test(workflow))fail("el deploy LAB contiene pasos experimentales de SQL/Data Connect");
if(Object.keys(pkg.dependencies||{}).includes("firebase"))fail("Firebase SDK no debe ser dependencia runtime del LAB");
console.log(`release: LAB v${version} autocontenido y listo para Firebase Hosting`);
