// Read-only guide: never credits a cut or substitutes a physical profile check.
export function mountMatrixPanel(container,{api,urlApi=URL}={}){
 const doc=container.ownerDocument,make=(tag,text)=>{const el=doc.createElement(tag);if(text)el.textContent=text;return el;};
 const panel=make('section');panel.className='opt-matrix-panel';const title=make('h3','Forma del perfil'),status=make('p','Selecciona una referencia y su sistema para consultar la matriz.');status.setAttribute('role','status');
 const image=make('img');image.hidden=true;image.className='opt-matrix-preview';const meta=make('p'),open=make('button','Ampliar matriz');open.type='button';open.hidden=true;
 const dialog=make('dialog');dialog.className='opt-matrix-dialog';const dialogTitle=make('h2','Matriz de referencia'),close=make('button','Cerrar'),large=make('img'),note=make('p','Guía visual del documento fuente. Comprueba el perfil físico antes de cortar.');close.type='button';dialog.append(dialogTitle,close,large,note);dialog.setAttribute('aria-label','Matriz ampliada');
 panel.append(title,status,image,meta,open,dialog);container.append(panel);let epoch=0,disposed=false,url=null,identity='';
 const release=()=>{if(dialog.open)dialog.close();image.removeAttribute('src');large.removeAttribute('src');image.hidden=true;open.hidden=true;meta.textContent='';if(url){urlApi.revokeObjectURL(url);url=null;}};
 close.onclick=()=>{dialog.close();open.focus();};dialog.addEventListener('cancel',event=>{event.preventDefault();close.click();});open.onclick=()=>{if(url&&!dialog.open){dialog.showModal();close.focus();}};
 async function select(sistema,referencia){const key=JSON.stringify([sistema,referencia]);if(disposed||identity===key)return;identity=key;const request=++epoch;release();title.textContent=referencia?`Forma del perfil · ${referencia}`:'Forma del perfil';
  if(!sistema||!referencia){status.textContent='Selecciona una referencia y su sistema para consultar la matriz.';return;}
  if(!api){status.textContent='Biblioteca compartida de matrices no disponible.';return;}status.textContent='Consultando matriz…';
  try{const data=await api.load(sistema,referencia);if(disposed||request!==epoch)return;if(data.status!=='available'){status.textContent=data.status==='ambiguous'?'Hay varias matrices posibles. Pendiente de validar la versión; no se muestra una forma por aproximación.':'Matriz no disponible para esta referencia y sistema.';return;}
   const m=data.matrix;url=urlApi.createObjectURL(m.blob);image.src=large.src=url;image.alt=large.alt=`Matriz ${referencia}, sistema ${sistema}`;image.hidden=false;open.hidden=false;dialogTitle.textContent=`${referencia} · ${sistema}`;status.textContent='Matriz vinculada por referencia y sistema exactos.';meta.textContent=`${sistema} · Documento: ${m.revision||'sin edición identificada'} · Página ${m.page} · Fuente ${m.sourceSha256.slice(0,12)}`;
  }catch(error){if(!disposed&&request===epoch){identity='';status.textContent='No se pudo consultar la matriz: '+error.message;}}
 }
 return {select,destroy(){disposed=true;epoch++;release();panel.remove();}};
}
