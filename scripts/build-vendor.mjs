import { mkdir, copyFile } from "node:fs/promises";
import { dirname } from "node:path";
const files=[
 ["node_modules/@supabase/supabase-js/dist/umd/supabase.js","vendor/supabase.js"]
];
for(const [src,dst] of files){await mkdir(dirname(dst),{recursive:true});await copyFile(src,dst);console.log("vendor:",dst)}
