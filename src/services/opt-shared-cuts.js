// No offline/localStorage fallback: caller journals a command BEFORE sending.
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const realDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10) === value;
// PostgreSQL emits microseconds. Preserve them when checking the half-open interval.
function instant(value) {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!m || !realDay(m[1]) || +m[2] > 23 || +m[3] > 59 || +m[4] > 59 || (m[6] !== 'Z' && (+m[6].slice(1,3) > 23 || +m[6].slice(4) > 59))) return null;
  const ms = Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4]}${m[6]}`);
  return Number.isFinite(ms) ? BigInt(ms)*1000n + BigInt((m[5]||'').padEnd(6,'0')) : null;
}
const bogotaDay = value => {
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
  return ['year','month','day'].map(type=>parts.find(p=>p.type===type).value).join('-');
};
export function validOptPeriod(period, registeredAt) {
  if (!period || typeof period !== 'object' || Array.isArray(period) || Object.keys(period).sort().join() !== 'fecha,fin,horario_sha256,inicio,turno,zona' || !realDay(period.fecha) || ![1,2].includes(period.turno) || period.zona !== 'America/Bogota' || typeof period.horario_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(period.horario_sha256)) return false;
  const start = instant(period.inicio), end = instant(period.fin), at = instant(registeredAt);
  return start !== null && end !== null && at !== null && start < end && at >= start && at < end && period.fecha === bogotaDay(period.inicio);
}
const validScope = s => s && typeof s === 'object' && !Array.isArray(s) && Object.keys(s).sort().join() === 'anio,linea,modo,semana' && s.linea === 'PANELES_2' && s.modo === 'BASE' && Number.isInteger(s.anio) && s.anio >= 2020 && s.anio <= 2100 && Number.isInteger(s.semana) && s.semana >= 1 && s.semana <= 53;
const sameScope = (a,b) => validScope(a) && validScope(b) && ['linea','anio','semana','modo'].every(k => a[k] === b[k]);
const invalid = () => { throw new Error('OPT_CONTRATO_NO_COMPATIBLE'); };
const rejected = new Set(['OPT_NO_HABILITADO','OPT_NO_AUTORIZADO','OPT_SCOPE_INVALIDO','OPT_UNIDAD_FUERA_AMBITO','OPT_PARAMETROS_INVALIDOS','OPT_PIEZAS_DUPLICADAS','OPT_CLAVE_REUTILIZADA','OPT_PIEZA_RESERVA_NO_VALIDADA','OPT_CORTE_YA_REGISTRADO','OPT_HORARIO_NO_CONFIGURADO','OPT_HORARIO_SIN_TURNO','OPT_HORARIO_SUPERPUESTO','HORARIO_OPERATIVO_NO_CONFIGURADO','HORARIO_OPERATIVO_AMBIGUO']);
function state(data, reserva, scope) {
  if (!sameScope(data.scope,scope) || data.habilitado !== true || data.reserva !== reserva || typeof data.manifiesto_validado !== 'boolean' || typeof data.puede_registrar !== 'boolean' || !Array.isArray(data.referencias)) invalid();
  const ids = new Set(); const groups = new Set(); const documents = new Map(); const hashes = new Map(); const sourceDocuments = new Map(); const positions = new Set(); let done = 0;
  for (const ref of data.referencias) {
    if (!uuid(ref.id_documento) || !/^[a-f0-9]{64}$/.test(ref.sha256) || !['referencia','sistema'].every(key => text(ref[key])) || !Array.isArray(ref.fuentes) || !ref.fuentes.length || !Array.isArray(ref.piezas) || !ref.piezas.length) invalid();
    const documentId = ref.id_documento.toLowerCase();
    if (hashes.has(ref.sha256) && hashes.get(ref.sha256) !== documentId) invalid();
    hashes.set(ref.sha256,documentId);
    const sources = new Set();
    for (const f of ref.fuentes) {
      if (!f || !['RETAIL','PROYECTO','DESCONOCIDO'].includes(f.origen) || !['INDICE','INDIVIDUAL'].includes(f.modo_carga) || !text(f.source_key) || !text(f.consecutivo)) invalid();
      const key = JSON.stringify([f.origen,f.source_key]); if (sources.has(key)) invalid(); sources.add(key);
      if (sourceDocuments.has(key) && sourceDocuments.get(key) !== documentId) invalid();
      sourceDocuments.set(key,documentId);
    }
    const meta = JSON.stringify([ref.sha256,ref.fuentes.map(f=>JSON.stringify([f.origen,f.source_key,f.consecutivo,f.modo_carga])).sort()]);
    if (documents.has(documentId) && documents.get(documentId) !== meta) invalid();
    documents.set(documentId,meta);
    const group = JSON.stringify([documentId,ref.sistema,ref.referencia]); if (groups.has(group)) invalid(); groups.add(group);
    for (const p of ref.piezas) {
      if (typeof p.registrable !== 'boolean' || (data.puede_registrar && p.estado === 'PENDIENTE' && !p.registrable) || !uuid(p.id_pieza) || ids.has(p.id_pieza.toLowerCase()) || !['pagina','patron','barra','corte'].every(key => Number.isSafeInteger(p[key]) && p[key] > 0) || typeof p.longitud_mm !== 'number' || !(p.longitud_mm > 0 && p.longitud_mm < 100000)) invalid();
      const position = [documentId,p.pagina,p.patron,p.barra,p.corte].join('/');
      if (positions.has(position)) invalid(); positions.add(position);
      ids.add(p.id_pieza.toLowerCase());
      if (p.estado === 'CORTADO') { if (!text(p.usuario) || !validOptPeriod(p.periodo,p.registrado_en) || !uuid(p.id_registro)) invalid(); done++; }
      else if (p.estado !== 'PENDIENTE' || p.usuario !== null || p.registrado_en !== null || p.id_registro !== null || p.periodo !== null) invalid();
    }
  }
  if (data.manifiesto_validado !== (ids.size > 0) || (!data.manifiesto_validado && data.puede_registrar) || !data.totales || data.totales.piezas !== ids.size || data.totales.cortadas !== done || data.totales.pendientes !== ids.size - done) invalid();
}
function receipt(data, args) {
  if (!sameScope(data.scope,args.p_scope) || data.ok !== true || typeof data.duplicado !== 'boolean' || data.reserva !== args.p_reserva || data.id_registro?.toLowerCase() !== args.p_idempotency_key || !text(data.usuario) || !validOptPeriod(data.periodo,data.registrado_en) || data.cantidad_piezas !== args.p_piezas.length || !Array.isArray(data.piezas) || !data.piezas.every(uuid) || [...data.piezas].map(p => p.toLowerCase()).sort().join() !== [...args.p_piezas].sort().join()) invalid();
}
export function createOptSharedCuts(client, getToken, {timeoutMs=25000,catalog=null}={}) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2147483647) throw new Error('OPT_ESPERA_INVALIDA');
  // Documentary candidates never grant writes. Only the latest validated RPC
  // response for the same session can supply the missing registration capability.
  let stateGeneration = 0, authority = null;
  const freeze = value => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  };
  async function rpc(name, args, validate) {
    const token = getToken();
    if (!token) throw new Error('OPT_SESION_REQUERIDA');
    let timer;
    // A timeout does not cancel or roll back the server write. The caller must
    // retain the original journal and explicitly replay the identical command.
    const {data,error} = await Promise.race([
      Promise.resolve().then(() => client.rpc(name, {p_token:token,...args})),
      new Promise((_,reject) => { timer=setTimeout(() => reject(new Error('OPT_RPC_TIMEOUT')),timeoutMs); })
    ]).finally(() => clearTimeout(timer));
    // Late responses cannot update another session. A write may have committed:
    // this error is deliberately not definitive; keep the original journal.
    if (getToken() !== token) throw new Error('OPT_SESION_CAMBIADA');
    if (error) {
      const failure = new Error(error.message || 'OPT_RPC_ERROR');
      failure.code = error.code;
      // Rollback of THIS attempt only. Never proves absence of an earlier commit.
      failure.definitive = error.code === 'P0001' && rejected.has(error.message);
      throw failure;
    }
    if (!data || data.contract_version !== 2) invalid();
    validate(data,args);
    return data;
  }
  return {
    estado: async (reserva,scope) => {
      const generation = ++stateGeneration;
      authority = null;
      if (!text(reserva)) return Promise.reject(new Error('OPT_RESERVA_REQUERIDA'));
      if (!validScope(scope)) return Promise.reject(new Error('OPT_SCOPE_INVALIDO'));
      const snapshot = {...scope}, token = getToken();
      const data = freeze(structuredClone(await rpc('sgp_opt_cortes_estado_v2',{p_reserva:reserva,p_scope:snapshot}, data => state(data,reserva,snapshot))));
      if (generation === stateGeneration && token === getToken()) authority = {data,token};
      return data;
    },
    authorizesGroup: (group,data,documents=[]) => {
      if (!authority || authority.data !== data || authority.token !== getToken()
        || data.puede_registrar !== true || data.manifiesto_validado !== true
        || !sameScope(group?.scope,data.scope) || group.reservation !== data.reserva
        || !Array.isArray(documents)) return false;
      return data.referencias.some(ref => ref.sistema === group.system
        && (group.origin === 'SERVIDOR'
          ? catalog?.ownsGroup?.(group)===true && catalog?.matchesReference?.(group,ref)===true
          : documents.some(doc => doc.format === 'pdf' && doc.key === ref.sha256)
            && (group.origin === 'INDIVIDUAL'
          ? Array.isArray(group.documentHashes) && group.documentHashes.includes(ref.sha256)
          : ['RETAIL','PROYECTO'].includes(group.origin) && Array.isArray(group.opts)
            && ref.fuentes.some(source => source.origen === group.origin && group.opts.includes(source.consecutivo))))
        && ref.piezas.some(piece => piece.registrable === true));
    },
    registrar: ({reserva,piezas,idempotencyKey,scope}) => {
      if (!validScope(scope)) throw new Error('OPT_SCOPE_INVALIDO');
      if (!text(reserva) || !uuid(idempotencyKey) || !Array.isArray(piezas) || piezas.length < 1 || piezas.length > 1000 || !piezas.every(uuid) || new Set(piezas.map(p => p.toLowerCase())).size !== piezas.length) throw new Error('OPT_PARAMETROS_INVALIDOS');
      return rpc('sgp_opt_cortes_registrar_v2',{p_scope:{...scope},p_reserva:reserva,p_piezas:piezas.map(p => p.toLowerCase()),p_idempotency_key:idempotencyKey.toLowerCase()},receipt);
    }
  };
}
