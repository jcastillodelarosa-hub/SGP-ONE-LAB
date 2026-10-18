import { access, readFile } from "node:fs/promises";

const required=["index.html","app.js","config.js","styles.css","src/services/supabase-client.js","vendor/supabase.js"];
for(const file of required){await access(file);console.log("release: ok",file)}

const index=await readFile("index.html","utf8");
const client=await readFile("src/services/supabase-client.js","utf8");
const workflow=await readFile(".github/workflows/firebase-hosting.yml","utf8");
const pkg=JSON.parse(await readFile("package.json","utf8"));

const fail=(message)=>{throw new Error("Release bloqueado: "+message)};
if(!index.includes("LAB v272"))fail("index.html no identifica LAB v272");
if(!client.includes("./vendor/supabase.js"))fail("el cliente no usa el SDK local empaquetado");
if(/cdn\.jsdelivr\.net|unpkg\.com|sgp-gateway|dataconnect|sql-connect/i.test(client))fail("supabase-client.js contiene rutas experimentales o CDN");
if(/build:sql|SQL Connect|Data Connect/i.test(workflow))fail("el deploy LAB contiene pasos experimentales de SQL/Data Connect");
if(Object.keys(pkg.dependencies||{}).includes("firebase"))fail("Firebase SDK no debe ser dependencia runtime del LAB");
console.log("release: LAB v272 autocontenido y listo para Firebase Hosting");
