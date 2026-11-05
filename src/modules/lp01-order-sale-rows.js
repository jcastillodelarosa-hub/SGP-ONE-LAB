import {mountOrderSaleCell} from './lp01-order-sale-cell.js';
const owners=new WeakMap(),MAX_READS=4;
/** Keep editors and pending commands across quiet renders; read visible rows with bounded concurrency. */
export function retainOrderSaleRows(host,provider,authorizedKeys){
 let entry=owners.get(host);
 if(entry?.provider!==provider){entry?.observer?.disconnect();entry?.cells.forEach(c=>c.dispose?.());entry={provider,cells:new Map(),queue:[],active:0};owners.set(host,entry);}
 const allowed=new Set(authorizedKeys);
 for(const [key,c] of entry.cells){if(!allowed.has(key)||!provider){entry.observer?.unobserve(c.node);c.dispose?.();c.node.remove();entry.cells.delete(key);}}
 const focused=document.activeElement,savedFocus=[...entry.cells.values()].some(c=>c.node.contains(focused))?focused:null;
 // Moving a modal dialog through a detached fragment removes it from the top layer.
 // Reopen the same node after reattachment so a quiet render preserves the editor and focus.
 const modalDialogs=[...entry.cells.values()].map(c=>c.node.querySelector('dialog:modal')).filter(Boolean);
 const fragment=document.createDocumentFragment();entry.cells.forEach(c=>fragment.append(c.node));
 const pump=()=>{
  while(entry.active<MAX_READS&&entry.queue.length){
   const c=entry.queue.shift();if(!c||c.status!=='queued'||!c.node.isConnected||owners.get(host)!==entry)continue;
   c.status='loading';entry.active++;
   Promise.resolve().then(()=>provider(c.key)).then(t=>mountOrderSaleCell(c.node,t)).then(dispose=>{if(owners.get(host)===entry&&entry.cells.get(c.key)===c){c.dispose=dispose;c.status='mounted';}else dispose?.();}).catch(()=>{if(c.node.isConnected&&owners.get(host)===entry){c.node.innerHTML='<button type="button" data-sale-try aria-label="No se pudo consultar Disponible. Reintentar" title="No se pudo consultar Disponible. Reintentar">Error · ↻</button>';c.node.querySelector('[data-sale-try]').onclick=()=>{c.status='idle';queue(c);};}}).finally(()=>{entry.active--;pump();});
  }
 };
 const queue=c=>{if(c.status!=='idle')return;c.status='queued';entry.queue.push(c);pump();};
 if(!entry.observer&&typeof IntersectionObserver!=='undefined')entry.observer=new IntersectionObserver(items=>items.forEach(item=>{if(item.isIntersecting){const c=entry.cells.get(item.target.dataset.saleCellKey);if(c)queue(c);}}),{rootMargin:'120px'});
 return ()=>{
  if(!provider)return;
  const parked=document.createElement('div');parked.hidden=true;parked.dataset.saleParked='';host.append(parked);
  host.querySelectorAll('[data-sale-order-key]').forEach(slot=>{
   const key=slot.dataset.saleOrderKey;if(!allowed.has(key))return;
   let c=entry.cells.get(key);
   if(c&&c.status==='mounted'&&!c.node.childElementCount){c.dispose?.();entry.observer?.unobserve(c.node);entry.cells.delete(key);c=null;}
   if(!c){const node=document.createElement('div');node.className='lp-sale-row';node.dataset.saleCellKey=key;node.textContent='Consultando disponible…';c={key,node,status:'idle'};entry.cells.set(key,c);}
   slot.append(c.node);if(entry.observer)entry.observer.observe(c.node);else queue(c);
  });
  entry.cells.forEach(c=>{if(!host.contains(c.node))parked.append(c.node);});
  modalDialogs.forEach(dialog=>{if(dialog.isConnected&&!parked.contains(dialog)){dialog.close();dialog.showModal();}});
  if(savedFocus?.isConnected&&!parked.contains(savedFocus))savedFocus.focus({preventScroll:true});
 };
}
