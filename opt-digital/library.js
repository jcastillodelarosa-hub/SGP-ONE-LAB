// Local review only. No server transport or production writer.
export const PILOT_VERSION = 21;
export async function fileIdentity(file) {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
}
export function serialQueue() {
  let tail = Promise.resolve();
  return task => { const result = tail.then(task); tail = result.catch(() => {}); return result; };
}
export function validatePlans(data) {
  if (!data || !Array.isArray(data.plans) || data.plans.length > 20000) throw Error('Paquete de planes inválido');
  const ids = new Set();
  return { pdfPages: Number.isSafeInteger(data.pdfPages) ? data.pdfPages : 0,
    plans: data.plans.map((p, i) => {
      if (!p || typeof p.ref !== 'string' || !p.ref || !Array.isArray(p.cuts) || p.cuts.length > 20000) throw Error('Plan inválido');
      const id = String(p.id ?? i);
      if (ids.has(id)) throw Error('Identidad de plan duplicada'); ids.add(id);
      if (!Number.isSafeInteger(p.barqty) || p.barqty < 1) throw Error('Cantidad de barras inválida');
      const text = value => typeof value === 'string' ? value.slice(0, 10000) : '';
      return { id, ref: p.ref, finish: text(p.finish), length: text(p.length), barqty: p.barqty, rest:text(p.rest),code:text(p.code),location:text(p.location),issues:Array.isArray(p.issues)?p.issues.filter(x=>typeof x==='string').map(text):[],unresolvedCells:Array.isArray(p.unresolvedCells)?p.unresolvedCells.map(c=>({length:text(c.length),project:text(c.project),quantity:null,page:Number.isSafeInteger(c.page)?c.page:null,column:Number.isSafeInteger(c.column)?c.column:null})):[],
        page: Number.isSafeInteger(p.page) && p.page > 0 ? p.page : null,
        cuts: p.cuts.map(c => {
          if (!c || typeof c.length !== 'string') throw Error('Corte inválido');
          return { length: text(c.length), project: text(c.project), production: text(c.production),
            uncertain:c.uncertain===true||!c.project,sourcePage:Number.isSafeInteger(c.sourcePage)?c.sourcePage:null,sourceColumn:Number.isSafeInteger(c.sourceColumn)?c.sourceColumn:null,sourceSlot:Number.isSafeInteger(c.sourceSlot)?c.sourceSlot:null,rest:text(c.rest),unitInstance:String(c.unitInstance??''),sourceRow: String(c.sourceRow ?? ''), profileInstance:Number.isSafeInteger(Number(c.profileInstance))&&Number(c.profileInstance)>0?Number(c.profileInstance):null };
        }) };
    }), productionEnabled: false, status: 'PENDIENTE_CONCILIACION' };
}
export async function openLibrary(scope = 'standalone') {
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(scope))throw Error('Ámbito local inválido');
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('sgp-opt-digital-library-v15'+(scope==='standalone'?'':'-'+scope), 1);
    request.onupgradeneeded = () => request.result.createObjectStore('documents', {keyPath:'key'});
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Error('Cierra otras ventanas de OPT para abrir la biblioteca'));
  });
  db.onversionchange = () => db.close();
  function run(mode, action) { return new Promise((resolve, reject) => {
    const tx = db.transaction('documents', mode); let value;
    tx.oncomplete = () => resolve(value); tx.onerror = tx.onabort = () => reject(tx.error || Error('No se guardaron los cambios'));
    try { const req = action(tx.objectStore('documents')); req.onsuccess = () => {value=req.result;}; } catch(e) {tx.abort();reject(e);}
  }); }
  return {all:()=>run('readonly',s=>s.getAll()), get:key=>run('readonly',s=>s.get(key)),
    put:item=>run('readwrite',s=>s.put(item)), close:()=>db.close()};
}
