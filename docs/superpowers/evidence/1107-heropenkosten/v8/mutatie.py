from pathlib import Path
import subprocess,tempfile,hashlib,json
out=Path('docs/superpowers/evidence/1107-heropenkosten/v8');source=Path('src/services/ifc/foreign/mergeWriter.ts')
backup=Path(tempfile.mkdtemp(prefix='ops-1107-v8-'))/'mergeWriter.ts'
subprocess.run(['cp',str(source),str(backup)],check=True)
s=source.read_text();old='const numberProblem = unchangedTaskNumberProblem(input, source.opened ?? pristine, wanted, shown);';assert old in s
try:
 source.write_text(s.replace(old,'const numberProblem = undefined;'))
 r=subprocess.run(['bash','tests/planning/run.sh','check-ifc-foreign-herleestoets.ts'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
 (out/'mutatie.log').write_text(r.stdout+'\nEXIT:'+str(r.returncode)+'\n')
 print('mutatie EXIT:'+str(r.returncode)+'; stille gevallen: '+str(r.stdout.count('STIL PRECISIEVERLIES')),flush=True)
 assert r.returncode==1 and r.stdout.count('STIL PRECISIEVERLIES')==4
 assert r.stdout.count('"duration":2.333333}')==4
finally:
 subprocess.run(['cp',str(backup),str(source)],check=True)
 subprocess.run(['cmp',str(backup),str(source)],check=True)
 assert source.read_bytes()==backup.read_bytes()
 (out/'herstel-mutatie.json').write_text(json.dumps({'cmp':0,'sha256VoorEnNa':hashlib.sha256(source.read_bytes()).hexdigest()},indent=2)+'\n')
