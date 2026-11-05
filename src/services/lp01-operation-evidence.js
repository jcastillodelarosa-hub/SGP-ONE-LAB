/** Bounded reads of the deployed individual-affectation contract. No new permissions. */
export async function enrichOperationEvidence(data,rpc){
 const keys=[...new Set(data.orders.map(r=>r.key))],evidence=new Map();let cursor=0;
 await Promise.all(Array.from({length:Math.min(3,keys.length)},async()=>{
  while(cursor<keys.length){const key=keys[cursor++];
   try{
    const r=await rpc('sgp_lp_afectaciones_consultar_v2',{p_key:key,p_stage:'ENSAMBLE'});
    if(r?.contract!=='LP-AFFECTATIONS-2'||r.key!==key||r.stage!=='ENSAMBLE'||!Array.isArray(r.reports))throw Error('EVIDENCIA_NO_DISPONIBLE');
    if(r.reports.some(x=>x.originStage!=='ENSAMBLE'||!Number.isSafeInteger(x.quantity)||!Number.isSafeInteger(x.confirmed)||x.confirmed<0||x.quantity<x.confirmed))throw Error('EVIDENCIA_INVALIDA');
    const active=r.reports.some(x=>x.originStage==='ENSAMBLE'&&Number.isSafeInteger(x.quantity)&&Number.isSafeInteger(x.confirmed)&&x.quantity>x.confirmed);
    // Original Picking still pending is evidence of a material issue, not a window count.
    const picking=r.pickingPending?.status==='AVAILABLE'&&r.pickingPending.rows.some(x=>x.key===key&&x.origin==='PICKING'&&!x.linked&&x.state==='PENDIENTE');
    evidence.set(key,{status:r.pickingPending?.status==='AVAILABLE'?'READY':'UNAVAILABLE',active:active||picking});
   }catch(error){if(/SESION|AMBITO|LP_ROL_ETAPA|NO_AUTORIZADO/.test(error.message||''))throw error;evidence.set(key,{status:'UNAVAILABLE',active:false});}
  }
 }));
 return {...data,orders:data.orders.map(r=>({...r,individualEvidence:evidence.get(r.key)}))};
}
