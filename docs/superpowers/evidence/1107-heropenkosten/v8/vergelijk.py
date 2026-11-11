from pathlib import Path
import json,re
out=Path('docs/superpowers/evidence/1107-heropenkosten/v8')
base=Path('docs/superpowers/evidence/1107-heropenkosten/v5/telling-main-na-898.log').read_text()
log=(out/'definitief/telling.log').read_text()
kinds=set('niets andere-ouder niveau-hoger volgorde-kinderen relatie-erbij taak-wissen taak-erbij hernoemen duur toewijzing-erbij voortgang doorrekenen'.split())
def rows(s):
 r={}
 for line in s.splitlines():
  if not line.startswith('|'):continue
  c=[x.strip() for x in line.split('|')[1:-1]]
  if len(c)==6 and c[1] in kinds and c[2].isdigit() and c[3].isdigit():r[(c[0],c[1])]={'aantal':int(c[2]),'geschreven':int(c[3]),'weigering':c[4],'anders':c[5]}
 return r
old,new=rows(base),rows(log)
assert old.keys()==new.keys() and len(old)==660
assert sum(x['geschreven'] for x in old.values())==2578
assert all(old[k]['aantal']==new[k]['aantal'] for k in old)
changes=[{'bestand':k[0],'soort':k[1],'voor':old[k],'na':new[k]} for k in old if old[k]!=new[k]]
refused=[json.loads(l.removeprefix('WEIGERING GEVAL ')) for l in log.splitlines() if l.startswith('WEIGERING GEVAL ')]
newcases=[]
for c in refused:
 k=(c['bestand'],c['soort']);b=old[k];n=new[k]
 if b['geschreven']==0:continue
 if b['geschreven']==b['aantal'] or (n['geschreven']<b['geschreven'] and any(e['kind'] in ['ongewijzigd-getal','planning-na-openen'] for e in c['gevallen'])):
  kinds={e['kind'] for e in c['gevallen']}
  reason='ongewijzigd getal exact' if 'ongewijzigd-getal' in kinds else 'volledige herleestoets' if 'planning-na-openen' in kinds else '1116 (importvlag)' if any('UnchangedSinceImport' in e['detail'] or 'OPS_ImportProvenance' in e['detail'] for e in c['gevallen']) else 'bestaande verliesbewaking na echte actie'
  newcases.append(c|{'eis':reason})
expected=sum(max(0,old[k]['geschreven']-new[k]['geschreven']) for k in old)
assert len(newcases)==expected,(len(newcases),expected)
m=re.search(r'Totaal: (\d+) bewerkingen, (\d+) gelukt, (\d+) merge-needs-phase2, (\d+) anders; (\d+) bestanden',log);assert m
summary={'basis':'main 20b9af79a na #898','voor':{'geschreven':2578,'geweigerd':685,'anders':0},'na':dict(zip(['bewerkingen','geschreven','geweigerd','anders','bestanden'],map(int,m.groups()))),'rijen':len(old),'afwijkendeRijen':changes,'nieuweWeigeringen':newcases,'verbeterdeRijen':[x for x in changes if x['na']['geschreven']>x['voor']['geschreven']]}
(out/'vergelijking-telling.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False)+'\n')
(out/'nieuwe-weigeringen.json').write_text(json.dumps(newcases,indent=2,ensure_ascii=False)+'\n')
s=['# Elke nieuwe weigering tegenover main na #898','', 'Alle 660 rijen per bestand en bewerking vergeleken met de bewaarde begintelling 2578/685/0. Het aantal pogingen per rij blijft gelijk. De nieuwe eis komt na de bestaande verliesbewaking: bij ongewijzigde kale bewerkingen is een nieuwe weigering op ongewijzigd-getal dus aanvullend. Duur en voortgang hebben één poging per rij, zodat de gewijzigde echte invoer per geval zichtbaar is.','', '| Nr. | Bestand | Bewerking | Eis | Melding |','|---:|---|---|---|---|']
for i,c in enumerate(newcases,1):
 detail='; '.join(e['kind']+': '+e['detail'] for e in c['gevallen'])
 s.append('| '+str(i)+' | '+' | '.join(x.replace('|','\\|').replace('\n',' ') for x in [c['bestand'],c['bewerking'],c['eis'],detail])+' |')
(out/'nieuwe-weigeringen.md').write_text('\n'.join(s)+'\n')
print(json.dumps({'voor':summary['voor'],'na':summary['na'],'nieuweWeigeringen':len(newcases),'verbeterdeRijen':summary['verbeterdeRijen'],'gevallen':newcases},indent=2,ensure_ascii=False))
