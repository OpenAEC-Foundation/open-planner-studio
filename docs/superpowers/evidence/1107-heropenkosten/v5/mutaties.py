from pathlib import Path
import subprocess,tempfile,shutil,hashlib,json,sys
root=Path.cwd(); source=root/'src/services/ifc/foreign/planningCanon.ts'
out=root/'docs/superpowers/evidence/1107-heropenkosten/v5';out.mkdir(exist_ok=True)
mode=sys.argv[1];backup=Path(tempfile.mkdtemp(prefix='ops-1107-v5-'))/'planningCanon.ts';shutil.copyfile(source,backup);s=source.read_text()
sort="    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)"
assert sort in s
if mode=='plek': changed=s.replace(sort,'')
elif mode=='inhoud': changed=s.replace('resourceCalendars=${exact}', 'resourceCalendars=')
elif mode=='dubbel': changed=s.replace('[...(input.resourceCalendars ?? [])]', '[...new Map((input.resourceCalendars ?? []).map(cal => [cal.id, cal])).values()]')
elif mode=='weg':
 a=s.index('  return { ...input, resourceCalendars:');b=s.index('\n}',a)
 changed=s[:a]+'  return { ...input, resourceCalendars: [] };'+s[b:]
else:raise ValueError(mode)
assert changed!=s
try:
 source.write_text(changed)
 p=subprocess.run(['bash','tests/planning/run.sh','check-ifc-foreign-herleestoets.ts'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
 (out/('mutatie-'+mode+'.log')).write_text(p.stdout+'\nEXIT:'+str(p.returncode)+'\n')
 assert p.returncode==1,(mode,p.returncode)
 print(mode,'EXIT:1',flush=True)
finally:
 shutil.copyfile(backup,source);assert subprocess.run(['cmp',str(backup),str(source)]).returncode==0
 assert source.read_bytes()==backup.read_bytes()
 (out/('herstel-'+mode+'.json')).write_text(json.dumps({'bestand':str(source.relative_to(root)),'cmp':0,'sha256VoorEnNa':hashlib.sha256(source.read_bytes()).hexdigest()},indent=2)+'\n')
