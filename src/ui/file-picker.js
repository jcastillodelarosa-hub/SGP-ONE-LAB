/**
 * LAB v313 — Selector XLSX compacto.
 * Solo se presenta el FileList del input original: el importador y sus
 * validadores siguen leyendo exactamente el mismo input de siempre.
 */
export function fileSelectionLabel(files){
 const names=Array.from(files||[],file=>String(file?.name||'').trim()).filter(Boolean);
 if(!names.length)return 'Sin archivos seleccionados';
 if(names.length===1)return names[0];
 const preview=names.slice(0,2).join(' · ');
 const extra=names.length-2;
 return names.length+' archivos seleccionados: '+preview+(extra?' · y '+extra+' más':'');
}
export function fileSizeLabel(bytes){
 if(!Number.isFinite(bytes)||bytes<0)return 'Tamaño no disponible';
 if(bytes>=1024*1024)return (bytes/(1024*1024)).toFixed(1)+' MB';
 if(bytes>=1024)return Math.round(bytes/1024)+' KB';
 return bytes+' B';
}
export function selectedFileCountLabel(count){
 if(!count)return 'Sin archivos seleccionados';
 return '✓ '+count+' archivo'+(count===1?' seleccionado':'s seleccionados');
}
/**
 * Quitar una fila (también en selección múltiple) y emitir change para
 * invalidar cualquier previsualización previa en el módulo importador.
 * En navegadores sin DataTransfer se elimina la selección completa.
 */
export function removeSelectedFile(input,index,DataTransferCtor=typeof DataTransfer==='function'?DataTransfer:null){
 const files=Array.from(input?.files||[]);
 if(!Number.isInteger(index)||index<0||index>=files.length)return false;
 if(files.length===1||!DataTransferCtor){
  input.value='';
 }else{
  try{
   const transfer=new DataTransferCtor();
   files.forEach((file,i)=>{if(i!==index)transfer.items.add(file)});
   input.files=transfer.files;
  }catch{
   input.value='';
  }
 }
 input.dispatchEvent(new Event('change',{bubbles:true}));
 return true;
}
function fileCard(doc,file,index,input){
 const card=doc.createElement('span');
 card.className='sgp-file-card';
 card.setAttribute('role','listitem');
 const icon=doc.createElement('span');
 icon.className='sgp-file-excel';
 icon.setAttribute('aria-hidden','true');
 const details=doc.createElement('span');
 details.className='sgp-file-details';
 const name=doc.createElement('strong');
 name.className='sgp-file-name';
 name.textContent=String(file?.name||'Archivo XLSX');
 name.title=name.textContent;
 const size=doc.createElement('small');
 size.className='sgp-file-size';
 size.textContent=fileSizeLabel(file?.size)+' · XLSX';
 details.append(name,size);
 const remove=doc.createElement('button');
 remove.type='button';
 remove.className='sgp-file-remove';
 remove.textContent='×';
 remove.setAttribute('aria-label','Quitar '+name.textContent);
 remove.addEventListener('click',event=>{
  event.preventDefault();
  event.stopPropagation();
  removeSelectedFile(input,index);
 });
 card.append(icon,details,remove);
 return card;
}
export function initFilePickers(root=document){
 root.querySelectorAll('.sgp-file-picker input[type="file"]').forEach(input=>{
  if(input.dataset.sgpFilePickerReady==='1')return;
  const picker=input.parentElement;
  const status=picker?.querySelector('.sgp-file-selection');
  const cards=picker?.querySelector('.sgp-file-selected');
  if(!status||!cards)return;
  const initialAriaLabel=input.getAttribute?.('aria-label')||'Seleccionar archivo XLSX';
  const refresh=()=>{
   const files=Array.from(input.files||[]);
   picker.dataset.hasFiles=files.length?'true':'false';
   status.textContent=selectedFileCountLabel(files.length);
   cards.hidden=!files.length;
   const doc=input.ownerDocument||(typeof document==='undefined'?null:document);
   if(doc)cards.replaceChildren(...files.map((file,index)=>fileCard(doc,file,index,input)));
   if(input.setAttribute)input.setAttribute('aria-label',files.length?
    (input.multiple?'Cambiar archivos seleccionados':'Cambiar archivo seleccionado'):initialAriaLabel);
  };
  input.addEventListener('change',refresh);
  input.dataset.sgpFilePickerReady='1';
  refresh();
 });
}
