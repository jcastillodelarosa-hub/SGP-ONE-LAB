/** Approved Vidrio status palette. Pure read-only projection of existing quantities. */
export const glassStates=Object.freeze({
 prepared:{label:'Preparado',plural:'Preparados',color:'#14834f',text:'#ffffff',source:'preparadas'},
 novelty:{label:'Novedad',plural:'Novedad',color:'#ffe276',text:'#654b00',source:'novedad'},
 transfer:{label:'Traslado',plural:'Traslado',color:'#f89b32',text:'#6c3900',source:'traslado'},
 others:{label:'Otros',plural:'Otros',color:'#e84545',text:'#ffffff',source:'otros'}
});
const positive=v=>{const n=Number(v);return Number.isFinite(n)?Math.max(0,n):0};
export function glassStateQuantity(row,mode='all'){
 if(mode==='all')return positive(row.unidades);
 if(mode==='others')return Math.max(0,positive(row.unidades)-positive(row.preparadas)-positive(row.novedad)-positive(row.traslado));
 return positive(row[glassStates[mode]?.source||'preparadas']);
}
export function glassInsightQuantity(insight,mode='all'){return positive(insight?.[mode==='all'?'total':glassStates[mode]?mode:'prepared']);}
export function glassRackAppearance(insight,mode='all'){
 const states=Object.keys(glassStates).filter(key=>(mode==='all'||key===mode)&&glassInsightQuantity(insight,key)>0);
 if(states.length===1){const value=glassStates[states[0]];return {fill:value.color,text:value.text,label:value.label,states};}
 return {fill:'#ffffff',text:'#163457',label:states.length?'Mixto':'Sin cantidad',states};
}
