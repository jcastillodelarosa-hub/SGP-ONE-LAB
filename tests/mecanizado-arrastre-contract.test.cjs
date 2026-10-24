// Static contract checks for prospective carryover (not a database test).
// Run: node tests/mecanizado-arrastre-contract.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261024_arrastre_historico_por_orden.sql'), 'utf8');
assert.match(sql, /sgp_mecanizado_pendientes_turno\(p_token text, p_fecha date, p_turno text\)/);
assert.match(sql, /sgp_validar_sesion_rol/);
assert.match(sql, /partition by reserva,key_produccion/);
assert.match(sql, /max\(h\.fecha_evento\)[^\n]+h\.estado_nuevo='PROCESADO'/);
assert.match(sql, /sgp_mecanizado_arrastre_activacion/);
assert.match(sql, /ON CONFLICT \(id\) DO NOTHING/);
assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
assert.match(sql, /procesado_en>=greatest\(v_inicio,v_activado\) and procesado_en<v_fin/);
assert.match(sql, /extract\(isodow from p_fecha\)=7/);
assert.doesNotMatch(sql, /procesado_en>=v_inicio then 'MECANIZADO'/);
assert.match(sql, /'id_programacion_origen',id_programacion/);
assert.match(sql, /'fecha_culminacion'/);
assert.match(sql, /v_ahora<v_habilitado/);
assert.doesNotMatch(sql, /from base where estado_actual<>'PROCESADO' and procesado_en is null/);
console.log('Carryover RPC static contract checks passed (does not verify database behavior).');
