import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const workflow=readFileSync(new URL('../.github/workflows/opt-digital.yml',import.meta.url),'utf8');
const browser=readFileSync(new URL('./opt-digital/rounding-warning-browser.cjs',import.meta.url),'utf8');
test('project CI is PR-only read access, no production credentials or deployment commands',()=>{
 assert.match(workflow,/on:\n  pull_request:/);assert.doesNotMatch(workflow,/pull_request_target|secrets\.|id-token:|contents: write|workflow_dispatch:|\n  push:/);assert.match(workflow,/permissions:\n  contents: read/);assert.match(workflow,/node scripts\/test-opt-project-sql\.mjs/);assert.match(workflow,/node tests\/opt-digital\/rounding-warning-browser\.cjs/);assert.doesNotMatch(workflow,/supabase (?:db push|functions deploy)|firebase deploy/);
});
test('browser uses matching CI Chromium and exact disposable local fixture origin',()=>{
 assert.match(browser,/process\.env\.PLAYWRIGHT_MODULE\|\|'playwright'/);assert.match(browser,/process\.env\.OPT_CHROMIUM\?\{executablePath:/);assert.doesNotMatch(browser,/\/opt\/codex|\/workspace|sgp-one-lab\.web\.app|supabase\.co|process\.env\.(?:TOKEN|PASSWORD)/);assert.match(browser,/new URL\(r\.request\(\)\.url\(\)\)\.origin===fixtureOrigin/);assert.match(browser,/No cut writes allowed in this fixture/);assert.match(browser,/server\.close/);
});
