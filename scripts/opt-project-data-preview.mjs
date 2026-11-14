// Local read-only metadata preparation. Never calls SGP or writes operational data.
import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {paintedRules} from '../opt-digital/pdf-grid.js';
import {extractCoordinatePlans} from '../opt-digital/geometric-extraction.js';
import {extractOptProjectData} from '../opt-digital/project-data-extraction.js';
const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('Usage: node scripts/opt-project-data-preview.mjs input.pdf output.json');
const bytes=await readFile(input);if(bytes.length>1024*1024)throw Error('PDF exceeds 1 MiB preview limit');
const pdf=await getDocument({data:new Uint8Array(bytes),isEvalSupported:false,disableFontFace:true}).promise;
try{
 if(pdf.numPages>100)throw Error('PDF exceeds 100 page preview limit');
 const pages=[];for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n),v=page.getViewport({scale:1});pages.push({page:n,width:v.width,height:v.height,rotation:page.rotate,items:(await page.getTextContent()).items,rules:paintedRules(await page.getOperatorList(),OPS)});}
 const extraction=extractCoordinatePlans(pages),projectData=extractOptProjectData(pages,extraction.sourceProjectRows);
 const record={status:'LOCAL_METADATA_PREVIEW_NOT_IMPORTED',pdfSha256:createHash('sha256').update(bytes).digest('hex'),projectData};
 await writeFile(output,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:record.status,pdfSha256:record.pdfSha256,rows:projectData?.rows.length??null,quantity:projectData?.totalQuantity??null}));
}finally{await pdf.destroy();}
