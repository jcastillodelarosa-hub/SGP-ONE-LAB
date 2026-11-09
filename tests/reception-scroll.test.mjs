import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Recepción preserves horizontal scrolling and allows vertical scroll chaining',()=>{
  const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
  const rule=css.match(/\[data-mach-panel="recepcion"\] \.table-wrap\{([^}]+)\}/)?.[1];
  assert.ok(rule,'Reception table wrapper has its scoped style');
  assert.match(rule,/overflow:auto/);
  assert.match(rule,/overscroll-behavior-x:contain/);
  assert.match(rule,/overscroll-behavior-y:auto/);
  assert.doesNotMatch(rule,/overscroll-behavior\s*:\s*(contain|none)/);
});
