import { readFileSync } from 'node:fs';
import { installDeterminism } from './ifcPariteitKern';
import { windowCases } from './ifcJsonSleutelsMain';

const reseed = installDeterminism();
const cases = await windowCases(new Uint8Array(readFileSync('tests/fixtures/ifc-foreign/eigen-plus-model.ifc')), reseed);
process.stdout.write(`${JSON.stringify({ commit: process.env.OPS_MAIN_COMMIT, cases }, null, 1)}\n`);
process.exit(0);
