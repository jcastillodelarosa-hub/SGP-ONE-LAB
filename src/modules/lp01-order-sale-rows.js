import {mountOrderSaleCell} from './lp01-order-sale-cell.js';
const owners=new WeakMap();
/** Keep actual controls and pending commands across table renders, never across scope providers. */
export function retainOrderSaleRows(host,provider,authorizedKeys){
 let entry=owners.get(host);
 if(entry?.provider!==provider){entry?.cells.forEach(cell=>cell.dispose?.());entry={provider,cells:new Map()};owners.set(host,entry);}
 const allowed=new Set(authorizedKeys);
 for(const [key,cell] of entry.cells){if(!allowed.has(key)||!provider){cell.dispose?.();cell.node.remove();entry.cells.delete(key);}}
 const focused=document.activeElement;
 const savedFocus=[...entry.cells.values()].some(c=>c.node.contains(focused))?focused:null;
 // No asynchronous gap: detach/attach within the same render, so the cell's scope guard remains valid.
 const fragment=document.createDocumentFragment();entry.cells.forEach(c=>fragment.append(c.node));
 return ()=>{
  if(!provider)return;
  const parked=document.createElement('div');parked.hidden=true;parked.dataset.saleParked='';host.append(parked);
  host.querySelectorAll('[data-sale-order-key]').forEach(slot=>{
   const key=slot.dataset.saleOrderKey;if(!allowed.has(key))return;
   let cell=entry.cells.get(key);
   if(cell&&!cell.node.childElementCount){cell.dispose?.();entry.cells.delete(key);cell=null;}
   if(!cell){
    const node=document.createElement('div');node.className='lp-sale-row';
    const button=document.createElement('button');button.type='button';button.textContent='Consultar / definir';button.setAttribute('aria-label','Consultar o definir SALE por orden');node.append(button);
    cell={node};entry.cells.set(key,cell);
    button.onclick=async()=>{
     if(owners.get(host)!==entry||!node.isConnected)return;
     button.disabled=true;
     try{const transport=provider(key);const dispose=await mountOrderSaleCell(node,transport,{compact:true});if(owners.get(host)!==entry||entry.cells.get(key)!==cell){dispose();return;}cell.dispose=dispose;}
     catch{if(node.isConnected){node.textContent='SALE por orden no disponible.';}}
    };
   }
   slot.append(cell.node);
  });
  entry.cells.forEach(c=>{if(!host.contains(c.node))parked.append(c.node);});
  if(savedFocus?.isConnected&&!parked.contains(savedFocus))savedFocus.focus({preventScroll:true});
 };
}
