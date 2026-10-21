/**
 * LAB v312 — Selector de archivos.
 * Solo presentación: el input nativo conserva accept, multiple, FileList,
 * eventos de change y los validadores/cargadores existentes.
 */
export function fileSelectionLabel(files){
 const names=Array.from(files||[],file=>String(file?.name||'').trim()).filter(Boolean);
 if(!names.length)return 'Sin archivos seleccionados';
 if(names.length===1)return names[0];
 const preview=names.slice(0,2).join(' · ');
 const extra=names.length-2;
 return names.length+' archivos seleccionados: '+preview+(extra?' · y '+extra+' más':'');
}
export function initFilePickers(root=document){
 root.querySelectorAll('.sgp-file-picker input[type="file"]').forEach(input=>{
  if(input.dataset.sgpFilePickerReady==='1')return;
  const status=input.parentElement?.querySelector('.sgp-file-selection');
  if(!status)return;
  const refresh=()=>{status.textContent=fileSelectionLabel(input.files)};
  input.addEventListener('change',refresh);
  input.dataset.sgpFilePickerReady='1';
  refresh();
 });
}
