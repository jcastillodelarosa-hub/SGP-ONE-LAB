import { mkdir, copyFile, access } from "node:fs/promises";
import { dirname } from "node:path";

const files=[
 ["node_modules/@supabase/supabase-js/dist/umd/supabase.js","vendor/supabase.js"],
 ["node_modules/html2canvas/dist/html2canvas.min.js","vendor/html2canvas.min.js"],
 ["node_modules/jspdf/dist/jspdf.umd.min.js","vendor/jspdf.umd.min.js"]
];

for(const [src,dst] of files){
 await mkdir(dirname(dst),{recursive:true});
 await copyFile(src,dst);
 await access(dst);
 console.log("vendor:",dst);
}
