import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {weeklyLoadResult} from '../src/domain/weekly-load-result.js';

test('carga semanal separa altas, reprogramaciones y materiales reutilizados', () => {
  const result = weeklyLoadResult({insertados:{total:4},actualizados:{programacion:2},reutilizados:{piezas:3,accesorios:1,vidrio:1}});
  assert.deepEqual({...result,text:undefined},{inserted:4,moved:2,reused:5,text:undefined});
  assert.match(result.text,/2 producciones movidas/);
});
test('carga semanal conserva compatibilidad sin inventar reprogramaciones', () => {
  assert.equal(weeklyLoadResult({insertados:{total:20}}).moved,0);
  assert.equal(weeklyLoadResult(null,10).inserted,10);
  assert.equal(weeklyLoadResult({actualizados:{programacion:-1}}).moved,0);
});
test('carga semanal avisa el movimiento antes de confirmar y no cambia políticas de reintento', () => {
  const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  assert.match(app,/Las producciones existentes se moverán a esta semana/);
  assert.match(app,/weeklyLoadResult\(data, total\)/);
  assert.match(app,/Retry only an explicitly rejected concurrency lock/);
  assert.match(app,/weeklyCommitNeedsVerification = true/);
});
