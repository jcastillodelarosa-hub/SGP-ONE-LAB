import {mkdir, copyFile} from 'node:fs/promises';
const target=new URL('../vendor/opt-pdf/',import.meta.url);
await mkdir(target,{recursive:true});
for(const name of ['pdf.min.mjs','pdf.worker.min.mjs']) await copyFile(new URL('../node_modules/pdfjs-dist/build/'+name,import.meta.url),new URL(name,target));
