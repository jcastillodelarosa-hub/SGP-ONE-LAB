// Private authenticated images; no storage URL, durable cache or manufacturing writes.
const SHA=/^[a-f0-9]{64}$/;
export function createOptMatrixLibrary(client,getToken,{timeoutMs=25000}={}){
 async function load(sistema,referencia){
  const token=getToken();if(!token)throw Error('Sesión requerida');
  if(typeof sistema!=='string'||!sistema.trim()||sistema.length>100||typeof referencia!=='string'||!referencia.trim()||referencia.length>100)throw Error('Selecciona sistema y referencia exactos');
  let timer;const result=await Promise.race([client.invoke({p_token:token,sistema,referencia}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('La biblioteca no respondió')),timeoutMs);})]).finally(()=>clearTimeout(timer));
  if(token!==getToken())throw Error('La sesión cambió');
  if(result?.error)throw Error(result.error.message||'Biblioteca no disponible');
  const data=result?.data;if(data?.contract!=='OPT-MATRIX-1'||data.ok!==true||data.sistema!==sistema||data.referencia!==referencia||!['available','unavailable','ambiguous'].includes(data.status))throw Error('Respuesta de biblioteca inválida');
  if(data.status!=='available'){if(data.matrix!==null)throw Error('Matriz no acreditada');return data;}
  const m=data.matrix;
  if(!m||!SHA.test(m.sourceSha256)||!SHA.test(m.imageSha256)||m.mimeType!=='image/png'||!Number.isSafeInteger(m.page)||m.page<1||typeof m.revision!=='string'||m.revision.length>100||typeof m.imageBase64!=='string'||m.imageBase64.length>5592408||!/^[A-Za-z0-9+/]*={0,2}$/.test(m.imageBase64))throw Error('Imagen de matriz inválida');
  const raw=atob(m.imageBase64),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));if(bytes.length>4194304||bytes.length<8||[137,80,78,71,13,10,26,10].some((b,i)=>bytes[i]!==b))throw Error('Imagen de matriz inválida');
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');if(hash!==m.imageSha256)throw Error('La imagen no coincide con su huella');
  if(token!==getToken())throw Error('La sesión cambió');
  return {...data,matrix:{id:m.id,revision:m.revision,page:m.page,sourceSha256:m.sourceSha256,imageSha256:m.imageSha256,blob:new Blob([bytes],{type:'image/png'})}};
 }
 return {load};
}
