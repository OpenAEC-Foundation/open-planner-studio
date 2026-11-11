import { readFileSync, writeFileSync } from 'node:fs';
import { openForeign, cloneDomain, openInStore, shownAfterOpen, tryMerge } from '/home/aia09/.t3/worktrees/open-planner-studio/feat-804-fase1b-1107/tests/planning/ifcMergeKern';
import { generatedModel } from '/home/aia09/.t3/worktrees/open-planner-studio/feat-804-fase1b-1107/tests/planning/ifcGeneratedModel';
import { installDeterminism } from '/home/aia09/.t3/worktrees/open-planner-studio/feat-804-fase1b-1107/tests/planning/ifcPariteitKern';
import { splitStepArgs } from '@/services/ifc/foreign/stepScanner';
installDeterminism();
const root=process.cwd();
const base=readFileSync(root+'/tests/planning/fixtures/oude-tags/v2026.9.0-17-cijfers-10-villa-wassenaar.ifc','utf8');
const results=[];
for(const remaining of [2.3333333333333335,1.2345678901234567]) {
 const line=base.split('\n').find(l=>l.includes("IFCTASKTIME('Set up site Time'"))!;
 const a=splitStepArgs(line.slice(line.indexOf('(')+1,line.lastIndexOf(')')));a[18]=`'P0Y0M${remaining}D'`;
 const raw=base.replace(line,line.slice(0,line.indexOf('(')+1)+a.join(',')+');');
 const bytes=generatedModel(root,raw,0);
 for(const edit of ['completion','actualStart'] as const) {
  const {store,snapshot}=await openInStore(bytes);const t=store.getState().tasks.find(t=>t.name==='Set up site')!;
  const before=structuredClone(t.time);
  const accepted=edit==='completion'?store.getState().setTaskProgress(t.id,0.5):store.getState().setActualStart(t.id,t.time.scheduleStart);
  const domain=cloneDomain(snapshot(store));const after=domain.tasks.find(x=>x.id===t.id)!.time;
  const wanted=(await shownAfterOpen(domain)).tasks.find(x=>x.id===t.id)!.time;
  const merge=await tryMerge(domain,snapshot(store).ifcSource!);
  const back=merge.ok?(await openForeign(merge.bytes)).tasks.find(x=>x.id===t.id)!.time:undefined;
  results.push({remaining,edit,accepted,before,after,wanted,merge:merge.ok?'schrijft':merge.error.cases,back});
 }
}
writeFileSync(root+'/docs/superpowers/evidence/1107-heropenkosten/v5/onderzoek-precisie.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results.map(r=>({remaining:r.remaining,edit:r.edit,accepted:r.accepted,merge:r.merge,...Object.fromEntries(['before','after','wanted','back'].map(k=>[k,((t:any)=>({duration:t?.scheduleDuration,remaining:t?.remainingTime,durationMinutes:t?.durationMinutes,remainingMinutes:t?.remainingMinutes}))((r as any)[k])]))})),null,2));
