from pathlib import Path
import json,re
out=Path('docs/superpowers/evidence/1107-heropenkosten/v5')
log=(out/'definitief/telling.log').read_text()
base=(out/'telling-main-na-898.log').read_text()
kinds=set('niets andere-ouder niveau-hoger volgorde-kinderen relatie-erbij taak-wissen taak-erbij hernoemen duur toewijzing-erbij voortgang doorrekenen'.split())
def rows(text):
 result={}
 for line in text.splitlines():
  if not line.startswith('|'):continue
  c=[x.strip() for x in line.split('|')[1:-1]]
  if len(c)==6 and c[1] in kinds and c[2].isdigit() and c[3].isdigit():
   result[(c[0],c[1])]={'aantal':int(c[2]),'geschreven':int(c[3]),'weigering':c[4],'anders':c[5]}
 return result
old,new=rows(base),rows(log)
assert old.keys()==new.keys()
assert sum(r['geschreven'] for r in old.values())==2578
changes=[]
for key in old:
 assert old[key]['aantal']==new[key]['aantal']
 if old[key]!=new[key]:changes.append({'bestand':key[0],'bewerking':key[1],'voor':old[key],'na':new[key]})
cases=[]
for line in log.splitlines():
 if not line.startswith('NIEUW WEIGERT '):continue
 f,r=line.removeprefix('NIEUW WEIGERT ').split(' · ',1);op,detail=r.split(': ',1)
 cases.append({'bestand':f,'bewerking':op,'eersteVerschil':detail})
# De telling drukt alleen planning-na-openen per taak af. De bestaande niet-gedragen-melding voor de enige
# nieuwe voortgangsweigering is afzonderlijk met de echte app-actie gemeten in v4/onderzoek-voortgang.json.
loss=[c for c in changes if c['voor']['geschreven']>c['na']['geschreven']]
arity=next(c for c in json.loads(Path('docs/superpowers/evidence/1107-heropenkosten/v4/nieuwe-weigeringen.json').read_text()) if 'arity' in c['bestand'])
if any(c['bestand']==arity['bestand'] and c['bewerking']=='voortgang' for c in loss):cases.insert(0,arity)
total=re.search(r'Totaal: (\d+) bewerkingen, (\d+) gelukt, (\d+) merge-needs-phase2, (\d+) anders; (\d+) bestanden',log)
assert total
summary={'basis':'main 20b9af79a na #898, opgegeven 2578/685/0','rijenVergeleken':len(old),'voorGeschreven':sum(r['geschreven'] for r in old.values()),'naGeschreven':sum(r['geschreven'] for r in new.values()),'totaal':dict(zip(['bewerkingen','geschreven','geweigerd','anders','bestanden'],map(int,total.groups()))),'afwijkendeRijen':changes,'rijenMetNieuweWeigeringen':loss,'nieuweWeigeringen':cases}
(out/'vergelijking-telling.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False)+'\n')
(out/'nieuwe-weigeringen.json').write_text(json.dumps(cases,indent=2,ensure_ascii=False)+'\n')
print(json.dumps(summary,indent=2,ensure_ascii=False))
