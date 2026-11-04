/** Reproducible source stamp for an artifact reviewed in another run. No deploy. */
import {execFileSync} from 'node:child_process';import {readFile,writeFile} from 'node:fs/promises';import {stampRelease} from './build-release-info.mjs';
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const date=execFileSync('git',['show','-s','--format=%cI',sha],{encoding:'utf8'}).trim();
const html=stampRelease(await readFile('index.html','utf8'),sha,date).replace(' · compilación ',' · referencia reproducible ');
await writeFile('index.html',html);
