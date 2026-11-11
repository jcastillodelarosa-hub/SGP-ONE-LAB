// Imported bytes never become a navigation URL, HTML, annotation or executable document.
const MAX_BYTES=30*1024*1024;
export const PDF_READ_OPTIONS=Object.freeze({isEvalSupported:false,maxImageSize:16000000});
export async function validatedPdfBytes(file) {
  if(!file||file.size>MAX_BYTES)throw Error('PDF ausente o mayor a 30 MB');
  if(!['','application/pdf','application/octet-stream'].includes(String(file.type||'').toLowerCase()))throw Error('Tipo de archivo incompatible con PDF');
  const bytes=new Uint8Array(await file.arrayBuffer()),head=new TextDecoder('ascii').decode(bytes.subarray(0,16)),tail=new TextDecoder('ascii').decode(bytes.subarray(Math.max(0,bytes.length-2048)));
  if(!/^%PDF-(?:1\.[0-7]|2\.0)[\r\n]/.test(head)||! /%%EOF\s*$/.test(tail))throw Error('Contenido PDF inválido: cabecera o cierre no reconocido');
  return bytes;
}
let loader;
export function pdfLibrary(){return loader??=import('../vendor/opt-pdf/pdf.min.mjs').then(lib=>{lib.GlobalWorkerOptions.workerSrc=new URL('../vendor/opt-pdf/pdf.worker.min.mjs',import.meta.url).href;return lib;}).catch(()=>{loader=null;throw Error('Lector PDF local ausente: ejecutar build:opt-vendor');});}
export function createPdfView({canvas,message,previous,next,position}) {
  let generation=0,task=null,render=null,doc=null,pageNumber=1;
  function clear(){generation++;render?.cancel();render=null;const old=task;task=null;doc=null;old?.destroy().catch(()=>{});canvas.width=canvas.height=0;previous.disabled=next.disabled=true;position.textContent='';}
  async function draw(target,operation=generation){
    if(!doc||operation!==generation)return;
    previous.disabled=next.disabled=true;
    try{
      render?.cancel();const page=await doc.getPage(target);if(operation!==generation)return;
      const natural=page.getViewport({scale:1});if(!Number.isFinite(natural.width*natural.height)||natural.width<=0||natural.height<=0)throw Error('Tamaño de página inválido');
      const scale=Math.min(1.5,Math.sqrt(6000000/(natural.width*natural.height)),8192/natural.width,8192/natural.height),viewport=page.getViewport({scale});
      canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      render=page.render({canvasContext:canvas.getContext('2d'),viewport});await render.promise;if(operation!==generation)return;
      pageNumber=target;position.textContent=`Página ${target} de ${doc.numPages}`;canvas.setAttribute('aria-label',position.textContent+' del PDF; consulte el texto extraído debajo');message.textContent='Vista de lectura del PDF. Enlaces, formularios y acciones no se activan. Las imágenes mayores de 16 megapíxeles pueden omitirse; comprueba el original fuera de esta vista.';
      previous.disabled=target===1;next.disabled=target===doc.numPages;
    }catch(error){if(operation===generation&&error.name!=='RenderingCancelledException')message.textContent='No se pudo mostrar la página: '+error.message;}
  }
  previous.onclick=()=>draw(pageNumber-1);next.onclick=()=>draw(pageNumber+1);
  return {clear,async open(file){clear();const operation=generation;message.textContent='Validando PDF…';try{const bytes=await validatedPdfBytes(file),lib=await pdfLibrary();if(operation!==generation)return;task=lib.getDocument({...PDF_READ_OPTIONS,data:bytes});doc=await task.promise;if(operation!==generation)return;if(doc.numPages>500)throw Error('PDF fuera del límite de 500 páginas');await draw(1,operation);}catch(error){if(operation===generation){clear();message.textContent='Vista bloqueada: '+error.message;}}}};
}
