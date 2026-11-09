# Indeling volgens ontwerp §4.2 (D, R, Own, Ext -> P/C/A/V) op een IFC-bestand (STEP).
# Review #839: één scanner die tekst kent (ook '' en commentaar binnen tekst) voor statements, secties en entiteiten;
# entiteiten mogen over meer regels lopen. Weigert (exit 1) invoer zonder STEP-kop of END-ISO-10303-21, met tekst of
# commentaar zonder einde, secties in een andere volgorde (ook HEADER of DATA zonder ENDSEC), een onbekend statement,
# een `#id` dat twee keer voorkomt, een `#id` boven 2147483647 (knownbug 1007), of zonder entiteiten. Volgt de
# uitzondering "live-schema van eigen herkomst sluit baselinebomen altijd uit" (spec §4.2 stap 1). Complexe instanties
# (#n=(A()B())) telt hij als type COMPLEX, zonder verdere indeling.
# Fase-0-voorproef (ontwerp #804 v9 §4.2). Draaien: python3 -I scripts/proef/classify-v9.py <bestand.ifc> [--json]
# Fase 0 (#804) voegt alleen `--json` toe: de klasse per #id, voor de vergelijking met de TS-indeling in
# tests/planning/check-ifc-foreign-classify.ts. De indeling zelf is die van PR #839 (ontwerp v17, commit 35268d437).
# Benaderingen: het register komt uit de 'OPS_*'-namen in ifcPsets.ts/ifcWriter.ts; de bekende propertynamen zijn alle
# tekstliteralen in src/services/ifc/*.ts (een ruime overmaat). De bouw haalt beide uit één bron in de code.
import re, sys, os, glob
from collections import defaultdict, Counter
AS_JSON = '--json' in sys.argv[1:]
if AS_JSON: sys.argv.remove('--json')
t = open(sys.argv[1], encoding='utf-8', errors='replace').read()
ents, pos = {}, {}
def fout(msg):
    sys.exit(f"{sys.argv[1]}: {msg}; ongeschikte of onvolledige invoer")
def statements(text):
    # Eén scanner voor het hele bestand: kent '...' (met ''), en /* ... */ buiten tekst. Geeft per ';'-statement de
    # beginpositie en de tekst zonder commentaar. Commentaar binnen tekst blijft tekst ('/*vendor*/OPS').
    out, buf, i, n, start, in_str = [], [], 0, len(text), None, False
    while i < n:
        c = text[i]
        if in_str:
            buf.append(c)
            if c == "'":
                if i + 1 < n and text[i+1] == "'": buf.append("'"); i += 2; continue
                in_str = False
            i += 1; continue
        if c == '/' and i + 1 < n and text[i+1] == '*':
            j = text.find('*/', i + 2)
            if j < 0: fout('commentaar zonder einde')
            i = j + 2; continue
        if c == ';':
            out.append((start if start is not None else i, ''.join(buf).strip())); buf, start = [], None
            i += 1; continue
        if start is None and not c.isspace(): start = i
        if c == "'": in_str = True
        buf.append(c); i += 1
    if in_str: fout('tekst zonder einde')
    if ''.join(buf).strip(): fout('laatste statement zonder ;')
    return out
sts = statements(t)
kw = [x for _, x in sts]
if not kw or kw[0] != 'ISO-10303-21': fout('geen STEP-kop (ISO-10303-21;)')
if kw[-1] != 'END-ISO-10303-21': fout('geen END-ISO-10303-21;')
# Secties in vaste volgorde: ISO-10303-21; HEADER; <kop> ENDSEC; dan een of meer DATA; <entiteiten> ENDSEC; dan
# END-ISO-10303-21. Elke afwijking (ontbrekende ENDSEC, statement buiten een sectie) is ongeschikte invoer.
if len(kw) < 2 or kw[1] != 'HEADER': fout('geen HEADER; na ISO-10303-21;')
staat = 'kop'
for st, body in sts[2:-1]:
    if staat == 'kop':
        if body == 'ENDSEC': staat = 'tussen'; continue
        if body in ('HEADER', 'END-ISO-10303-21') or body == 'DATA' or re.fullmatch(r'DATA\s*\(.*\)', body, re.S):
            fout(f'HEADER zonder ENDSEC (gevonden: {body[:20]!r})')
        if not re.fullmatch(r'[A-Z][A-Z0-9_]*\s*\(.*\)', body, re.S): fout(f'onbekend statement in HEADER: {body[:40]!r}')
        continue
    if staat == 'tussen':
        if body == 'DATA' or re.fullmatch(r'DATA\s*\(.*\)', body, re.S): staat = 'data'; continue
        fout(f'statement buiten een sectie: {body[:40]!r}')
    if body == 'ENDSEC': staat = 'tussen'; continue
    m = re.fullmatch(r'#(\d+)\s*=\s*([A-Z0-9_]+)\s*\((.*)\)', body, re.S)
    m2 = None if m else re.fullmatch(r'#(\d+)\s*=\s*\((.*)\)', body, re.S)
    if not (m or m2): fout(f'onbekend statement in DATA: {body[:40]!r}')
    n_id = int((m or m2).group(1))
    if n_id in ents: fout(f'#{n_id} komt twee keer voor')
    # Knownbug 1007: de TS-scanner rekent in int32 en weigert een `#id` boven 2^31 − 1 met de reden `id-te-groot`.
    if n_id > 2147483647: fout(f'#{n_id} is groter dan 2147483647 (id-te-groot)')
    ents[n_id] = (m.group(2), m.group(3)) if m else ('COMPLEX', m2.group(2)); pos[n_id] = st
if staat == 'kop': fout('HEADER zonder ENDSEC')
if staat == 'data': fout('DATA zonder ENDSEC')
if not ents: fout('0 entiteiten')
def split_args(s):
    out, depth, cur, ins, i = [], 0, '', False, 0
    while i < len(s):
        c = s[i]
        if ins:
            cur += c
            if c == "'":
                if i+1 < len(s) and s[i+1] == "'": cur += "'"; i += 1
                else: ins = False
        elif c == "'": ins = True; cur += c
        elif c == '(': depth += 1; cur += c
        elif c == ')': depth -= 1; cur += c
        elif c == ',' and depth == 0: out.append(cur); cur = ''
        else: cur += c
        i += 1
    out.append(cur); return out
def refs_in(s):
    return [int(x) for x in re.findall(r'#(\d+)', re.sub(r"'(?:[^']|'')*'", "''", s))]
ty = {i: e[0] for i, e in ents.items()}
args = {i: split_args(a) for i, (_, a) in ents.items()}
refs = {i: refs_in(a) for i, (_, a) in ents.items()}
def r1(i, k): r = refs_in(args[i][k]) if k < len(args[i]) else []; return r[0] if r else None
def rl(i, k): return refs_in(args[i][k]) if k < len(args[i]) else []
def name(i):
    a = args[i][2] if len(args[i]) > 2 else ''
    return a.strip("'")
W = set('''IFCPROPERTYSINGLEVALUE IFCPROPERTYSET IFCRELDEFINESBYPROPERTIES IFCWORKTIME IFCTIMEPERIOD IFCRECURRENCEPATTERN
IFCRELNESTS IFCRELASSIGNSTOCONTROL IFCWORKSCHEDULE IFCSIUNIT IFCSIMPLEPROPERTYTEMPLATE IFCPROPERTYSETTEMPLATE IFCORGANIZATION
IFCLAGTIME IFCTASKTIME IFCWORKPLAN IFCWORKCALENDAR IFCUNITASSIGNMENT IFCTASK IFCRELSEQUENCE IFCRELDECLARES IFCRELASSIGNSTOPROCESS
IFCRELAGGREGATES IFCPROPERTYENUMERATION IFCPROPERTYENUMERATEDVALUE IFCPROJECT IFCPERSONANDORGANIZATION IFCPERSON IFCOWNERHISTORY
IFCGEOMETRICREPRESENTATIONCONTEXT IFCCARTESIANPOINT IFCAXIS2PLACEMENT3D IFCAPPLICATION IFCCONSTRUCTIONEQUIPMENTRESOURCE
IFCCONSTRUCTIONMATERIALRESOURCE IFCCONSTRUCTIONPRODUCTRESOURCE IFCLABORRESOURCE IFCCREWRESOURCE IFCSUBCONTRACTRESOURCE
IFCCONSTRUCTIONRESOURCE IFCTASKTIMERECURRING'''.split())
RES = {k for k in W if k.endswith('RESOURCE')}
SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'services', 'ifc')
code = {f: open(f, encoding='utf-8').read() for f in glob.glob(os.path.join(SRC, '*.ts'))}
REG = set()
for f in ('ifcPsets.ts', 'ifcWriter.ts'):
    REG |= set(re.findall(r"'(OPS_[A-Za-z0-9]+)'", code[os.path.join(SRC, f)]))
KNOWN = set()
for c in code.values(): KNOWN |= set(re.findall(r"'([A-Za-z][A-Za-z0-9_]*)'", c))
# v8: psets met sleutels uit de data. Een property is alleen eigen als de lezer haar gebruikt (ontwerp v8 §4.2):
# OPS_Assignments: elke sleutel in GlobalId-vorm, <GlobalId>#n of kaal (oude writer), is eigen;
# OPS_ActivityCodes/OPS_CustomFields: namen uit de JSON in OPS_StructureMeta, met terugval op het eigen template.
# OPS_Timephased (Windows) en OPS_TimephasedWindow (FinishFloor, StartAnchor) hebben vaste namen.
GUID_KEYED = {'OPS_Assignments'}
def pname(i):  # Name van een property (arg 0) of property-template (arg 2)
    k = 2 if ty[i].endswith('TEMPLATE') else 0
    return args[i][k].strip("'") if k < len(args[i]) else ''
# --- Stap 1: D (huidige lezerregels) ---
sched = {i for i in ents if ty[i] == 'IFCWORKSCHEDULE'}
base = {i for i in sched if '.BASELINE.' in args[i][-1]}
live = sched - base
nest = defaultdict(list)
for i in ents:
    if ty[i] == 'IFCRELNESTS': nest[r1(i, 4)] += rl(i, 5)
def pname_raw(i): return args[i][0].strip("'")
def tree(roots_):
    out, todo = set(), list(roots_)
    while todo:
        x = todo.pop()
        if x in out or ty.get(x) != 'IFCTASK': continue
        out.add(x); todo += nest[x]
    return out
def tasks_of(sc):
    todo = []
    for i in ents:
        if ty[i] == 'IFCRELASSIGNSTOCONTROL' and r1(i, 6) in sc: todo += rl(i, 4)
        if ty[i] == 'IFCRELNESTS' and r1(i, 4) in sc: todo += rl(i, 5)
    return tree(todo)
live_tasks = tasks_of(live); base_tasks = tasks_of(base)
alltasks = {i for i in ents if ty[i] == 'IFCTASK'}
def app_of(oh):  # herkomst: de applicatie achter IfcOwnerHistory.OwningApplication (argument 1)
    if ty.get(oh) != 'IFCOWNERHISTORY': return None
    a = r1(oh, 1); return args[a][3].strip("'") if a in ents and len(args[a]) > 3 else None
# Baselinebomen gaan eruit als er een live-schema met taken is (#336), en altijd als er een live-schema van eigen
# herkomst is, ook zonder taken (spec §4.2 stap 1; review #839, Sol S3 / Terra T5).
eigen_live = any(len(args[i]) > 1 and app_of(r1(i, 1)) == 'OPS' for i in live)
excl = (base_tasks - live_tasks) if (live_tasks or eigen_live) else set()
allplans = [i for i in ents if ty[i] == 'IFCWORKPLAN']
plans = {min(allplans, key=lambda i: pos[i])} if allplans else set()  # de lezer kiest het eerste (ifcReader.ts:442)
agg_sched = set()
for i in ents:
    if ty[i] == 'IFCRELAGGREGATES' and r1(i, 4) in plans: agg_sched |= {x for x in rl(i, 5) if x in sched}
# v6: een BASELINE-schema is alleen D als (Name, CreationDate) gelijk is aan (name, createdAt) van een item in OPS_Baselines
bl_keys = set()
for i in ents:
    if ty[i] == 'IFCPROPERTYSET' and name(i) == 'OPS_Baselines':
        for x in refs[i]:
            if ty.get(x) == 'IFCPROPERTYSINGLEVALUE' and pname_raw(x) == 'Baselines':
                bl_keys |= set(re.findall(r'"name":"((?:[^"\\]|\\.)*)","createdAt":"([^"]*)"', ents[x][1]))
own_base = {b for b in base & agg_sched if (name(b), args[b][6].strip("'")) in bl_keys and not tasks_of({b})}
# v20: het eerste live-schema in de volgorde van het bestand is D (besluit wrakko, 9 november 2026); een ander
# live-schema alleen bij eigen herkomst.
live_d = ({min(live, key=lambda i: pos[i])} if live else set()) | {i for i in live if len(args[i]) > 1 and app_of(r1(i, 1)) == 'OPS'}
D = plans | live_d | own_base | (alltasks - excl) | {i for i in ents if ty[i] in RES or ty[i] == 'IFCWORKCALENDAR'}
D |= {i for i in ents if ty[i] == 'IFCRELSEQUENCE' and r1(i, 4) in D and r1(i, 5) in D}  # v6: IfcRelSequence is D
proj = {i for i in ents if ty[i] == 'IFCPROJECT'}
# Bekende namen voor OPS_CustomFields: de property-templates onder het eigen template
cf_names, ac_types = set(), {}
def strs(a): return re.findall(r"'((?:[^']|'')*)'", a)
import json
sm_ac, sm_cf = None, None  # v8: OPS_StructureMeta is de autoritaire bron (ifcReader.ts:2202-2215)
for i in ents:
    if ty[i] == 'IFCPROPERTYSET' and name(i) == 'OPS_StructureMeta':
        for x in refs[i]:
            if ty.get(x) != 'IFCPROPERTYSINGLEVALUE': continue
            m = re.search(r"IFCTEXT\('((?:[^']|'')*)'\)", ents[x][1])
            if not m: continue
            try: meta = json.loads(m.group(1).replace("''", "'").replace('\\\\', '\\'))
            except Exception: continue
            if isinstance(meta.get('activityCodeTypes'), list):
                sm_ac = {t.get('name'): {v.get('code') for v in t.get('values', [])} for t in meta['activityCodeTypes']}
            if isinstance(meta.get('customFieldDefs'), list): sm_cf = {d.get('name') for d in meta['customFieldDefs']}
for i in ents:
    if ty[i] == 'IFCPROPERTYSETTEMPLATE' and name(i) == 'OPS_CustomFields':
        cf_names |= {pname(x) for x in refs[i] if ty.get(x) == 'IFCSIMPLEPROPERTYTEMPLATE'}
    if ty[i] == 'IFCPROPERTYSETTEMPLATE' and name(i) == 'OPS_ActivityCodes':
        for x in refs[i]:
            if ty.get(x) == 'IFCSIMPLEPROPERTYTEMPLATE':
                en = r1(x, 7); ac_types[pname(x)] = set(strs(args[en][1])) if en in ents else set()
if sm_ac or sm_cf:  # de lezer valt terug op de templates als beide lijsten leeg zijn (ifcReader.ts:2219)
    ac_types, cf_names = (sm_ac or {}), (sm_cf or set())
# pset -> objecten (via elke IfcRelDefinesByProperties) en toewijzingsparen (taak, resource-GlobalId) -> aantal
pset_objs = defaultdict(set)
for i in ents:
    if ty[i] == 'IFCRELDEFINESBYPROPERTIES': pset_objs[r1(i, 5)] |= set(rl(i, 4))
pairs = Counter()
for i in ents:
    if ty[i] == 'IFCRELASSIGNSTOPROCESS':
        for x in rl(i, 4):
            if ty.get(x) in RES: pairs[(r1(i, 6), args[x][0].strip("'"))] += 1
def prop_read(ps, pr):
    n = pname(pr); psn = name(ps)
    if psn in GUID_KEYED:  # de lezer zet de sleutels per GlobalId op volgorde van n in een wachtrij (ifcReader.ts:3455-3470)
        # v9: elke sleutel in GlobalId-vorm (kaal of met #n) is eigen (ontwerp v9 §4.2)
        return bool(re.fullmatch(r'[0-9A-Za-z_$]{22}(#\d+)?', n))
    if psn == 'OPS_ActivityCodes':
        v = strs(args[pr][2]) if len(args[pr]) > 2 else []
        return n in ac_types and bool(v) and v[0] in ac_types[n]
    if psn == 'OPS_CustomFields': return n in cf_names
    return n in KNOWN
# --- Stap 2: R ---
def ok(i):
    T = ty[i]
    if T == 'IFCRELNESTS': return r1(i, 4) in D and all(x in D for x in rl(i, 5))
    if T == 'IFCRELASSIGNSTOCONTROL': return r1(i, 6) in D and ty[r1(i, 6)] in ('IFCWORKSCHEDULE', 'IFCWORKCALENDAR') and all(x in D and (ty[x] == 'IFCTASK' or ty[x] in RES) for x in rl(i, 4)) and (ty[r1(i, 6)] == 'IFCWORKCALENDAR' or all(ty[x] == 'IFCTASK' for x in rl(i, 4)))
    if T == 'IFCRELASSIGNSTOPROCESS': return r1(i, 6) in D and all(x in D and ty[x] in RES for x in rl(i, 4))
    if T == 'IFCRELAGGREGATES': return r1(i, 4) in plans and all(x in D and x in sched for x in rl(i, 5))
    if T == 'IFCRELDECLARES': return r1(i, 4) in proj and all(ty.get(x) == 'IFCPROPERTYSETTEMPLATE' and name(x) in REG for x in rl(i, 5))
    if T == 'IFCRELDEFINESBYPROPERTIES':
        p = r1(i, 5); return all(x in D or x in proj for x in rl(i, 4)) and p is not None and ty.get(p) == 'IFCPROPERTYSET' and name(p) in REG
    return False
R = {i for i in ents if ty[i].startswith('IFCREL') and ok(i)}
# --- Stap 3: Own ---
Own, todo, vreemd_lid = set(), list(D | R), set()
PROPS = ('IFCPROPERTYSINGLEVALUE', 'IFCPROPERTYENUMERATEDVALUE', 'IFCSIMPLEPROPERTYTEMPLATE')
while todo:
    x = todo.pop()
    if x in Own or ty.get(x) not in W: continue
    Own.add(x)
    if ty[x] in ('IFCPROPERTYSET', 'IFCPROPERTYSETTEMPLATE') and name(x) in REG:
        for r in refs[x]:  # v7: Own volgt alleen properties die de lezer gebruikt; de rest is een vreemd lid
            if ty.get(r) in PROPS and ty[x] == 'IFCPROPERTYSET' and not prop_read(x, r): vreemd_lid.add(r)
            else: todo.append(r)
    else: todo += refs[x]
# --- Stap 4: Ext ---
# v7: herkomst. Een D/R-stuk waarvan de owner history niet naar de OPS-applicatie wijst, houdt die owner history
# (constant #-slot); die is dus een startpunt van Ext en wordt C.
vreemde_herkomst = {i for i in D | R if len(args[i]) > 1 and app_of(r1(i, 1)) != 'OPS'}
oh_starts = [r1(i, 1) for i in vreemde_herkomst if r1(i, 1) is not None]
# v20: Creators (argument 7) van werkplan en werkschema is een constant #-slot; zijn doelen zijn startpunten van Ext.
oh_starts += [x for i in D if ty[i] in ('IFCWORKPLAN', 'IFCWORKSCHEDULE') for x in rl(i, 7)]
Ext, todo = set(), [i for i in ents if i not in Own] + oh_starts
seen = set()
while todo:
    x = todo.pop()
    if x in seen or x not in ents: continue
    seen.add(x)
    if x in Own: Ext.add(x)
    if x in D or x in R: continue  # Ext stopt bij D ∪ R (die houden hun #id)
    todo += refs[x]
P = D | R | (Own - Ext)
C = (Own & Ext) - D - R
A = {i for i in ents if i not in Own and any(r in P for r in refs[i])}
V = set(ents) - P - C - A
if AS_JSON:
    import json as _json
    cls = {str(i): ('P' if i in P else 'C' if i in C else 'A' if i in A else 'V') for i in ents}
    print(_json.dumps({'classes': cls, 'vreemde_leden': sorted(vreemd_lid), 'vreemde_herkomst': sorted(vreemde_herkomst)}))
    sys.exit(0)
print(f"{sys.argv[1].split('/')[-1]}: {len(ents)} entiteiten | P {len(P)} C {len(C)} A {len(A)} V {len(V)} | vreemde leden {len(vreemd_lid)} | vreemde herkomst {len(vreemde_herkomst)}")
for nm, S_ in (('C', C), ('A', A), ('V', V)):
    if S_: print('  ', nm, dict(Counter(ty[x] for x in S_).most_common(8)))
