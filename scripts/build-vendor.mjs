import { mkdir, copyFile } from "node:fs/promises";
import { dirname } from "node:path";
const files=[
 ["node_modules/@supabase/supabase-js/dist/umd/supabase.js","vendor/supabase.js"],
 ["node_modules/firebase/firebase-app.js","vendor/firebase-app.js"],
 ["node_modules/firebase/firebase-data-connect.js","vendor/firebase-data-connect.js"],
 ["node_modules/firebase/firebase-auth.js","vendor/firebase-auth.js"],
 ["node_modules/firebase/firebase-app-check.js","vendor/firebase-app-check.js"]
];
for(const [src,dst] of files){await mkdir(dirname(dst),{recursive:true});await copyFile(src,dst);console.log("vendor:",dst)}
