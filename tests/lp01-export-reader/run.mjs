import {readExportReconciliation} from '../../src/server/lp01-export-reader.js';
const [url,key,cut]=process.argv.slice(2);
const pool={connect:async()=>({query:async(sql,params)=>{const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sql,params})});const b=await r.json();if(b.error)throw Error(b.error);return b;},release:()=>{}})};
const first=await readExportReconciliation(pool,{key,line:'PANELES_2',stage:'EMPAQUE',expectedCut:cut});
const next=await readExportReconciliation(pool,{key,line:'PANELES_2',stage:'EMPAQUE',expectedCut:cut});
process.stdout.write(JSON.stringify({first,next}));
