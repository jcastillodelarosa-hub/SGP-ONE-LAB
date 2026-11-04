import {readFileSync} from 'node:fs';import {DOMParser} from '@xmldom/xmldom';import {parsePowerBI} from '../../src/domain/powerbi/adapter.js';
process.stdout.write(JSON.stringify(await parsePowerBI(readFileSync(process.argv[2]),{DOMParser})));
