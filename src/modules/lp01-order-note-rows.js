import {mountOrderNote} from './lp01-order-note.js';
const owners=new WeakMap();
/** Reuse the order-note editor and its CAS command; retain DOM through quiet renders. */
export function retainOrderNoteRows(host,provider,orders){
 let entry=owners.get(host);
 if(entry?.provider!==provider){entry?.cells.forEach(c=>c.dispose());entry={provider,cells:new Map()};owners.set(host,entry);}
 const allowed=new Set(orders.map(r=>r.key));
 for(const [key,c] of entry.cells)if(!provider||!allowed.has(key)){c.dispose();entry.cells.delete(key);}
 const focused=document.activeElement,savedFocus=[...entry.cells.values()].some(c=>c.node.contains(focused))?focused:null;
 const modals=[...entry.cells.values()].map(c=>c.node.querySelector('dialog:modal')).filter(Boolean);
 // Explicitly leave the top layer before detaching, including rows parked by filters.
 modals.forEach(dialog=>dialog.close());
 const fragment=document.createDocumentFragment();entry.cells.forEach(c=>fragment.append(c.node));
 return ()=>{
  const parked=document.createElement('div');parked.hidden=true;parked.dataset.noteParked='';host.append(parked);
  host.querySelectorAll('[data-note-order-key]').forEach(slot=>{
   const key=slot.dataset.noteOrderKey,row=orders.find(r=>r.key===key);if(!row)return;
   if(!provider){slot.textContent='Observación no disponible';return;}
   let cell=entry.cells.get(key);
   if(!cell){cell=createCell(row,provider);entry.cells.set(key,cell);}
   slot.append(cell.node);cell.update(row.orderDetails);
  });
  entry.cells.forEach(c=>{if(!host.contains(c.node))parked.append(c.node);});
  modals.forEach(dialog=>{if(dialog.isConnected&&!parked.contains(dialog)){dialog.showModal();}});
  if(savedFocus?.isConnected&&!parked.contains(savedFocus))savedFocus.focus({preventScroll:true});
 };
}
/** Preview refreshes never replace a modal or its draft/revision. */
export function paintOrderNoteRows(host,key,details){owners.get(host)?.cells.get(key)?.update(details);}
function createCell(row,provider){
 const node=document.createElement('div');node.className='lp-order-note-compact';
 node.innerHTML='<button type="button" class="lp-order-note-preview" data-order-note-open><span data-order-note-preview></span><small data-order-note-action>Editar</small></button>';
 const button=node.querySelector('button'),preview=node.querySelector('[data-order-note-preview]'),action=node.querySelector('[data-order-note-action]');
 let revision=-1,disposeEditor=null,dialog=null,disposed=false;
 const setText=(el,text)=>{if(el.textContent!==text)el.textContent=text;};
 function update(details){
  // A slow background read must not replace the just-confirmed note preview.
  if(details&&details.note.revision<revision)return;
  if(details)revision=details.note.revision;
  const text=details===undefined?'Consultando observación…':details===null?'Observación no disponible':details.note.observation||'Sin observación';
  setText(preview,text);setText(action,details===null?'Reintentar':details?.capabilities.includes('NOTE')?'Editar':'Consultar');
  button.title=text;button.setAttribute('aria-label','Observación de '+row.produccion+': '+text+'. '+action.textContent);
 }
 const close=()=>{dialog?.close();disposeEditor?.();disposeEditor=null;dialog?.remove();dialog=null;button.focus({preventScroll:true});};
 button.onclick=()=>{
  if(disposed||!node.isConnected)return;
  if(dialog){dialog.showModal();dialog.querySelector('textarea')?.focus();return;}
  const transport=provider(row.key);if(!transport.isCurrent()){update(null);return;}
  dialog=document.createElement('dialog');dialog.className='lp-order-note-dialog';dialog.setAttribute('aria-label','Observación de '+row.produccion);
  const title=document.createElement('p');title.className='lp-order-note-identity';title.textContent=row.produccion+' · '+(row.oficial?.reserva_al||row.key);dialog.append(title);
  const editorHost=document.createElement('section');editorHost.className='lp-order-note';dialog.append(editorHost);node.append(dialog);dialog.showModal();
  const publish=details=>{update(details);transport.onDetails?.(details);};
  disposeEditor=mountOrderNote(editorHost,transport,{onRead:publish,onSaved:update,onCancel:close});
  dialog.addEventListener('cancel',event=>{event.preventDefault();editorHost.querySelector('[data-order-note-cancel]')?.click();});
 };
 return {node,update,dispose(){disposed=true;disposeEditor?.();dialog?.close();node.remove();}};
}
