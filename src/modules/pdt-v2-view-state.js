/** Preserve user context, never retain a stale next stage or resubmit a saved quantity. */
const fields=['data-date','data-shift','data-note','data-movement','data-pick-event','data-pick-detail','data-pick-line','data-pick-qty','data-annul-note','data-ncs'];
export function capturePdtView(modal,details=[]){
 const values={};for(const field of fields){const node=modal.querySelector('['+field+']');if(node)values[field]=node.value;}
 const quantities={};modal.querySelectorAll('[data-advance-qty]').forEach(input=>{const detail=details[Number(input.dataset.advanceQty)];if(detail)quantities[detail.id_detalle]=input.value;});
 const active=document.activeElement;let focus=null;
 if(active?.hasAttribute('data-advance-qty'))focus={detail:details[Number(active.dataset.advanceQty)]?.id_detalle};
 else if(active){for(const field of [...fields,'data-operation','data-pdt-tab'])if(active.hasAttribute(field)){focus={field,value:active.getAttribute(field)};break;}}
 return {values,quantities,focus,section:modal.querySelector('[data-pdt-tab][aria-selected=true]')?.dataset.pdtTab||'distribution',open:[...modal.querySelectorAll('[data-pdt-panel][open]')].map(panel=>panel.dataset.pdtPanel),bodyScroll:modal.querySelector('.repo-work-body')?.scrollTop||0,scroll:modal.scrollTop};
}
export async function restorePdtView(modal,state,details=[]){
 if(!state)return;
 for(const [field,value] of Object.entries(state.values)){const node=modal.querySelector('['+field+']');if(node&&(!(node instanceof HTMLSelectElement)||[...node.options].some(option=>option.value===value)))node.value=value;}
 modal.querySelectorAll('[data-advance-qty]').forEach(input=>{const id=details[Number(input.dataset.advanceQty)]?.id_detalle;if(id in state.quantities)input.value=state.quantities[id];});
 modal.querySelectorAll('[data-pdt-panel]').forEach(panel=>panel.open=state.open.includes(panel.dataset.pdtPanel));
 let focus;
 if(state.focus?.detail)focus=[...modal.querySelectorAll('[data-advance-qty]')].find(input=>details[Number(input.dataset.advanceQty)]?.id_detalle===state.focus.detail);
 else if(state.focus?.field)focus=[...modal.querySelectorAll('['+state.focus.field+']')].find(node=>node.getAttribute(state.focus.field)===state.focus.value);
 if(focus&&!focus.disabled)focus.focus({preventScroll:true});
 await new Promise(resolve=>requestAnimationFrame(resolve));
 const body=modal.querySelector('.repo-work-body');if(body)body.scrollTop=state.bodyScroll;modal.scrollTop=state.scroll;
}
