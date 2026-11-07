# Indeling volgens ontwerp v8 §4.2 (D, R, Own, Ext -> P/C/A/V) op een IFC-bestand met één entiteit per regel.
# Fase-0-voorproef (ontwerp #804 v8 §4.2). Draaien: python3 -I scripts/proef/classify-v8.py <bestand.ifc>
# Benaderingen: het register komt uit de 'OPS_*'-namen in ifcPsets.ts/ifcWriter.ts; de bekende propertynamen zijn alle
# tekstliteralen in src/services/ifc/*.ts (een ruime overmaat). De bouw haalt beide uit één bron in de code.
import re, sys, os, glob
from collections import defaultdict, Counter
t = open(sys.argv[1], encoding='utf-8', errors='replace').read()
ents, pos = {}, {}
for m in re.finditer(r'^#(\d+)\s*=\s*([A-Z0-9_]+)\((.*)\);\s*$', t, re.M):
    ents[int(m.group(1))] = (m.group(2), m.group(3)); pos[int(m.group(1))] = m.start()
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
# OPS_Assignments: <GlobalId van een resource>#n (de k-de sleutel op n is eigen als die resource minstens k keer aan de
# taak is toegewezen) of de kale GlobalId (oude writer, eigen als de resource aan de taak is toegewezen);
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
excl = (base_tasks - live_tasks) if live_tasks else set()
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
D = plans | live | own_base | (alltasks - excl) | {i for i in ents if ty[i] in RES or ty[i] == 'IFCWORKCALENDAR'}
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
if sm_ac is not None or sm_cf is not None:
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
        m = re.fullmatch(r'(.+)#(\d+)', n)
        if not m: return any(pairs[(t, n)] > 0 for t in pset_objs[ps])  # kale GlobalId (ifcReader.ts:3461, 3494)
        same = sorted(int(re.fullmatch(r'(.+)#(\d+)', pname(q)).group(2)) for q in refs[ps]
                      if ty.get(q) in PROPS and re.fullmatch(re.escape(m.group(1)) + r'#\d+', pname(q)))
        k = same.index(int(m.group(2)))
        return any(k < pairs[(t, m.group(1))] for t in pset_objs[ps])
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
def app_of(oh):
    if ty.get(oh) != 'IFCOWNERHISTORY': return None
    a = r1(oh, 1); return args[a][3].strip("'") if a in ents and len(args[a]) > 3 else None
vreemde_herkomst = {i for i in D | R if len(args[i]) > 1 and app_of(r1(i, 1)) != 'OPS'}
oh_starts = [r1(i, 1) for i in vreemde_herkomst if r1(i, 1) is not None]
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
print(f"{sys.argv[1].split('/')[-1]}: {len(ents)} entiteiten | P {len(P)} C {len(C)} A {len(A)} V {len(V)} | vreemde leden {len(vreemd_lid)} | vreemde herkomst {len(vreemde_herkomst)}")
for nm, S_ in (('C', C), ('A', A), ('V', V)):
    if S_: print('  ', nm, dict(Counter(ty[x] for x in S_).most_common(8)))
