import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');

test('Programar reserva lives outside scaled and animated main views',()=>{
  assert.equal((html.match(/id="progModal"/g)||[]).length,1);
  assert.ok(html.indexOf('id="progModal"')>html.indexOf('</main>'));
  assert.match(html,/<div class="modal-card prog-card" role="dialog" aria-modal="true" aria-labelledby="progModalTitle">/);
  assert.match(html,/id="progModalClose"[^>]*aria-label="Cerrar programación"/);
});

test('Programar reserva uses the dynamic viewport and a shrinking scroll body',()=>{
  const block=css.slice(css.indexOf('/* LAB v435'),css.indexOf('/* LAB v286'));
  assert.match(block,/height:100dvh!important/);
  assert.match(block,/width:min\(760px,100%\)!important/);
  assert.match(block,/max-height:calc\(100dvh - 48px\)!important/);
  assert.match(block,/max-height:calc\(100dvh - 20px\)!important/);
  assert.match(block,/#progModal \.rec-form\{[^}]*min-height:0!important;[^}]*overflow-y:auto!important/);
  assert.match(block,/#progModal \.modal-actions\{[^}]*flex:0 0 auto!important/);
});
