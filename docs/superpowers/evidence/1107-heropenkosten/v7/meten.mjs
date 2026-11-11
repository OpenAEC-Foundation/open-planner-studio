// Alleen meten; beide afzonderlijke runs krijgen elk hun eigen flock van de aanroeper.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
const root = process.cwd(), out = resolve('docs/superpowers/evidence/1107-heropenkosten/v7');
const mode = process.argv[2];
mkdirSync(join(root, 'temp'), {recursive:true});
const temp = mkdtempSync(join(root, 'temp/ops-1107-echte-duur-'));
try {
  if (mode === 'main') execFileSync('tar', ['-x', '-C', temp], {input:execFileSync('git', ['archive','20b9af79a74e7d886c2a38f93bba1adbcbb2ba5c','src'], {maxBuffer:1<<28})});
  const bundle = join(temp,'probe.mjs');
  execFileSync(join(root,'node_modules/.bin/esbuild'), [join(out,mode+'.ts'),'--bundle','--platform=node','--format=esm',
    `--alias:@=${mode==='main'?join(temp,'src'):join(root,'src')}`, '--external:react-dom/server','--log-level=error',
    '--define:import.meta.env.DEV=false','--define:import.meta.env.PROD=true','--define:import.meta.env.MODE="production"',
    '--define:__OPS_DEV_INSTANCE__="test"',`--outfile=${bundle}`], {stdio:'inherit'});
  execFileSync(process.execPath,[bundle,root,...(mode==='main'?[join(out,'main.json')]:[join(out,'main.json'),join(out,'merge.json')])],{stdio:'inherit',env:{...process.env,TZ:'Europe/Amsterdam'}});
} finally {rmSync(temp,{recursive:true,force:true});}
