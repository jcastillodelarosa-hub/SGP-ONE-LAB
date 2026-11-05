/** Bounded reads of the deployed individual-affectation contract. No new permissions. */
export async function enrichOperationEvidence(data,rpc,{signal}={}){
 const keys=[...new Set(data.orders.map(r=>r.key))],evidence=new Map();let cursor=0;
 await Promise.all(Array.from({length:Math.min(3,keys.length)},async()=>{
  while(cursor<keys.length&&!signal?.aborted){const key=keys[cursor++];
   try{
    const r=await rpc('sgp_lp_afectaciones_consultar_v2',{p_key:key,p_stage:'ENSAMBLE'},{signal});
    if(r?.contract!=='LP-AFFECTATIONS-2'||r.key!==key||r.stage!=='ENSAMBLE'||!Array.isArray(r.reports))throw Error('EVIDENCIA_NO_DISPONIBLE');
    if(r.reports.some(x=>x.originStage!=='ENSAMBLE'||!Number.isSafeInteger(x.quantity)||!Number.isSafeInteger(x.confirmed)||x.confirmed<0||x.quantity<x.confirmed))throw Error('EVIDENCIA_INVALIDA');
    const active=r.reports.some(x=>x.originStage==='ENSAMBLE'&&Number.isSafeInteger(x.quantity)&&Number.isSafeInteger(x.confirmed)&&x.quantity>x.confirmed);
    const ownSources=new Set(r.reports.flatMap(x=>(x.sources||[]).filter(s=>s.contract==='V4').map(s=>s.id)));
    // A link from another stage does not prove physical confirmation in Ensamble.
    const picking=r.pickingPending?.status==='AVAILABLE'&&r.pickingPending.rows.some(x=>x.key===key&&x.origin==='PICKING'&&!ownSources.has(x.id)&&x.state==='PENDIENTE');
    evidence.set(key,{status:r.pickingPending?.status==='AVAILABLE'?'READY':'UNAVAILABLE',active:active||picking,opening:r.progress?.ENSAMBLE?.opening??null});
   }catch(error){if(signal?.aborted)throw error;if(/SESION|AMBITO|LP_ROL_ETAPA|NO_AUTORIZADO/.test(error.message||''))throw error;evidence.set(key,{status:'UNAVAILABLE',active:false});}
  }
 }));
 return {...data,orders:data.orders.map(r=>({...r,individualEvidence:evidence.get(r.key)}))};
}
