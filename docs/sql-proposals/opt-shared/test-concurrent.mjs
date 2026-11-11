/**
 * PostgreSQL 17, disposable cluster ONLY. No production credentials.
 * npm install --prefix /tmp/opt-pg-qa --no-audit --no-fund pg@8.16.3
 * OPT_PG_DISPOSABLE=YES PG_MODULE=/tmp/opt-pg-qa/node_modules/pg/lib/index.js \
 * OPT_PG_URL=postgresql://postgres:opt_fixture_only@127.0.0.1:5432/opt_concurrency_test \
 * node docs/sql-proposals/opt-shared/test-concurrent.mjs
 * --check validates fixture extraction without importing pg or opening a socket.
 * The cluster must be fresh: this test creates roles and does not drop user data.
 * It proves synthetic concurrency/ACL behavior, NOT SGP identity or BASE approval.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
const moduleUrl = new URL('./test-synthetic.mjs', import.meta.url).href;
const sourceText = readFileSync(new URL(moduleUrl), 'utf8');
// Reuse the existing fixture builders verbatim, not a parallel SQL contract.
// Fail closed if their boundaries change; do not execute the sequential suite.
const start = sourceText.indexOf('await db.exec(`CREATE ROLE anon;');
const end = sourceText.indexOf("const pdf=Buffer.from('%PDF-synthetic');");
assert(start >= 0 && end > start, 'Synthetic fixture boundaries changed; review extraction');
const fixtureText = sourceText.slice(start, end).replaceAll('import.meta.url', 'moduleUrl');
const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
const setupFixture = new AsyncFunction('db', 'readFileSync', 'moduleUrl', 'id', 'scope', 'result', 'estado', 'reject', 'ok',
  `${fixtureText}\nreturn {piece,approve,importIt};`);
assert(fixtureText.includes("./install_REVIEW.sql"), 'Fixture must install the real SQL');
if (process.argv.includes('--check')) {
  console.log('PASS: fixture extraction and JavaScript compilation only; no PostgreSQL execution.');
  process.exit(0);
}
assert.equal(process.env.OPT_PG_DISPOSABLE, 'YES', 'Explicit disposable-cluster acknowledgement required');
const url = new URL(process.env.OPT_PG_URL || '');
assert(['postgres:', 'postgresql:'].includes(url.protocol));
assert.equal(url.hostname, '127.0.0.1', 'Only explicit IPv4 loopback is allowed');
assert.equal(url.pathname, '/opt_concurrency_test', 'Only the dedicated test database is allowed');
assert.equal(url.search, '', 'Connection URL options are forbidden');
const pg = await import(process.env.PG_MODULE || 'pg');
const Client = pg.Client || pg.default.Client;
const connections = [];
let checks = 0;
const ok = (actual, expected) => {assert.deepEqual(actual, expected); checks++;};
const reject = async(fn, pattern) => {await assert.rejects(fn, pattern); checks++;};
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const scope = {linea:'PANELES_2',anio:2026,semana:45,modo:'BASE'};
async function connect(label) {
  const client = new Client({connectionString:url.href, application_name:`opt-concurrency-${label}`,
    connectionTimeoutMillis:5000, statement_timeout:15000, lock_timeout:12000});
  connections.push(client);
  await client.connect();
  return client;
}
const rpcSQL = 'SELECT public.sgp_opt_cortes_registrar_v2($1,$2,$3,$4,$5) result';
const rpc = async(client, actor, pieces, key, s=scope, reserve='R') =>
  (await client.query(rpcSQL,[actor,reserve,pieces,key,s])).rows[0].result;
try {
  const admin = await connect('observer');
  const identity = (await admin.query('SELECT current_database() db, current_user usr, version() version')).rows[0];
  ok(identity.db, 'opt_concurrency_test');
  const occupied = await admin.query(`SELECT nspname FROM pg_namespace WHERE nspname NOT IN ('public','information_schema') AND nspname NOT LIKE 'pg_%'
    UNION ALL SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace
    UNION ALL SELECT proname FROM pg_proc WHERE pronamespace='public'::regnamespace
    UNION ALL SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role')`);
  ok(occupied.rows, []); // Never overwrite an existing installation or cluster fixture.
  const db = {query:(...args)=>admin.query(...args), exec:sql=>admin.query(sql)};
  const result = async(sql, params=[]) => (await admin.query(sql,params)).rows[0].result;
  const estado = () => result('SELECT public.sgp_opt_cortes_estado_v2($1,$2,$3) result',['alice','R',scope]);
  const fixture = await setupFixture(db,readFileSync,moduleUrl,id,scope,result,estado,reject,ok);
  const a = await connect('writer-a'), b = await connect('writer-b');
  const pidA = (await a.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  const pidB = (await b.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  assert.notEqual(pidA,pidB); checks++;
  // Default installation must deny every browser/service role, even a valid actor.
  for (const role of ['anon','authenticated','service_role']) {
    await b.query(`SET ROLE ${role}`);
    await reject(()=>rpc(b,'alice',[id(1)],id(2)),/permission denied/);
    await reject(()=>b.query('SELECT * FROM sgp_opt_shared.cuts'),/permission denied/);
    await reject(()=>b.query('SELECT sgp_opt_shared.import_manifest(null,null,null)'),/permission denied/);
    await b.query('RESET ROLE');
  }
  // Test-only grant, in the fresh disposable database, to exercise SECURITY DEFINER.
  await admin.query('GRANT EXECUTE ON FUNCTION public.sgp_opt_cortes_registrar_v2(text,text,uuid[],uuid,jsonb),public.sgp_opt_cortes_estado_v2(text,text,jsonb) TO authenticated');
  await a.query('SET ROLE authenticated'); await b.query('SET ROLE authenticated');
  await reject(()=>b.query('SELECT * FROM sgp_opt_shared.cuts'),/permission denied/);
  let documentNumber=0;
  async function pieces(n) {
    const manifest=Array.from({length:n},(_,i)=>fixture.piece(i+1));
    const bytes=Buffer.from(`%PDF-concurrent-${++documentNumber}`);
    const approval=await fixture.approve(manifest,bytes);
    const imported=await fixture.importIt(approval,bytes,manifest);
    return (await admin.query('SELECT id_pieza FROM sgp_opt_shared.pieces WHERE id_documento=$1 ORDER BY corte',[imported.id_documento])).rows.map(r=>r.id_pieza);
  }
  const cuts = async(ids) => Number((await admin.query('SELECT count(*) n FROM sgp_opt_shared.cuts WHERE id_pieza=ANY($1::uuid[])',[ids])).rows[0].n);
  const events = async(key) => Number((await admin.query('SELECT count(*) n FROM sgp_opt_shared.events WHERE clave=$1',[key])).rows[0].n);
  // B must demonstrably block behind A, not merely run later in Promise.all.
  async function race(first, second, finish='COMMIT') {
    await a.query('BEGIN');
    let pending;
    try {
      const receipt=await first();
      pending=second().then(value=>({value}),error=>({error}));
      let blocked=false;
      const deadline=Date.now()+5000;
      while(Date.now()<deadline) {
        blocked=(await admin.query('SELECT $1::int=ANY(pg_blocking_pids($2)) blocked',[pidA,pidB])).rows[0].blocked;
        if(blocked) break;
        await delay(20);
      }
      ok(blocked,true);
      await a.query(finish);
      return {receipt,...await pending};
    } finally {
      await a.query('ROLLBACK');
      if(pending) await pending;
    }
  }
  {
    const ids=await pieces(1), keyA=id(2001), keyB=id(2002);
    const r=await race(()=>rpc(a,'alice',ids,keyA),()=>rpc(b,'bob',ids,keyB));
    assert.match(r.error?.message || '',/OPT_CORTE_YA_REGISTRADO/); checks++;
    ok(await cuts(ids),1); ok(await events(keyA),1); ok(await events(keyB),0);
    console.log('PASS: same physical piece, distinct UUIDs and actors, one committed cut');
  }
  {
    const ids=await pieces(2), key=id(2010);
    const r=await race(()=>rpc(a,'alice',ids,key),()=>rpc(b,'alice',[...ids].reverse(),key));
    assert.ifError(r.error); ok(r.value,{...r.receipt,duplicado:true});
    ok(await cuts(ids),2); ok(await events(key),1);
    await reject(()=>rpc(b,'bob',ids,key),/OPT_CLAVE_REUTILIZADA/);
    await reject(()=>rpc(b,'alice',[ids[0]],key),/OPT_CLAVE_REUTILIZADA/);
    await reject(()=>rpc(b,'alice',ids,key,{...scope,semana:46}),/OPT_CLAVE_REUTILIZADA/);
    await reject(()=>rpc(b,'alice',ids,key,scope,'R2'),/OPT_CLAVE_REUTILIZADA/);
    console.log('PASS: shared UUID replay preserves receipt and rejects actor/set/scope/reserve changes');
  }
  {
    const ids=await pieces(3), keyA=id(2020), keyB=id(2021);
    const r=await race(()=>rpc(a,'alice',ids.slice(0,2),keyA),()=>rpc(b,'bob',[ids[2],ids[1]],keyB));
    assert.match(r.error?.message || '',/OPT_CORTE_YA_REGISTRADO/); checks++;
    ok(await cuts(ids),2); ok(await cuts([ids[2]]),0); ok(await events(keyB),0);
    await rpc(b,'bob',[ids[2]],keyB); ok(await cuts(ids),3);
    console.log('PASS: overlapping batches roll back entirely; unused UUID remains reusable');
  }
  {
    const ids=await pieces(2), key=id(2030);
    const r=await race(()=>rpc(a,'alice',ids,key),()=>rpc(b,'alice',ids,key),'ROLLBACK');
    assert.ifError(r.error); ok(r.value.duplicado,false); ok(await cuts(ids),2); ok(await events(key),1);
    await admin.query("UPDATE public.fixture_users SET active=false WHERE actor='alice'");
    await reject(()=>rpc(a,'alice',ids,key),/UNAUTHORIZED/);
    await reject(()=>rpc(b,'unknown',ids,key),/UNAUTHORIZED/);
    await reject(()=>rpc(b,'',ids,key),/OPT_NO_AUTORIZADO/);
    await reject(()=>rpc(b,null,ids,key),/OPT_NO_AUTORIZADO/);
    ok(await events(key),1);
    console.log('PASS: rolled-back writer leaves no partial ledger; revoked/invalid sessions cannot replay');
  }
  console.log(`PASS: ${checks} PostgreSQL multi-session assertions (${identity.version}). Synthetic isolated database only; no production verification.`);
} finally {
  await Promise.allSettled(connections.map(client=>client.end()));
}
