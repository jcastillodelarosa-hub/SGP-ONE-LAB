// SQL remains the certificate, actor and expiry authority. No caller-supplied manifest.
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).sort().join(',')===keys.split(',').sort().join(',');
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(v);
const equal=(a,b)=>object(a)&&object(b)?Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k])):a===b;
const reject=()=>{throw Object.assign(Error('OPT_RESOLUTION_IDENTITY'),{code:'OPT_RESOLUTION_IDENTITY',status:422});};
export async function validateRetailResolution(body,{pdfHash,indexHash,indexSheet}){
 const r=body.resolution;
 if(body.source.origin!=='RETAIL'||body.source.mode!=='INDICE'||!exact(r,'identity,requestHash,decisionId,retryGeneration,attemptId')||![r.decisionId,r.retryGeneration,r.attemptId].every(uuid)||typeof r.requestHash!=='string'||!/^[a-f0-9]{64}$/.test(r.requestHash))reject();
 const expected={scope:body.scope,source:body.source,pdf:{name:body.pdf.name,sha256:pdfHash},index:{name:body.index.name,sha256:indexHash,format:body.index.format,sheet:body.index.sheet}};
 if(body.pdf.name!==body.source.opt+'.pdf'||typeof body.index.sheet!=='string'||!body.index.sheet.trim()||body.index.sheet.length>80||body.index.format==='xlsx'&&indexSheet!==body.index.sheet||!equal(r.identity,expected))reject();
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(r.identity)))),b=>b.toString(16).padStart(2,'0')).join('');
 if(digest!==r.requestHash)reject();
 return r;
}
