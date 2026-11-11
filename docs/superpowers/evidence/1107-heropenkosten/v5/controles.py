from pathlib import Path
import subprocess,json
out=Path('docs/superpowers/evidence/1107-heropenkosten/v5/definitief');out.mkdir(parents=True,exist_ok=True);results={}
def run(args,name):
 p=subprocess.run(['flock','/tmp/ops-zwaar.lock',*args],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
 (out/(name+'.log')).write_text(p.stdout+'\nEXIT:'+str(p.returncode)+'\n');results[name]=p.returncode
 (out/'uitslagen.json').write_text(json.dumps(results,indent=2)+'\n')
 print(name,'EXIT:'+str(p.returncode),flush=True)
 if p.returncode: raise SystemExit(p.returncode)
 return p.returncode
for name in ['typecheck','lint']:
 run(['npm','run',name],name)
for name in ['herleestoets','oude-eigen','strikt','preserve','pariteit','open','target']:
 run(['bash','tests/planning/run.sh','check-ifc-foreign-'+name+'.ts'],name)
run(['bash','tests/planning/run.sh','check-ifc-duurvormen.ts'],'duurvormen')
run(['npm','run','verify:i18n'],'verify-i18n')
for name in ['verify:store-boundaries','verify:cycles','verify:docs']:
 run(['npm','run',name],name.replace(':','-'))
assert subprocess.run(['git','fetch','-q','origin','main']).returncode==0
pr=json.loads(subprocess.check_output(['gh','pr','view','898','--json','state,mergedAt,mergeCommit'],text=True))
pr['originMain']=subprocess.check_output(['git','rev-parse','origin/main'],text=True).strip()
pr['head']=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
merged=bool(pr.get('mergeCommit')) and subprocess.run(['git','merge-base','--is-ancestor',pr['mergeCommit']['oid'],'origin/main']).returncode==0
needs=merged and subprocess.run(['git','merge-base','--is-ancestor',pr['mergeCommit']['oid'],'HEAD']).returncode!=0
pr.update(mergedInMain=merged,needsMainMerge=needs)
(out/'main-voor-telling.json').write_text(json.dumps(pr,indent=2)+'\n')
if needs:
 (out/'uitslagen.json').write_text(json.dumps(results,indent=2)+'\n')
 print('MAIN MOET EERST WORDEN GEMERGED; TELLING NOG NIET GEDRAAID',flush=True)
 raise SystemExit(3)
run(['bash','tests/planning/run.sh','check-ifc-foreign-merge-telling.ts'],'telling')
(out/'uitslagen.json').write_text(json.dumps(results,indent=2)+'\n')
