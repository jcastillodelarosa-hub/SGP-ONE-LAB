import {paintedRules} from '../../opt-digital/pdf-grid.js';
import {extractCoordinatePlans} from '../../opt-digital/geometric-extraction.js';
import {OptStandardFontDataFactory} from './opt-pdf-runtime.js';
const MAX_BYTES=1024*1024;
/** Original bytes only. Never render, evaluate scripts, open annotations or URLs.
 * Complete extraction or rejection; no partial document is returned. Resource and
 * operator caps are not a CPU/memory sandbox: deployment must enforce its budget.
 */
export function createOptPdfReader(pdfjs) {
 if(pdfjs?.version!=='4.10.38'||typeof pdfjs.getDocument!=='function'||!pdfjs.OPS)throw Error('OPT_PDF_ENGINE_UNSUPPORTED');
 return async bytes=>{
  if(!(bytes instanceof Uint8Array)||bytes.byteLength<5||bytes.byteLength>MAX_BYTES||new TextDecoder().decode(bytes.subarray(0,5))!=='%PDF-')throw Error('OPT_PDF_BYTES_INVALID');
  let resourceError=null;
  class StandardFontDataFactory extends OptStandardFontDataFactory {
   async fetch(request){try{return await super.fetch(request);}catch(error){resourceError=error;throw error;}}
  }
  // Nonembedded CMaps are unsupported rather than fetched or silently omitted.
  class CMapReaderFactory {async fetch(){resourceError=Error('OPT_PDF_CMAP_UNSUPPORTED');throw resourceError;}}
  const task=pdfjs.getDocument({data:bytes.slice(),StandardFontDataFactory,CMapReaderFactory,useWorkerFetch:false,isEvalSupported:false,disableFontFace:true,useSystemFonts:false,enableXfa:false,disableAutoFetch:true,disableStream:true,stopAtErrors:true,isOffscreenCanvasSupported:false,isImageDecoderSupported:false,maxImageSize:16777216});
  try{
   const pdf=await task.promise;
   if(!Number.isSafeInteger(pdf.numPages)||pdf.numPages<1||pdf.numPages>100)throw Object.assign(Error('El PDF excede 100 páginas. Se rechaza completo; no se importan partes.'),{code:'OPT_PDF_PAGE_LIMIT',status:422});
   const pages=[];let totalItems=0,totalChars=0,totalOps=0,totalPathNumbers=0;
   for(let number=1;number<=pdf.numPages;number++){
    const page=await pdf.getPage(number);
    try{
     const viewport=page.getViewport({scale:1});
     if(!Number.isFinite(viewport.width)||!Number.isFinite(viewport.height)||viewport.width<=0||viewport.height<=0||page.rotate%360!==0)throw Error('OPT_PDF_PAGE_UNSUPPORTED');
     const items=[],reader=page.streamTextContent().getReader();let complete=false;
     try{
      while(true){const chunk=await reader.read();if(chunk.done){complete=true;break;}
       if(!Array.isArray(chunk.value.items))throw Error('OPT_PDF_TEXT_INVALID');
       for(const item of chunk.value.items){
        if(++totalItems>50000||items.length>=10000||(totalChars+=(item.str?.length||0))>1000000)throw Error('OPT_PDF_TEXT_LIMIT');
        items.push(item);
       }
      }
     }finally{if(!complete)await reader.cancel();reader.releaseLock();}
     const list=await page.getOperatorList();
     if(list.fnArray.length>50000||(totalOps+=list.fnArray.length)>250000)throw Error('OPT_PDF_OPERATOR_LIMIT');
     for(let i=0;i<list.fnArray.length;i++)if(list.fnArray[i]===pdfjs.OPS.constructPath){
      const [commands,coordinates]=list.argsArray[i];
      if(commands.length>20000||coordinates.length>100000||(totalPathNumbers+=coordinates.length)>500000)throw Error('OPT_PDF_PATH_LIMIT');
     }
     if(resourceError)throw resourceError;
     pages.push({page:number,width:viewport.width,height:viewport.height,rotation:page.rotate,items,rules:paintedRules(list,pdfjs.OPS)});
    }finally{page.cleanup();}
   }
   return extractCoordinatePlans(pages);
  }finally{await task.destroy();}
 };
}
