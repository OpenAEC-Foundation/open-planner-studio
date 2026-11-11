// Alleen bewijs: waarom de referentie veranderde. Oude kale invoer en nieuwe storeactie op dezelfde main.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const root=process.cwd(), out=join(root,'docs/superpowers/evidence/1107-heropenkosten/v8');
mkdirSync(join(root,'temp'),{recursive:true});
const tmp=mkdtempSync(join(root,'temp/ops-1107-referentie-'));
try {
  execFileSync('tar',['-x','-C',tmp],{input:execFileSync('git',['archive','20b9af79a74e7d886c2a38f93bba1adbcbb2ba5c','src'],{maxBuffer:1<<28})});
  writeFileSync(join(tmp,'entry.ts'),`
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { TRIAS_FILES, bareBytes, lengthenedTask, openInStore, recalculated, plainSaveAfterF5 } from ${JSON.stringify(join(root,'tests/planning/ifcAppRoute.ts'))};
import { installDeterminism } from ${JSON.stringify(join(root,'tests/planning/ifcPariteitKern.ts'))};
import { writeIFC } from '@/services/ifc/ifcWriter';
const seed=installDeterminism();
const prior=JSON.parse(readFileSync(${JSON.stringify(join(out,'main-toets-voor.json'))},'utf8'));
const results=[];
for(const pad of TRIAS_FILES) {
  const bare=bareBytes(${JSON.stringify(root)},pad);seed(0x804);
  const {store,snapshot}=await openInStore(bare);const {ifcSource:_source,...d}=snapshot(store);
  const input=structuredClone(d);const task=lengthenedTask(input);task.time.scheduleDuration+=1;if(task.time.durationMinutes!==undefined)task.time.durationMinutes+=480;
  const old=writeIFC(await recalculated(input));seed(0x804);
  const real=await plainSaveAfterF5(bare);
  const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
  if(sha(old)!==prior.bestanden.find((x:{pad:string})=>x.pad===pad).uitvoerSha256)throw new Error('oude referentie niet gereproduceerd: '+pad);
  const oldStore=await openInStore(new TextEncoder().encode(old)), newStore=await openInStore(new TextEncoder().encode(real));
  const a=oldStore.snapshot(oldStore.store).tasks.find(t=>t.id===task.id)!.time;
  const b=newStore.snapshot(newStore.store).tasks.find(t=>t.id===task.id)!.time;
  const fields=Object.fromEntries([...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>JSON.stringify(a[k as keyof typeof a])!==JSON.stringify(b[k as keyof typeof b])).map(k=>[k,{voor:a[k as keyof typeof a],na:b[k as keyof typeof b]}]));
  results.push({pad,uitvoerGewijzigd:sha(old)!==sha(real),taak:task.id,naam:task.name,tijdvelden:fields});
}
writeFileSync(${JSON.stringify(join(out,'referentie-velden.json'))},JSON.stringify(results,null,2)+'\\n');
console.log(JSON.stringify(results.filter(x=>x.uitvoerGewijzigd),null,2));
`);
  execFileSync(join(root,'node_modules/.bin/esbuild'),[join(tmp,'entry.ts'),'--bundle','--platform=node','--format=esm',`--alias:@=${join(tmp,'src')}`,'--external:react-dom/server','--log-level=error','--define:import.meta.env.DEV=false','--define:import.meta.env.PROD=true','--define:import.meta.env.MODE="production"','--define:__OPS_DEV_INSTANCE__="test"',`--outfile=${join(tmp,'entry.mjs')}`],{stdio:'inherit'});
  execFileSync(process.execPath,[join(tmp,'entry.mjs')],{stdio:'inherit',env:{...process.env,TZ:'Europe/Amsterdam'}});
} finally {rmSync(tmp,{recursive:true,force:true});}
